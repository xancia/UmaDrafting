# UmaDraft Architecture Review And Systems Design Report

## Executive Summary

The current app is a strong interactive frontend for a 2-party draft, but it is not yet a trustworthy competitive platform for authenticated 10-player matches.

Today the system is:

- A static Vite/React app deployed to GitHub Pages (`deploy.js`, `package.json`)
- A Firebase Realtime Database client with anonymous auth and client-driven room state (`src/config/firebase.ts`, `src/services/firebaseRoom.ts`)
- A mostly client-authoritative draft engine centered in `src/components/Draft5v5.tsx`
- A read-only leaderboard viewer in-app, with leaderboard writes apparently happening outside this repo
- A legacy codebase that still contains unused PeerJS-era multiplayer hooks alongside the newer Firebase path

My recommendation is:

- Keep the existing React frontend and most of the presentational draft UI
- Introduce a real authoritative backend as a single TypeScript service, not microservices
- Move identity to Discord OAuth
- Move durable competitive data to PostgreSQL
- Use WebSockets for authoritative live room state
- Use Redis only for ephemeral matchmaking/presence/locks
- Treat Firebase as transitional infrastructure, not the long-term core

Most important product recommendation:

- For the first 10-player version, let all 10 players join the match room, but keep drafting permissions limited to one designated drafter/captain per team

That gives you the social and operational benefits of "the great unifier" without forcing a complete redesign of the draft rules and UI at the same time.

## What The Current App Does Well

- The draft UX is already rich and tournament-oriented.
- The 5v5 flow has a mature phase model, timer logic, spectator view, room codes, and match reporting.
- The current two-team draft rules are already deeply encoded and usable.
- The app already has the concept of waiting rooms, spectators, ready states, room codes, and match summaries.
- The UI is already close to what a competitive room client needs.

That means the frontend is not the hard part. Trust, identity, persistence, and room orchestration are the hard parts.

## Current-State Findings

### 1. The app is frontend-heavy and client-authoritative

The central runtime is `src/components/Draft5v5.tsx`. Draft progression, timeout handling, phase changes, ready checks, and result confirmation all live primarily in the client.

Relevant areas:

- Initial multiplayer state and local authority assumptions: `src/components/Draft5v5.tsx`
- Turn timeout logic: `src/components/Draft5v5.tsx`
- Firebase room bootstrap and sync behavior: `src/components/Draft5v5.tsx`
- Host-side pending action handling: `src/components/Draft5v5.tsx`
- Match reporting and confirmation: `src/components/Draft5v5.tsx`

This works for trusted players, but it is not strong enough for a competitive platform where identity, permissions, and auditability matter.

### 2. Authentication is anonymous, not user identity

The room service signs users in anonymously through Firebase (`src/services/firebaseRoom.ts`, `signInAnonymouslyIfNeeded`).

Implications:

- No durable player identity tied to Discord
- No trustworthy player account model
- Reconnection authority depends on the browser retaining the same anonymous Firebase identity
- If local auth state is lost, the host may fail to reclaim a room

That is a direct blocker for persistent player history, secure matchmaking, and result integrity.

### 3. Authority is based on convention, not enforceable backend trust

The code assumes "host is authoritative", but that is an application convention. It is not a real server authority model.

Examples:

- Full room draft state is written from the client with `updateDraftState` (`src/services/firebaseRoom.ts`)
- Non-hosts send actions into `pendingActions` and the host client processes them (`src/services/firebaseRoom.ts`)
- `useFirebaseRoom` explicitly notes that the caller is responsible for ensuring they are the host before updating draft state (`src/hooks/useFirebaseRoom.ts`)

If Firebase rules are permissive or incorrectly configured, malicious clients can write state or inject actions directly.

I did not find Firebase security rules in this repo, so I cannot confirm whether the backend currently protects these writes.

### 4. Spectator and client action trust is too loose for a competitive system

The host processes pending actions from Firebase in the client (`src/components/Draft5v5.tsx`) and does not appear to perform a strong server-side permission validation model tied to durable roles.

Practical concern:

- If a spectator or manipulated client can write into `pendingActions`, the host client may attempt to process that action

This is survivable in a friendly environment. It is not a foundation for in-app competitive matchmaking.

### 5. Match result persistence is incomplete in-repo

The app supports reporting and confirming results in the draft UI, but I do not see in-repo code that writes ratings or durable player match history.

What I do see:

- Leaderboard read path only: `src/services/leaderboard.ts`, `src/components/Leaderboard.tsx`
- Match reporting UI and confirmation flow in `src/components/Draft5v5.tsx`

What I do not see:

- In-repo leaderboard write/update logic
- In-repo ratings job
- In-repo durable match entity with player participation records

This matches your description that the current result pipeline depends on an external Discord bot/backend process.

### 6. The current multiplayer model is still fundamentally "2 active actors"

The current 5v5 online system is built around:

- Host = `team1`
- One joining player = `team2`
- Everyone else = spectator

This is hardcoded across:

- Room limits: `src/config/multiplayer.ts`
- Join logic: `src/services/firebaseRoom.ts`
- Waiting room UI and player counts: `src/components/WaitingRoom.tsx`
- Draft state local team assumptions: `src/components/Draft5v5.tsx`

This is the biggest structural gap between the current app and your ideal.

### 7. 3v3v3 is local-only and not part of the current online architecture

`src/components/Draft3v3v3.tsx` is a local-only stateful component. It does not use the Firebase room system.

That matters because it shows the codebase already mixes:

- A newer Firebase-backed multiplayer flow for 5v5
- A separate local-only format

So format extensibility exists in the UI, but not yet in the backend architecture.

### 8. There is dead or legacy multiplayer infrastructure still in the repo

The repo still contains PeerJS-era hooks and connection utilities:

- `src/hooks/usePeer.ts`
- `src/hooks/useRoom.ts`
- `src/hooks/useDraftSync.ts`
- `src/hooks/useMultiplayerConnections.ts`
- `src/utils/connectionManager.ts`
- `src/utils/messageSerializer.ts`

The current live path appears to be Firebase-based, not PeerJS-based.

This is not an urgent product bug, but it is architectural noise and future migration drag.

### 9. The app has no server deploy path today

Deployment is static site publishing to `gh-pages` (`deploy.js`).

That is fine for the current frontend-only model. It will not be sufficient once you introduce:

- Discord OAuth callbacks
- server-side matchmaking
- server-side room authority
- persistent result processing
- staff/admin workflows

### 10. Test and ops maturity are light

I did not find:

- Automated tests
- CI workflows in `.github`
- Infra-as-code for a backend
- Firebase security rules in-repo

For a casual tool this is fine. For a competitive platform, it becomes risk.

### 11. Bundle and asset footprint are already non-trivial

The generated JS bundle is about 1.4 MB in `dist/assets`, and the overall built output is large because of many static media assets.

This is not the main blocker for your goals, but once you move to 10-player rooms and account-based usage, you will want:

- better code splitting
- stronger caching strategy
- CDN-aware asset delivery

## Core Design Principles For The Next System

The future system should optimize for these principles:

1. Server authority over all competitive state changes
2. Discord-based identity as the canonical user account
3. Durable match and rating history in a real relational database
4. Realtime room state over a server-managed channel
5. Strong auditability for disputes and moderation
6. Minimal operational complexity for a 200-player intermittent community
7. Incremental migration from the current app, not a ground-up rewrite

## Recommended Target Architecture

## Recommendation In One Sentence

Build a single TypeScript backend service with Discord OAuth, PostgreSQL, WebSockets, and Redis-backed ephemeral coordination, while keeping the current React app as the frontend.

## Why This Is The Best Fit

It is the best compromise between:

- least painful migration
- high integrity
- realistic operations for your scale

### Why I do not recommend staying Firebase-only as the long-term core

Firebase is fine for lightweight sync, but your target system needs:

- durable competitive identity
- strict server-side permission enforcement
- scheduled matchmaking
- role-aware room membership
- auditable match/event history
- safe result processing

You can bolt some of this onto Firebase, but it becomes awkward fast, especially once Discord auth and authoritative multiplayer logic enter the picture.

### Why I do not recommend microservices

Your scale does not justify them.

For around 200 sporadic users, the right shape is:

- one backend service
- one relational database
- one cache/ephemeral store
- one worker process or background job subsystem

That is enough.

## Proposed System Components

### Frontend

Keep:

- React
- TypeScript
- most existing draft UI components

Change:

- replace Firebase room authority with WebSocket-driven server snapshots/events
- add authenticated account/session flow
- add queue/matchmaking pages
- add a real player match room for all 10 participants

### Backend API + Realtime Service

Recommended shape:

- Node.js + TypeScript
- Fastify or NestJS
- Socket.IO or raw WebSockets

My preference:

- Fastify + Socket.IO if you want the fastest pragmatic path

Why:

- straightforward TypeScript ergonomics
- easy REST + WebSocket coexistence
- simple deployment
- no unnecessary framework overhead

### Database

Recommended:

- PostgreSQL

Why:

- durable relational model for users, matches, seasons, ratings, disputes
- better fit than Firebase for competitive history and admin tooling
- easier analytics and auditing

### Ephemeral Coordination

Recommended:

- Redis or Valkey

Use it for:

- matchmaking queues
- presence
- short-lived room membership cache
- distributed locks
- timeout scheduling support if needed

Do not use Redis as your system of record.

### Background Jobs

Recommended:

- a lightweight queue worker in the same codebase

Use it for:

- rating recalculation
- Discord notifications
- stale room cleanup
- scheduled block opens/closes
- reminder jobs

### Hosting

Recommended simple setup:

- Frontend: Cloudflare Pages, Vercel, or same backend domain static hosting
- Backend: Fly.io, Render, Railway, or Cloud Run
- Postgres: Neon, Supabase Postgres, Railway Postgres, or managed cloud Postgres
- Redis: Upstash or managed Redis

For lowest ops burden, I would keep this simple and avoid Kubernetes.

## High-Level Domain Model

The backend should model the real competition explicitly.

### Core Entities

`users`

- internal user id
- discord user id
- display name
- avatar
- roles
- created/last seen timestamps

`seasons`

- season id
- active flag
- ruleset version
- rating configuration

`queue_blocks`

- scheduled start/end
- queue type
- region or event scope
- status

`queue_entries`

- user id
- queue block id
- joined at
- readiness/check-in state
- party/team preference if applicable

`matches`

- match id
- season id
- block id
- status
- created by system/staff
- started/completed timestamps
- ruleset version

`match_participants`

- match id
- user id
- team assignment
- role in room
- confirmed participation
- reconnect/session metadata

`draft_rooms`

- match id
- current phase
- current drafter turn
- deadline timestamp
- server snapshot version
- room status

`draft_events`

- append-only event log
- room id
- actor user id
- event type
- payload
- server timestamp
- idempotency key

`draft_snapshots`

- current materialized state
- room id
- version
- serialized current state

`race_results`

- match id
- race number
- submitted by
- payload
- confirmation state
- dispute state
- finalized timestamp

`rating_changes`

- user id
- match id
- season id
- before/after rating
- rd or uncertainty fields

`audit_logs`

- actor
- action
- target entity
- payload
- timestamp

## Roles Model

This is important for minimizing pain.

I recommend these roles inside a match room:

- `captain` or `drafter`: allowed to draft
- `player`: part of the 10 competitors, not allowed to alter draft unless explicitly assigned
- `spectator`: read-only
- `staff`: can intervene, resolve disputes, or remake rooms

The least painful version of your future is not "10 people can draft".
The least painful version is "10 people participate in the room, but only 2 designated drafters control the draft".

That preserves your current draft logic almost entirely.

## Realtime Room Design

## Recommended Authority Model

The server owns:

- room membership
- phase transitions
- timers
- turn order
- pick/ban legality
- ready-state resolution
- match result state machine

Clients are input devices and renderers.

### Message Pattern

Use command/event separation:

- Client sends commands: `join_room`, `lock_in_pick`, `ready_up`, `submit_result`, `confirm_result`
- Server validates and emits events: `player_joined`, `state_updated`, `turn_started`, `deadline_set`, `result_pending`, `result_confirmed`

### State Strategy

Use:

- append-only room event log
- current snapshot/materialized state

This gives you:

- auditability
- replay/debugging
- easier dispute investigation
- safe reconnects

You do not need full event-sourcing purity. You only need:

- authoritative event writes
- a snapshot for fast reconnect

### Timer Strategy

Do not let clients own countdown state.

Instead:

- server sets `turn_deadline_at`
- clients render countdown based on server time offset
- if deadline passes, server performs timeout action

That is the correct model for mixed network quality and competitive integrity.

### Reconnection Strategy

On reconnect:

1. client reconnects authenticated session
2. server verifies match membership
3. server sends latest snapshot plus missed events after client version
4. client resumes from server state

This is much more reliable than today's localStorage + anonymous Firebase identity model.

## Matchmaking Design

You described scheduled blocks on Discord run by staff and volunteers. The app should replace that in stages, not all at once.

## Recommended Matchmaking Approach

### Phase 1 Matchmaking Product

Build:

- scheduled queue blocks
- player check-in
- queue entry list
- backend match suggestions
- staff approval UI

This is the least painful way to unify operations without trusting a fully automated algorithm on day one.

### Phase 2 Matchmaking Product

Once the data is trustworthy:

- allow auto-match creation within block constraints
- allow priority rules by rating spread, wait time, or event bracket

### Why staff-assisted first is correct

Because your current process already depends on staff and volunteers.

A good transition is:

- app suggests
- staff approves
- system creates match room

That lowers operational shock while still moving coordination into the app.

## Result Submission Design

This is one of the most important trust decisions.

## Recommended V1 Result Integrity Model

Do not try to make result entry fully automatic immediately.

Instead:

- one designated reporter per team, or one official match captain
- opposing captain confirms
- all submissions are audit logged
- staff can intervene on disputes

This is close to your current model, but backed by real identity and durable logs.

### Better V2 Additions

Later, optionally add:

- screenshot upload
- OCR assist
- Discord bot relay into backend API
- stronger multi-party confirmation flows

### Important rule

The Discord bot should stop being the direct writer of truth.

If the bot remains in the system, it should call your backend API, and your backend should remain the canonical source of truth.

## Security Model

## Minimum Security Standard For The New System

### Identity

- Discord OAuth as primary login
- internal user id mapped to Discord id
- server-issued session token/cookie

### Authorization

Permissions enforced server-side for every command:

- only room members can join room channels
- only drafters can pick/ban
- only allowed actor can act on the current turn
- only authorized submitter can submit results
- only assigned confirmer can confirm results
- only staff can override

### Integrity Controls

- idempotency keys for player actions
- append-only event log
- server timestamps, not client timestamps, for critical transitions
- optimistic concurrency on room version
- rate limits on commands
- audit logs for all admin/staff actions

### Operational Controls

- structured logging
- room replay/debug tooling
- alerting for repeated failed commands or room desyncs

## Suggested API / Realtime Surface

Example REST endpoints:

- `POST /auth/discord/callback`
- `GET /me`
- `GET /queue-blocks`
- `POST /queue-blocks/:id/join`
- `POST /queue-blocks/:id/leave`
- `GET /matches/:id`
- `GET /leaderboard`
- `POST /matches/:id/report-result`
- `POST /matches/:id/confirm-result`
- `POST /matches/:id/dispute-result`

Example socket channels or rooms:

- `user:{userId}`
- `match:{matchId}`
- `draftRoom:{roomId}`
- `staff:block:{blockId}`

Example socket events:

- `match.snapshot`
- `match.event`
- `draft.command.accepted`
- `draft.command.rejected`
- `room.presence.updated`
- `timer.deadline.updated`

## Recommendation For The Draft Logic Itself

The cleanest migration path is to extract the draft engine into a pure shared domain module.

Today the logic is split between:

- `src/draftLogic.ts`
- a large amount of orchestration inside `src/components/Draft5v5.tsx`

For the future system, the draft engine should become:

- pure reducer/state machine
- deterministic
- reusable by both backend and frontend

The frontend should render it.
The backend should execute it authoritatively.

That is the highest-leverage refactor before a full multiplayer migration.

## Recommended Rollout Plan

## Phase 0: Stabilize The Current Codebase

Before building the new platform, do a small internal cleanup pass:

- identify and remove legacy PeerJS multiplayer code if no longer needed
- isolate current draft state transitions into a reusable pure module
- document current Firebase rules and data shape
- document current Discord bot integration contract

This is not user-facing, but it lowers migration risk.

## Phase 1: Introduce Real Accounts And Durable Competitive Data

Build:

- Discord login
- `users`, `matches`, `match_participants`, `rating_changes`, `seasons`
- leaderboard served from backend
- existing Discord bot writes via backend API instead of direct DB writes

Keep:

- current draft room experience for ongoing operations if needed

This phase gives you identity and durable history first.

## Phase 2: In-App Matchmaking For Scheduled Blocks

Build:

- scheduled block creation
- player check-in
- queue entry list
- staff dashboard
- match suggestion and approval flow

Keep:

- drafting possibly still on current room flow if necessary

This phase moves coordination into the app before full room authority migration.

## Phase 3: Authoritative Match Room For 10 Participants

Build:

- match room with all 10 players present
- captain/drafter roles
- ready checks
- race room code sharing
- spectators
- authoritative timers and phase state

Important:

- only 2 drafters act initially
- all 10 see room state and post-draft workflow

This is the phase where the app becomes the operational center.

## Phase 4: Authoritative Result Workflow

Build:

- in-app result submission
- captain confirmation
- disputes
- audit trail
- rating updates

Retire:

- direct result truth being managed primarily by Discord bot

## Phase 5: Nice-To-Haves

- mobile-specific room UX improvements
- screenshot/OCR assist
- automated notifications to Discord
- richer stats pages
- season history and player profiles

## What I Would Not Do Yet

- I would not build microservices
- I would not build a fully automated anti-cheat system
- I would not make all 10 players active draft controllers
- I would not over-invest in 3v3v3 online support before the 5v5 competitive platform is solid
- I would not keep long-term truth split between Discord bot writes and app writes

## Biggest Current Risks If You Try To Scale The Existing Architecture Directly

1. Trust model risk

The current room system relies heavily on client behavior and Firebase write discipline.

2. Identity risk

Anonymous auth is not enough for a competitive player platform.

3. Reconnect risk

Host identity recovery is fragile.

4. Permissions risk

The code structure assumes only the "right" client will send actions.

5. Operational split-brain risk

Drafting is in the app, but match truth and matchmaking operations live outside it.

6. Maintainability risk

Too much live behavior is concentrated in `Draft5v5.tsx`.

## Concrete Recommendation On "Least Painful And Most Realistic"

If I had to choose the exact path:

1. Keep the existing React frontend and current draft UI.
2. Build one TypeScript backend service.
3. Use Discord OAuth for identity.
4. Put durable competition data in PostgreSQL.
5. Use WebSockets for authoritative room state.
6. Use Redis only for ephemeral coordination.
7. Make the first 10-player version a 10-person room with 2 designated drafters, not 10 drafters.
8. Move staff scheduling/matchmaking into the app as staff-assisted blocks before trying full automation.
9. Move the Discord bot behind your backend API rather than letting it remain an independent source of truth.

That is the path that best balances:

- realism
- integrity
- development effort
- migration safety

## Final Assessment

Your instinct is correct: moving to a real authoritative backend is the key inflection point.

The app already has enough frontend maturity to serve as the future unified client. What it lacks is not UI polish. It lacks:

- trustworthy identity
- server authority
- durable competition data
- operational workflow ownership

If you solve those four things in the order above, the app can become the great unifier without forcing a reckless rewrite.

## Notes On Analysis Scope

This report is based on the code in this repo.

I did not review:

- the external Discord bot code
- the current backend that receives race reports, if separate from this repo
- Firebase security rules, because I did not find them in this repository

Those external pieces should be reviewed before implementation begins, because they may change the migration sequencing.
