-- 5MIN Migration: Full Privacy Platform Upgrades
-- View-Once media, Room Settings, Message Deletion, and Atomic Room Destruction

-- 1. Extend Rooms table with Privacy & Feature controls
alter table if exists public.rooms
  add column if not exists allow_images boolean default true,
  add column if not exists allow_reactions boolean default true,
  add column if not exists allow_replies boolean default true,
  add column if not exists max_participants integer default 2;

-- 2. Extend Messages table with View-Once and soft-deletion fields
alter table if exists public.messages
  add column if not exists is_view_once boolean default false,
  add column if not exists viewed_at timestamptz default null,
  add column if not exists is_deleted boolean default false;

-- 3. Index on message view-once status and active messages
create index if not exists idx_messages_view_once on public.messages(is_view_once) where is_view_once = true;
create index if not exists idx_messages_is_deleted on public.messages(is_deleted);

-- 4. Stored Procedure: Atomic Emergency Room Destruction
drop function if exists public.destroy_room(uuid, text);

create or replace function public.destroy_room(
  p_room_id uuid,
  p_session_id text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_room record;
  v_deleted_messages integer := 0;
begin
  -- Verify room exists and caller is owner
  select * into v_room
  from public.rooms
  where id = p_room_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'ROOM_NOT_FOUND');
  end if;

  if v_room.creator_session_id != p_session_id then
    return jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  end if;

  -- Delete all messages in the room
  delete from public.messages where room_id = p_room_id;
  get diagnostics v_deleted_messages = row_count;

  -- Remove all participants
  delete from public.participants where room_id = p_room_id;

  -- Mark room as expired immediately
  update public.rooms
  set status = 'expired',
      expires_at = now()
  where id = p_room_id;

  return jsonb_build_object(
    'success', true,
    'room_id', p_room_id,
    'deleted_messages', v_deleted_messages
  );
end;
$$;

-- 5. Stored Procedure: Mark View-Once Photo Opened and Purged
drop function if exists public.mark_view_once_opened(uuid, text);

create or replace function public.mark_view_once_opened(
  p_message_id uuid,
  p_session_id text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_msg record;
begin
  select m.* into v_msg
  from public.messages m
  join public.participants p on p.room_id = m.room_id
  where m.id = p_message_id and p.session_id = p_session_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'MESSAGE_NOT_FOUND_OR_FORBIDDEN');
  end if;

  -- Update message as viewed
  update public.messages
  set viewed_at = coalesce(viewed_at, now()),
      content = '[Photo Burned]',
      image_url = null
  where id = p_message_id;

  return jsonb_build_object(
    'success', true,
    'message_id', p_message_id,
    'image_path', v_msg.image_path
  );
end;
$$;
