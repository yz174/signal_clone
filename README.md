# Signal Clone

A functional clone of Signal Messenger: mocked phone auth, one-to-one and group
conversations, real-time messaging with delivery and read receipts, typing
indicators, presence, reactions, quoted replies, attachments, and an installable
PWA that queues messages while offline.

Built for the Scaler SDE Fullstack assignment. **Encryption is simulated** — messages
are stored in plain text. See [Assumptions](#assumptions).

---

## Contents

- [Quick start](#quick-start)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Database schema](#database-schema)
- [API overview](#api-overview)
- [Realtime protocol](#realtime-protocol)
- [Verification](#verification)
- [Deployment](#deployment)
- [Scaling notes](#scaling-notes)
- [Assumptions](#assumptions)

---

## Quick start

Requires **Python 3.12+** with [uv](https://docs.astral.sh/uv/), and **Node 20+**.

```bash
# 1. Backend configuration (JWT_SECRET has no default and is required)
cp backend/.env.example backend/.env
#    then edit backend/.env and set JWT_SECRET to 32+ characters

# 2. Frontend configuration
cp frontend/.env.example frontend/.env.local

# 3. Install
npm install
npm --prefix frontend install
cd backend && uv sync --all-extras && cd ..

# 4. Create and seed the database
npm run migrate
npm run seed

# 5. Run both halves
npm run dev
```

- App: <http://localhost:3000>
- API docs (live OpenAPI): <http://localhost:8000/docs>

### Signing in

Verification is mocked. **Any** phone number works with the code **`123456`**.

Seeded accounts are `+15550100001` … `+15550100010`. Sign in as **`+15550100001`**
(Ava Mitchell) for the fullest account: five direct threads, two groups — one where
she is admin and one where she is not — and unread badges already populated.

To see realtime, open a second browser profile as `+15550100002` (Noah Berger).

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Runs API and web together |
| `npm run verify` | Lint + typecheck + test, both halves |
| `npm test` | Backend test suite (134 tests) |
| `npm run seed` | Seeds users, conversations and messages |
| `npm run gen:client` | Regenerates frontend types from the API's OpenAPI schema |
| `npm run check:pg` | Proves the schema also runs on Postgres (needs Docker) |
| `npm run check:redis` | Proves WebSocket fanout crosses workers via Redis (needs Docker) |
| `npm run check:litestream` | Proves the database survives a destroyed disk (needs Docker) |
| `npm run check:ui` / `check:shell` / `check:realtime` / `check:groups` / `check:bonus` / `check:attachments` / `check:pwa` | Browser checks (need both servers running) |

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Backend | **FastAPI** | Native `@app.websocket`; Pydantic v2 gives typed I/O and a live OpenAPI doc; SQLAlchemy 2.0's async engine is first-class. Django would need Channels plus a channel-layer backend even locally, and its batteries (admin, `contrib.auth`) go unused here since auth is a custom mocked OTP flow. |
| Database | **SQLite** (`aiosqlite`, WAL) | Per the brief. Same engine in development and production; no service to provision. |
| Durability | **Litestream** → S3-compatible storage | Streams the WAL off the box, restores on boot. Lets SQLite survive an ephemeral free host. |
| ORM | **SQLAlchemy 2.0 async + Alembic** | Explicit, reviewable schema; migrations that run on SQLite *and* Postgres. |
| Realtime | **WebSocket** + `EventBus` (in-process / Redis) | REST owns durable writes; the socket is a push channel. |
| Frontend | **Next.js 16, TypeScript, Tailwind v4** | App Router, React 19. |
| Client state | **Zustand** | Three writers (REST, WebSocket, optimistic sends) merge into one normalised store. |
| PWA | **Serwist** | Maintained successor to `next-pwa`. |

---

## Architecture

```
Next.js 16 PWA                          FastAPI
┌──────────────────────┐                ┌────────────────────────────────┐
│ app/       routes    │  REST /api/v1  │ api/v1/    thin routers        │
│ components/          │ ─────────────► │    ↓        Pydantic schemas   │
│ lib/api    generated │                │ services/  business + txns     │
│            from      │  WS /ws        │    ↓                           │
│            OpenAPI   │ ◄───────────── │ models/    SQLAlchemy 2.0      │
│ lib/store  zustand   │  push events   │ realtime/  registry + EventBus │
│ lib/offline outbox   │                └───────────────┬────────────────┘
│ sw.ts      Serwist   │                                │ WAL
└──────────────────────┘                     SQLite ──► Litestream ──► object storage
```

Three layers, one direction:

- **Routers** parse and authorize. They never touch a `Session`.
- **Services** own business rules and transaction boundaries. They never see a `Request`.
- **Models** own persistence.

### Two decisions that shape everything

**1. REST writes, WebSocket pushes.** Every durable mutation is an idempotent REST
call — retryable, `curl`-able, unit-testable with `httpx`. The socket carries
server→client events plus ephemeral signals (typing) that are never stored. There is
no request/response correlation to hand-roll and no ambiguity about whether a write
landed.

**2. Receipts are cursors, not rows.** Each membership row carries `last_read_seq`
and `last_delivered_seq`. A message to a 500-member group costs **one** row, not 500
receipt rows. The API ships O(members) integers per conversation and the client
derives each bubble's tick state by comparing peer cursors against that message's
`seq`.

---

## Database schema

Nine tables. Two ideas carry the design:

**Per-conversation monotonic `seq`**, allocated inside the send transaction with
`UPDATE conversations SET last_seq = last_seq + 1 … RETURNING last_seq`. This gives
stable cursor pagination, gap recovery after a reconnect (`?after_seq=N`), and cheap
receipt maths — without depending on clock ordering.

**Cursor-based receipts**, as above.

```
users(id PK, phone_e164 UQ, username UQ, display_name, about, avatar_url,
      avatar_color, last_seen_at, created_at, updated_at)

verification_codes(id PK, phone_e164, code_hash, expires_at, consumed_at, attempts,
      created_at)                                idx(phone_e164, expires_at)

auth_sessions(id PK, user_id FK, refresh_token_hash UQ, user_agent, created_at,
      last_used_at, expires_at, revoked_at)      idx(user_id)

contacts(owner_id FK, contact_user_id FK, nickname, created_at,
      PK(owner_id, contact_user_id), CHECK owner_id <> contact_user_id)

conversations(id PK, type CHECK('direct','group'), name, description, avatar_url,
      created_by FK,
      direct_key UQ,          -- 'minUserId:maxUserId' for direct, NULL for group
      last_seq,               -- seq allocator
      last_message_id,        -- denormalised list preview
      last_activity_at, disappear_seconds, created_at, updated_at)
      idx(last_activity_at)

conversation_members(conversation_id FK, user_id FK, role CHECK('admin','member'),
      joined_at, left_at, last_read_seq, last_delivered_seq, unread_count,
      muted_until, is_pinned, is_archived,
      PK(conversation_id, user_id), idx(user_id, left_at))

messages(id PK,             -- ULID: time-sortable, no central sequence
      conversation_id FK, seq, sender_id FK,     -- NULL sender ⇒ system message
      kind CHECK('text','media','system'), body, system_event JSON,
      reply_to_id FK, client_message_id,
      created_at, edited_at, deleted_at, expires_at,
      UQ(conversation_id, seq),
      UQ(sender_id, client_message_id),
      idx(conversation_id, seq), idx(expires_at))

attachments(id PK, message_id FK NULL, uploaded_by FK, kind, url, mime_type,
      size_bytes, width, height, created_at)     idx(message_id)

reactions(message_id FK, user_id FK, emoji, created_at,
      PK(message_id, user_id))
```

### Invariants the database enforces, not just the code

| Constraint | What it prevents |
|---|---|
| `UQ(conversations.direct_key)` | Two simultaneous "message this person" taps creating two threads. The loser of the race gets an integrity error and reuses the winner's. |
| `UQ(messages.conversation_id, seq)` | A duplicate position, which would break `seq` as a cursor. |
| `UQ(messages.sender_id, client_message_id)` | A retried send — including one replayed from the offline outbox — becoming a duplicate message. |
| `PK(reactions.message_id, user_id)` | More than one reaction per person per message (Signal's rule: reacting again replaces). |
| `CHECK` on every enum column | `'banana'` in a status column. SQLAlchemy leaves enums unconstrained unless `create_constraint=True`. |
| `CHECK owner_id <> contact_user_id` | Adding yourself as a contact. |

### Deliberate denormalisations

- `conversations.last_message_id` + `last_activity_at` — the conversation list is one
  join instead of a correlated subquery per row.
- `conversation_members.unread_count` — incremented for other members inside the send
  transaction, recomputed on read. Trades an O(members) write for avoiding an
  O(messages) count on every list load. The cursors remain the source of truth if the
  two ever disagree. At very large group sizes this write is what you would move to a
  per-member fanout queue.

### Design notes

- **Soft deletes.** A deleted message keeps its row and its `seq`; hard-deleting would
  punch a hole in the sequence that gap recovery relies on.
- **Departures, not removals.** Leaving a group sets `left_at` rather than deleting the
  membership, so a departed member's messages keep a resolvable author.
- **Timestamps are timezone-aware UTC**, normalised by a `UtcDateTime` type decorator.
  SQLite discards offsets, so without it a value written as aware reads back naive and
  raises `TypeError` on comparison — a bug that only appears in the dialect production
  runs.

---

## API overview

Base path `/api/v1`. Full interactive reference at `/docs`.

Conventions: cursor pagination throughout (never offset), one error envelope
`{"error": {"code", "message", "details"}}`, bearer access tokens, and every response
is a Pydantic model so the OpenAPI schema is accurate enough to generate the frontend's
types from.

### Auth
| Method | Path | Notes |
|---|---|---|
| `POST` | `/auth/request-otp` | Rate limited, 5/min per IP |
| `POST` | `/auth/verify-otp` | Returns a session, or a registration token if the number is new |
| `POST` | `/auth/register` | Exchanges the registration token for an account |
| `POST` | `/auth/refresh` | Rotates the refresh token |
| `POST` | `/auth/logout` | Revokes one device |

### Users and contacts
`GET|PATCH /users/me` · `GET /users?search=` · `GET|POST /contacts` ·
`DELETE /contacts/{user_id}`

### Conversations
`GET|POST /conversations` · `GET|PATCH /conversations/{id}` ·
`GET|POST /conversations/{id}/members` ·
`PATCH|DELETE /conversations/{id}/members/{member_id}`

### Messages
`GET|POST /conversations/{id}/messages` · `POST /conversations/{id}/read` ·
`POST /conversations/{id}/delivered` · `DELETE /messages/{id}` ·
`PUT|DELETE /messages/{id}/reaction`

### Attachments
`POST /attachments/upload-url` · `POST /attachments`

Uploads never pass through the API. `POST /attachments/upload-url` validates the
declared type and size, then returns a short-lived signed URL the browser uploads
to directly; `POST /attachments` records the result. The server re-reads the object's
real size and MIME type from storage rather than trusting what the client declared,
so the recorded metadata always describes the bytes that actually landed. The API
process never buffers a file, which matters on a 512MB instance where a single
large request would otherwise be an OOM kill.

With `STORAGE_BACKEND=local` the ticket points at `PUT /attachments/local/{name}`,
which streams the body and aborts past the cap — the same contract, so the client
has one code path in both environments.

### Other
`GET /search?q=` · `GET /health` · `GET /ready`

### Authorization

Non-members receive **404, not 403**, for conversations they are not in — a 403 would
confirm the conversation exists. Group admin actions (add, remove, promote, rename)
are enforced in the service layer; the UI hides the controls, but the check that
matters is server-side.

---

## Realtime protocol

`GET /ws?token=<access token>`. Envelope: `{type, sent_at, payload}`.

| Direction | Events |
|---|---|
| server → client | `message.created`, `message.deleted`, `message.reaction`, `receipt.updated`, `typing.updated`, `presence.updated` |
| client → server | `typing`, `ack.delivered`, `ping` |

The `message.created` payload is serialised from the same `MessageOut` schema the REST
API returns, so the two shapes cannot drift.

**Gap recovery.** The client reconnects with exponential backoff and jitter. On every
open it refetches the conversation list and replays each open thread with
`?after_seq=<newest seq>`. This is what closes the sub-millisecond window between a
socket completing its handshake and being registered server-side.

---

## Verification

```
npm run verify        # ruff + ruff-format + mypy --strict + pytest, and eslint + tsc
```

**134 backend tests.** The ones worth knowing about:

- Concurrent sends produce a gapless `seq` (`test_messages.py`)
- The same `client_message_id` twice yields one row, and does not burn a sequence number
- A duplicate-DM race hits the unique index rather than creating two threads
- Replaying a rotated refresh token revokes every session for that account
- Search never leaks messages from conversations you are not in
- An attachment cannot be claimed twice, or claimed by someone who did not upload it
- An upload token is bound to one object name, and an object registers only once
- Registered size comes from storage, so a client understating its file changes nothing
- Migrations match the models (`compare_metadata` finds zero drift)

**Browser checks** drive real Chromium against both servers. These exist because
assertions on JSON cannot tell you the UI is right:

| Script | Proves |
|---|---|
| `check:ui` | Auth flow, session survives reload, sign-out is enforced |
| `check:shell` | Conversation list, nav rail, server-side search, dark mode |
| `check:realtime` | **Two independent browser sessions**: presence, typing, live delivery, ticks advancing to read |
| `check:groups` | Group creation, admin promote/remove, leaving |
| `check:bonus` | Reactions, quoted replies, delete, phone layout, shortcuts |
| `check:attachments` | Upload, send, receipt over WebSocket, file actually served |
| `check:pwa` | Manifest installability, service worker, **offline send → IndexedDB → reconnect → delivered** |

**Infrastructure claims are tested, not asserted:**

```bash
npm run check:pg          # migrates + seeds + reverses on real Postgres
npm run check:redis       # two uvicorn workers; a message published by worker 1
                          # reaches a socket held by worker 2
npm run check:litestream  # the durability drill, below
```

### The durability drill

The whole point of Litestream is the claim "SQLite survives a destroyed disk". That is
too important to leave as an assertion, so `check:litestream` proves it against a local
S3 (MinIO):

```
ok  object storage is up with an empty bucket
ok  the API started and replicated to the bucket
ok  created an account (+15550994099) that exists only in this database
ok  destroyed the container, taking its disk with it
ok  the account survived on a brand new container, restored from the replica
SQLite survives a destroyed disk: Litestream restore-on-boot works.
```

It requires the image first: `docker build -t signal-api:test backend`.

---

## Deployment

Frontend on **Vercel**, backend on **Render** (Docker), database durability via
**Litestream** to any S3-compatible bucket (Supabase Storage works and needs no credit
card; Cloudflare R2 requires one).

### Backend (Render)

`render.yaml` is a Blueprint — point Render at the repo and it reads it. Set the
secrets marked `sync: false`:

| Variable | Value |
|---|---|
| `CORS_ORIGINS` | `["https://<your-app>.vercel.app"]` |
| `PUBLIC_BASE_URL` | `https://<your-api>.onrender.com` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | From Supabase → Project Settings |
| `SUPABASE_S3_ENDPOINT` | `https://<ref>.supabase.co/storage/v1/s3` |
| `LITESTREAM_ACCESS_KEY_ID` / `LITESTREAM_SECRET_ACCESS_KEY` | Supabase → Settings → Storage → S3 access keys |

`JWT_SECRET` is generated by Render. The entrypoint restores from the replica if the
disk is empty, runs migrations, then execs uvicorn under `litestream replicate`.

**`CORS_ORIGINS` must contain the exact frontend origin.** A browser treats
`localhost` and `127.0.0.1` as different origins — this bit me locally and would take
the whole app down in production.

### Frontend (Vercel)

Root directory `frontend`. Set `NEXT_PUBLIC_API_URL` to the Render URL. The build
script is `next build --webpack` because `@serwist/next` hooks webpack only; under
Turbopack no service worker is emitted.

### Keeping the demo awake

Render's free tier sleeps after 15 minutes idle; the first request afterwards waits
30–60s. `.github/workflows/keep-warm.yml` pings `/health` every 10 minutes — set the
repository variable `DEMO_API_URL` to enable it, and delete the workflow when the demo
is over.

---

## Scaling notes

This section is about where the design actually breaks, not where it is comfortable.

**SQLite has exactly one writer, and Litestream requires every writer to share one
filesystem.** Production is therefore *deliberately* single-node with one uvicorn
worker and the in-process event bus. Adding workers buys nothing while the database is
the bottleneck.

What is built anyway, because it is what breaks first when you do scale out:
WebSocket connections live in one process's memory. Services publish to an `EventBus`
and never touch a socket, so nothing in the business layer is coupled to process
locality. `RedisBus` is a real second implementation, selected by env var, and
`npm run check:redis` proves cross-worker delivery with two live workers.

The path off this box is two config values and no code change:

1. Point `DATABASE_URL` at Postgres — proven by `npm run check:pg`, which runs the
   migrations and the ORM seed against real Postgres on every invocation
2. Set `EVENT_BUS=redis`
3. Raise the worker count

**Known ceilings, honestly:**

- **Search uses `ILIKE '%term%'`**, which cannot use an index — every search scans your
  conversations' messages. It is the only formulation that stays dialect-neutral
  (SQLite needs FTS5, Postgres needs `tsvector`, and they share no syntax). At scale
  you add a per-dialect index and lose the single-schema property.
- **Unread counters are O(members) writes per message.** Fine to thousands; beyond
  that, move to a per-member fanout queue.
- **Presence and typing are in-memory.** They evaporate on restart, which is correct
  for ephemeral state, but with multiple workers presence needs the Redis bus to be
  accurate.
- **Litestream is replication, not high availability.** Recovery is restore-on-boot.
  It is not a cluster and is not presented as one. Replication is asynchronous, so a
  loss window is inherent rather than a tuning oversight: a graceful shutdown flushes
  outstanding WAL frames and loses nothing, but an ungraceful kill can lose up to one
  `sync-interval` — set to 1s here. Closing that window entirely would require
  synchronous replication, which means a different database and more than one node.
- **Attachments are not replicated.** Litestream covers the database only. With
  `STORAGE_BACKEND=local` on an ephemeral host, uploaded files vanish on redeploy —
  which is why production should use `supabase`.

---

## Assumptions

Things deliberately mocked or scoped out, and why.

- **Encryption is simulated.** The brief asks for the Signal *experience*, not the
  Signal *protocol*. Messages are stored in plain text. No key exchange, no sealed
  sender, no safety numbers.
- **Phone verification is mocked.** Any number, code `123456`. The challenge is still
  persisted, hashed with Argon2, expiring, single-use, and rate limited — so the flow
  has the same failure modes a real one would.
- **Tokens live in `localStorage`.** An httpOnly refresh cookie is stronger, but the
  frontend and backend are on different origins, making it a *third-party* cookie —
  which browsers are actively killing. Consequence: no SSR-authenticated rendering, so
  the chat shell is client-rendered.
- **Refresh tokens are opaque and hashed with SHA-256**, not Argon2. They are already
  256 bits of randomness, so slow hashing buys nothing, and a deterministic digest is
  what allows a single indexed lookup instead of a scan.
- **Presence is approximate.** Online means "has an open socket on this worker".
- **Voice and video calls, stories, and linked devices are placeholders**, as the brief
  permits.
- **Disappearing messages are not implemented.** The schema carries
  `conversations.disappear_seconds` and `messages.expires_at`, and sends already set
  the expiry, but there is no sweeper and no UI to configure the timer.
- **Web Push is not implemented.** In-app toasts cover notifications; a real push
  subscription needs VAPID keys and a push service.

---

## Repository layout

```
backend/
  app/
    api/v1/      routers, one module per resource
    core/        config, security, errors, deps, logging, rate limiting
    db/          engine + PRAGMAs, declarative base, UtcDateTime
    models/      SQLAlchemy models
    realtime/    connection registry, EventBus (in-process + Redis), /ws handler
    schemas/     Pydantic request/response models
    services/    business logic and transaction boundaries
    seed.py
  alembic/       migrations
  scripts/       verification tools (check_pg, check_redis, browser checks, icons)
  tests/         134 tests
frontend/
  src/app/       App Router: (auth), (app)/chats, calls, stories, settings, sw.ts
  src/components/  layout/, chat/, modals/, ui/
  src/lib/       api (generated types + client), store (zustand), ws, offline, design
```
