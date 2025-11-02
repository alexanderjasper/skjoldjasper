## skjoldjasper — Project Plan (Checklist)

This is the execution checklist. Steps are atomic, use CLI scaffolding where possible, and include a clear verification. Pause after each step for review before proceeding.

Verification protocol: Cursor runs the required commands/processes and tells the user what to look for; the user verifies and may stop long‑running processes. Cursor proceeds after user confirmation.

## Architecture (brief)
- Frontend: SvelteKit + TypeScript + Tailwind
- Auth: Supabase Auth (OAuth + magic links)
- Database: Self-hosted Postgres (Docker), private network
- Event store: Append-only `events` table (Drizzle)
- Snapshots: `aggregate_snapshots` for fast rebuilds
- Projections: Read-model tables (+ optional materialized views)
- Realtime games: Colyseus WebSocket rooms (turn-based)
- Backups: pgBackRest to Cloudflare R2 (S3)
- Exposure: Cloudflare Tunnel for HTTP and WS only

---

## Prerequisites / Environment
- Node.js ≥ 20 (current local: Node 22)
- pnpm via Corepack (run `corepack enable` + prepare latest)
- Orbstack (Docker engine + Docker Compose v2 compatible)
- Cloudflare account (for R2 + Tunnel)
- Supabase project (to be created for Auth-only)
- OAuth providers: later, create GitHub and Google OAuth credentials (client ID/secret) and plug into Supabase when wiring Auth

Notes:
- We’ll use newest stable versions during setup.
- Orbstack fully supports `docker compose` used below.

## Checklist

- [x] 0) Save PLAN.md (this file)
  - Verify: PLAN.md committed at repo root

- [x] 1) Initialize repo tooling in current folder (skjoldjasper)
  - Commands:
    ```bash
    corepack enable
    corepack prepare pnpm@latest --activate
    npm init -y
    pnpm add -D turbo
    pnpm dlx turbo@latest init
    ```
  - Verify: `turbo.json` exists; `pnpm -v` works; `npx turbo -v` works; `package.json` has `packageManager`

- [x] 2) Scaffold SvelteKit app via CLI
  - Commands:
    ```bash
    pnpm create svelte@latest apps/web -- --template skeleton
    cd apps/web && pnpm i && cd -
    ```
  - Verify: `pnpm --filter apps/web dev` serves starter page

- [x] 3) Add Tailwind via svelte-add
  - Commands:
    ```bash
    cd apps/web
    npx svelte-add@latest tailwindcss
    pnpm i
    cd -
    ```
  - Verify: Tailwind classes render (e.g., background colors)

- [x] 4) Docker Compose: Postgres + pgBackRest sidecar
  - Actions: Add `infra/docker-compose.yml` with Postgres service and pgBackRest sidecar sharing data volume; Postgres NOT exposed to the internet
  - Verify: `docker compose up` shows Postgres healthy

- [x] 5) Configure Cloudflare R2 and pgBackRest repo
  - Actions: Create R2 bucket + access keys; configure pgBackRest S3 settings; set Postgres GUCs (`wal_level=replica`, `archive_mode=on`, `archive_command='pgbackrest --stanza=main archive-push %p'`)
  - Verify: `pgbackrest --stanza=main info` shows stanza `main` (check may require DB socket; optional to run `check` inside the DB container)

- [x] 6) Initial full backup + scheduling
  - Commands:
    ```bash
    pgbackrest --stanza=main --type=full backup
    # Add cron: weekly full (Sun 02:00), daily diff (Mon–Sat 02:00)
    ```
  - Verify: Backup objects visible in R2; `pgbackrest info` shows repo and latest backup

- [x] 7) Restore smoke test (throwaway container)
  - Actions: Start ephemeral Postgres, perform `pgbackrest backup-fetch` and recovery to LATEST or target time
  - Verify: DB starts successfully from restored data; PITR proven

- [x] 8) Provision Supabase for Auth only; configure env in web
  - Actions: Enable GitHub, Google, Magic Link; copy `apps/web/env.example` to `apps/web/.env` and fill `PUBLIC_SUPABASE_URL` + anon key
  - Verify: Dev server loads env without errors (`pnpm --filter apps/web dev`)

- [x] 9) Wire Supabase Auth (minimal OAuth button)
  - Commands:
    ```bash
    pnpm -w add @supabase/supabase-js @supabase/auth-helpers-sveltekit
    ```
  - Verify: Clicking “Sign in with GitHub” completes OAuth and returns logged-in

- [x] 10) Create shared package for types/zod
  - Actions: Scaffold `packages/shared` with TypeScript + zod; `tsc` build
  - Verify: `pnpm --dir packages/shared build` succeeds

- [x] 11) Initialize Drizzle in `packages/db`
  - Actions: Scaffold package; add `drizzle.config.ts`, `src/schema.ts`; install deps
  - Verify: `pnpm --dir packages/db drizzle-kit --help` succeeds

- [x] 12) Create migrations: `events` and `aggregate_snapshots`; apply to local Postgres
  - Actions: Define schemas in Drizzle; run `pnpm drizzle-kit generate` and apply via a small runner script
  - Verify: Tables exist in DB

- [ ] 13) Minimal append-only event API in SvelteKit
  - Actions: Endpoint with zod validation + Drizzle; optimistic concurrency on `(stream_id, version)`
  - Verify: `curl POST /api/events` returns 201; row appears in `events`

- [ ] 14) Scaffold Colyseus server via CLI
  - Commands:
    ```bash
    pnpm dlx create-colyseus-app apps/game-server
    pnpm --filter apps/game-server i
    ```
  - Verify: `pnpm --filter apps/game-server dev` exposes WS; health route OK

- [ ] 15) Demo room (turn-based counter)
  - Actions: Implement join/turn/increment; server-authoritative state
  - Verify: Two browser tabs see synchronized counter and alternating turns

- [ ] 16) Persist moves as events; restore via snapshot + tail
  - Actions: On valid move, append `MovePlaced`; create snapshot every 25 events; on room start, load snapshot then apply tail events
  - Verify: DB shows moves; room restart is fast and uses snapshot

- [ ] 17) Projector worker scaffold
  - Commands:
    ```bash
    mkdir -p apps/projector && cd apps/projector
    npm init -y && pnpm add pg drizzle-orm tsx zod dotenv
    ```
  - Verify: `tsx src/index.ts` connects to DB

- [ ] 18) Implement projector for `game_room_view`
  - Actions: Poll new events; idempotently upsert `game_room_view`
  - Verify: View updates after moves; reruns don’t double-apply

- [ ] 19) Optional: materialized view for room list + concurrent refresh
  - Actions: Create `game_room_list_mv`; `REFRESH MATERIALIZED VIEW CONCURRENTLY` from projector or cron
  - Verify: MV reflects latest state after refresh; refresh is non-blocking

- [ ] 20) Frontend room UI (create/join) + list from projection
  - Actions: Pages for create/join; list rooms from `game_room_view`/MV; subscribe to UI broadcasts if exposed
  - Verify: Creating a room appears immediately; joining works and state syncs

- [ ] 21) Dockerize web, game-server, projector; Compose
  - Actions: Add Dockerfiles for each app; update `infra/docker-compose.yml` to run all services with a private network to Postgres
  - Verify: `docker compose up` shows all services healthy

- [ ] 22) Cloudflare Tunnel config
  - Actions: Map HTTP (web) and WS (game-server) to public routes; keep Postgres private
  - Verify: External access to site and WS works

- [ ] 23) Telemetry + basic CORS/rate limits
  - Actions: Add Sentry DSN; set CORS allowlist; simple rate limiting on APIs/WS
  - Verify: Test error appears in Sentry; CORS blocks bad origins

- [ ] 24) Final docs and scripts
  - Actions: `README`, `pnpm dev` scripts, `.env.example`
  - Verify: Fresh clone can run dev with minimal steps


