-- 5MIN Migration: Photo Messaging, Per-Message TTL, Storage Bucket & Policies

-- 1. Add image and per-message TTL fields to messages table
alter table if exists public.messages
  add column if not exists image_path text,
  add column if not exists image_url text,
  add column if not exists ttl_seconds integer default 300;

-- 2. Index on message expiration for high-performance cleanup queries
create index if not exists idx_messages_ttl on public.messages(expires_at);

-- 3. Create private Supabase Storage Bucket for room attachments
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'room-attachments',
  'room-attachments',
  false,
  5242880, -- 5MB maximum file size
  array['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

-- 4. Storage Row Level Security (RLS) Policies
-- Allow access to storage objects only for active room participants
create policy "Allow read room attachments for active rooms"
on storage.objects for select
using (
  bucket_id = 'room-attachments'
  and exists (
    select 1 from public.rooms r
    where r.status = 'active'
      and now() < r.expires_at
      and (storage.foldername(name))[2] = r.id::text
  )
);

create policy "Allow upload room attachments for active rooms"
on storage.objects for insert
with check (
  bucket_id = 'room-attachments'
  and exists (
    select 1 from public.rooms r
    where r.status = 'active'
      and now() < r.expires_at
      and (storage.foldername(name))[2] = r.id::text
  )
);

create policy "Allow delete room attachments on room expiration"
on storage.objects for delete
using (
  bucket_id = 'room-attachments'
);

-- 5. Enhanced cleanup function that handles expired messages and cleans up storage references
create or replace function public.cleanup_expired_rooms()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_expired_rooms_count integer := 0;
  v_expired_messages_count integer := 0;
begin
  -- Mark rooms past expiration as expired
  update public.rooms
  set status = 'expired'
  where status = 'active' and now() >= expires_at;

  get diagnostics v_expired_rooms_count = row_count;

  -- Delete messages that have passed their per-message TTL or whose room has expired
  delete from public.messages
  where now() >= expires_at
     or room_id in (select id from public.rooms where status = 'expired');

  get diagnostics v_expired_messages_count = row_count;

  -- Permanently remove room records older than 1 hour
  delete from public.rooms
  where status = 'expired' and expires_at < (now() - interval '1 hour');

  return jsonb_build_object(
    'expired_rooms', v_expired_rooms_count,
    'expired_messages', v_expired_messages_count
  );
end;
$$;
