# 5MIN — Supabase Real Backend Setup Guide

This document outlines the complete instructions for configuring and connecting the real Supabase backend to **5MIN**.

---

## 1. Prerequisites

1. A [Supabase](https://supabase.com) account (free tier works perfectly).
2. A new Supabase project (e.g. named `5min-chat`).

---

## 2. Environment Variables Configuration

In your Supabase project dashboard:
1. Go to **Project Settings** (gear icon) → **API**.
2. Copy:
   - **Project URL**
   - **anon / public** API Key
   - **service_role** API Key (keep this private; never share it)

In your local project directory, open `.env.local` (or copy from `.env.example`):

```bash
# Frontend Public Environment Variables (accessible by the browser)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server-Only Privileged Key (used exclusively by Next.js Route Handlers)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 3. Database Migration

1. In your Supabase Dashboard, navigate to the **SQL Editor** (left sidebar).
2. Open [`supabase/migrations/20260914000000_init_5min.sql`](./supabase/migrations/20260914000000_init_5min.sql).
3. Copy and paste the entire script into the SQL Editor and click **Run**.

### What this migration sets up:
- **`public.rooms` table**: Holds room code, created_at, expires_at (strictly 5 minutes), status (`active` | `expired`), participant_count, and creator_session_id.
- **`public.participants` table**: Links session IDs to room IDs with unique constraint `(room_id, session_id)`.
- **`public.messages` table**: Ephemeral message log with 2000 character length constraint and cascade deletion.
- **`public.join_room()` atomic function**:
  - Uses `SELECT ... FOR UPDATE` row-level locks on `rooms`.
  - Atomically verifies expiration, active status, and guarantees a strict ceiling of **2 participants** with zero race-condition vulnerability.
- **`public.cleanup_expired_rooms()` function**:
  - Automatically updates rooms past `expires_at` to `status = 'expired'`.
  - Purges messages belonging to expired rooms.
- **Row Level Security (RLS)**: Enabled on all tables. Read access is constrained to active, unexpired rooms; writes are performed exclusively by server Route Handlers using the server-side admin client.
- **Realtime publication**: Adds `rooms` and `messages` to `supabase_realtime`.

---

## 4. Enable Supabase Realtime

The migration automatically runs:
```sql
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.rooms;
```

To verify in the dashboard:
1. Go to **Database** → **Replication**.
2. Confirm that `supabase_realtime` has `messages` and `rooms` enabled.

---

## 5. Scheduled Cleanup Configuration

Because 5MIN conversations are ephemeral, expired data is cleaned up on the server.

### Option A: Using PostgreSQL `pg_cron` (Recommended in Supabase)
In Supabase SQL Editor:
```sql
-- Enable pg_cron extension
create extension if not exists pg_cron;

-- Schedule automatic cleanup every minute
select cron.schedule(
  'cleanup-expired-rooms-job',
  '* * * * *',
  $$select public.cleanup_expired_rooms();$$
);
```

### Option B: Using Next.js API Cron (Vercel Cron / GitHub Actions)
You can make a periodic POST request to:
```
POST https://your-deployment-url.com/api/rooms/cleanup
```
This executes `cleanup_expired_rooms()`.

---

## 6. Security Audit Summary

- **Zero Client Trust**: All room creation, code generation, participant count increments, and timer checks occur on the server.
- **Service Key Isolation**: `SUPABASE_SERVICE_ROLE_KEY` is loaded only in `src/lib/supabase/admin.ts` within Next.js Route Handlers. It is never exposed to the client bundle.
- **Code Entropy & Collision Resistance**: Codes (`XXXX-XX`) exclude ambiguous characters (`0, O, 1, I, 5, S`) and are generated using Node.js `crypto.randomInt` with collision verification loops.
- **Anti-Spam Rate Limiting**: Next.js API routes enforce sliding-window rate limiting on room creation (5/min), join attempts (15/min), and message posting (60/min).
- **XSS & Injection Protection**: User input is strictly sanitized and rendered safely in React message bubbles. SQL queries utilize parameterized RPC functions.

