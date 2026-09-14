# 5MIN — Talk. Then disappear.

An exceptionally refined, modern, cinematic temporary private chat platform.

- **Session Lifespan**: Exactly 5 minutes from creation.
- **Privacy First**: No accounts, no user profiles, no permanent conversation history.
- **Real-Time Architecture**: Built with Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Framer Motion, and Supabase (PostgreSQL, Realtime, RLS).

---

## Features

- **Authoritative Server Expiration**: Expiration is dictated strictly by the server (`expires_at`), not by browser intervals.
- **Race-Condition-Proof Capacity**: Strict 2-participant limit enforced atomically via PostgreSQL row locking (`FOR UPDATE`).
- **Cryptographic Room Codes**: Unambiguous codes (`XXXX-XX`) generated server-side using secure randomness, avoiding confusing characters (`0, O, 1, I, 5, S`).
- **Realtime Instant Messaging**: Powered by Supabase Realtime with optimistic UI updates and procedural Web Audio pips.
- **Typing Indicator**: Real-time peer typing indicator transmitted over Supabase broadcast channels.
- **Automatic Server Cleanup**: Built-in scheduled cleanup routine purging expired rooms and dissolved messages.
- **Graceful Offline / Preview Mode**: Operates seamlessly out-of-the-box in local development with mock fallbacks even before database keys are supplied.

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables (Optional for Local Preview)
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Add your Supabase credentials (see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for full setup instructions).

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
npm run start
```

---

## Testing Scenarios

1. **User Creates Room**: Click *Create Private Room*. The server generates a unique code (e.g. `9P66-ZJ`) with a 5:00 lifespan.
2. **User B Joins**: In another browser window/tab, click *Join Room*, enter the code, and join.
3. **Third User Blocked**: Attempting to join the same room with a 3rd session produces `ROOM FULL`.
4. **Instant Messaging**: Messages sent from User A appear instantly for User B.
5. **Page Refresh**: Refreshing the browser tab reconnects to the active room and synchronizes the authoritative timer.
6. **Authoritative Expiry**: When the 5-minute timer completes, both users transition to the locked `Room Expired` screen, and all subsequent messages or join attempts are rejected by the server.

