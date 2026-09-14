-- 5MIN Migration: Production Privacy Hardening
-- Support for granular expiration defaults, participant capacities up to 50,
-- invite revocation, read receipts (seen_at/delivered_at), and participant kick RPC.

-- 1. Relax participant_count check constraint to allow custom capacities
alter table public.rooms drop constraint if exists rooms_participant_count_check;
alter table public.rooms add constraint rooms_participant_count_check check (participant_count >= 1 and participant_count <= 50);

-- 2. Add granular expiration defaults and invite revocation flags to rooms
alter table if exists public.rooms
  add column if not exists default_message_ttl integer default 300,
  add column if not exists default_photo_ttl integer default 300,
  add column if not exists allow_view_once boolean default true,
  add column if not exists is_invite_revoked boolean default false;

-- 3. Add read receipt fields to messages
alter table if exists public.messages
  add column if not exists seen_at timestamptz default null,
  add column if not exists delivered_at timestamptz default null;

-- 4. Index for message read receipts and delivered tracking
create index if not exists idx_messages_seen on public.messages(room_id, seen_at) where seen_at is null;

-- 5. Enhanced Atomic Join Function supporting custom capacities & invite revocation
create or replace function public.join_room(
  p_code text,
  p_session_id text,
  p_nickname text default 'Guest'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_room public.rooms%rowtype;
  v_participant public.participants%rowtype;
  v_now timestamptz := now();
  v_max_capacity integer := 2;
begin
  -- 1. Lock the room row to prevent race conditions
  select * into v_room
  from public.rooms
  where code = upper(trim(p_code))
  for update;

  -- 2. Check if room exists
  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'ROOM_NOT_FOUND',
      'message', 'This room could not be found.'
    );
  end if;

  -- 3. Check expiration
  if v_room.status = 'expired' or v_now >= v_room.expires_at then
    update public.rooms set status = 'expired' where id = v_room.id;
    return jsonb_build_object(
      'success', false,
      'error', 'ROOM_EXPIRED',
      'message', 'This room has already expired.'
    );
  end if;

  -- 4. Check if invite revoked
  if coalesce(v_room.is_invite_revoked, false) = true then
    return jsonb_build_object(
      'success', false,
      'error', 'INVITE_REVOKED',
      'message', 'This room invitation code has been revoked by the owner.'
    );
  end if;

  -- 5. Check if session has already joined
  select * into v_participant
  from public.participants
  where room_id = v_room.id and session_id = p_session_id;

  v_max_capacity := coalesce(v_room.max_participants, 2);

  if found then
    return jsonb_build_object(
      'success', true,
      'status', 'ALREADY_JOINED',
      'room_id', v_room.id,
      'code', v_room.code,
      'created_at', v_room.created_at,
      'expires_at', v_room.expires_at,
      'participant_count', v_room.participant_count,
      'max_participants', v_max_capacity,
      'allow_images', coalesce(v_room.allow_images, true),
      'allow_reactions', coalesce(v_room.allow_reactions, true),
      'allow_replies', coalesce(v_room.allow_replies, true),
      'allow_view_once', coalesce(v_room.allow_view_once, true),
      'default_message_ttl', v_room.default_message_ttl,
      'default_photo_ttl', v_room.default_photo_ttl,
      'server_time', v_now
    );
  end if;

  -- 6. Enforce dynamic maximum participants
  if v_room.participant_count >= v_max_capacity then
    return jsonb_build_object(
      'success', false,
      'error', 'ROOM_FULL',
      'message', format('This private room has reached maximum capacity (%s participants).', v_max_capacity)
    );
  end if;

  -- 7. Insert new participant
  insert into public.participants (room_id, session_id, nickname, joined_at, last_seen_at)
  values (v_room.id, p_session_id, coalesce(nullif(trim(p_nickname), ''), 'Guest'), v_now, v_now);

  -- 8. Increment participant counter
  update public.rooms
  set participant_count = participant_count + 1
  where id = v_room.id;

  return jsonb_build_object(
    'success', true,
    'status', 'JOIN_SUCCESS',
    'room_id', v_room.id,
    'code', v_room.code,
    'created_at', v_room.created_at,
    'expires_at', v_room.expires_at,
    'participant_count', v_room.participant_count + 1,
    'max_participants', v_max_capacity,
    'allow_images', coalesce(v_room.allow_images, true),
    'allow_reactions', coalesce(v_room.allow_reactions, true),
    'allow_replies', coalesce(v_room.allow_replies, true),
    'allow_view_once', coalesce(v_room.allow_view_once, true),
    'default_message_ttl', v_room.default_message_ttl,
    'default_photo_ttl', v_room.default_photo_ttl,
    'server_time', v_now
  );
end;
$$;

-- 6. Stored Procedure: Kick Participant by Room Owner
drop function if exists public.kick_participant(uuid, text, text);

create or replace function public.kick_participant(
  p_room_id uuid,
  p_owner_session_id text,
  p_target_session_id text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_room record;
  v_deleted integer := 0;
begin
  select * into v_room
  from public.rooms
  where id = p_room_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'ROOM_NOT_FOUND');
  end if;

  if v_room.creator_session_id != p_owner_session_id then
    return jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  end if;

  if p_owner_session_id = p_target_session_id then
    return jsonb_build_object('success', false, 'error', 'CANNOT_KICK_SELF');
  end if;

  delete from public.participants
  where room_id = p_room_id and session_id = p_target_session_id;

  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    update public.rooms
    set participant_count = greatest(1, participant_count - 1)
    where id = p_room_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'kicked_session_id', p_target_session_id,
    'participant_count', greatest(1, v_room.participant_count - 1)
  );
end;
$$;

-- 7. Stored Procedure: Revoke Invite Code by Room Owner
drop function if exists public.revoke_invite(uuid, text);

create or replace function public.revoke_invite(
  p_room_id uuid,
  p_owner_session_id text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_room record;
begin
  select * into v_room
  from public.rooms
  where id = p_room_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'ROOM_NOT_FOUND');
  end if;

  if v_room.creator_session_id != p_owner_session_id then
    return jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  end if;

  update public.rooms
  set is_invite_revoked = true
  where id = p_room_id;

  return jsonb_build_object('success', true, 'room_id', p_room_id);
end;
$$;
