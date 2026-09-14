-- 5MIN Schema Migration: Ephemeral Private Rooms, Atomic Concurrency, RLS & Realtime
-- Authoritative server-side expiration and strict max 2 participant capacity

-- 1. Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. Rooms Table
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  status text not null default 'active' check (status in ('active', 'expired')),
  participant_count integer not null default 1 check (participant_count >= 1 and participant_count <= 2),
  creator_session_id text not null
);

-- 3. Participants Table
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  session_id text not null,
  nickname text default 'Guest',
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint uq_room_participant unique (room_id, session_id)
);

-- 4. Messages Table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_session_id text not null,
  sender_name text not null default 'Guest',
  content text not null check (char_length(content) <= 2000 and char_length(content) > 0),
  reply_to jsonb,
  reactions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- 5. Indexes for fast retrieval and expiration filtering
create index if not exists idx_rooms_code on public.rooms(code);
create index if not exists idx_rooms_expires_at on public.rooms(expires_at);
create index if not exists idx_rooms_status on public.rooms(status);
create index if not exists idx_participants_room on public.participants(room_id);
create index if not exists idx_participants_lookup on public.participants(room_id, session_id);
create index if not exists idx_messages_room on public.messages(room_id);
create index if not exists idx_messages_expires_at on public.messages(expires_at);

-- 6. Enable Row Level Security (RLS)
alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.messages enable row level security;

-- Policies for public anon key (read-only for current session's room)
create policy "Allow read room by code" on public.rooms
  for select using (
    status = 'active' and now() < expires_at
  );

create policy "Allow read participants of active room" on public.participants
  for select using (
    exists (
      select 1 from public.rooms r
      where r.id = participants.room_id
        and r.status = 'active'
        and now() < r.expires_at
    )
  );

create policy "Allow read messages of active room" on public.messages
  for select using (
    exists (
      select 1 from public.rooms r
      where r.id = messages.room_id
        and r.status = 'active'
        and now() < r.expires_at
    )
  );

-- All insert/update/delete operations are securely handled through Next.js server route handlers using the service role client,
-- preventing direct untrusted client modifications.

-- 7. Atomic Join Function with Row-level Lock (Race-condition proof)
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
begin
  -- 1. Lock the room row to prevent concurrent join race condition
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

  -- 4. Check if session has already joined
  select * into v_participant
  from public.participants
  where room_id = v_room.id and session_id = p_session_id;

  if found then
    return jsonb_build_object(
      'success', true,
      'status', 'ALREADY_JOINED',
      'room_id', v_room.id,
      'code', v_room.code,
      'created_at', v_room.created_at,
      'expires_at', v_room.expires_at,
      'participant_count', v_room.participant_count,
      'server_time', v_now
    );
  end if;

  -- 5. Enforce strict maximum 2 participants
  if v_room.participant_count >= 2 then
    return jsonb_build_object(
      'success', false,
      'error', 'ROOM_FULL',
      'message', 'This private room has reached maximum capacity (2 participants).'
    );
  end if;

  -- 6. Insert new participant
  insert into public.participants (
    room_id,
    session_id,
    nickname,
    joined_at,
    last_seen_at
  ) values (
    v_room.id,
    p_session_id,
    coalesce(nullif(trim(p_nickname), ''), 'Guest'),
    v_now,
    v_now
  );

  -- 7. Atomically increment participant count
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
    'server_time', v_now
  );
end;
$$;

-- 8. Automatic Expiration & Cleanup Function
create or replace function public.cleanup_expired_rooms()
returns integer
language plpgsql
security definer
as $$
declare
  v_cleaned_count integer := 0;
begin
  -- Mark active rooms past expiration as expired
  update public.rooms
  set status = 'expired'
  where status = 'active' and now() >= expires_at;

  -- Delete messages for all expired rooms or whose messages have passed their expiry
  delete from public.messages
  where now() >= expires_at
     or room_id in (select id from public.rooms where status = 'expired');

  get diagnostics v_cleaned_count = row_count;

  -- Permanently remove room and participant entries 1 hour after expiration
  delete from public.rooms
  where status = 'expired' and expires_at < (now() - interval '1 hour');

  return v_cleaned_count;
end;
$$;

-- 9. Add tables to Supabase Realtime publication
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.rooms;

