## skjoldjasper — Project Plan (Checklist)

This is the execution checklist. Steps are atomic, use CLI scaffolding where possible, and include a clear verification. Pause after each step for review before proceeding.

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

## Checklist

- [ ] 0) Save PLAN.md (this file)
  - Verify: PLAN.md committed at repo root

- [ ] 1) Initialize repo tooling in current folder (skjoldjasper)
  - Commands:
    ```bash
    pnpm init -y
    npx turbo init --no-install
    ```
  - Verify: `turbo.json` exists; `pnpm -v` works

- [ ] 2) Scaffold SvelteKit app via CLI
  - Commands:
    ```bash
    pnpm create svelte@latest apps/web -- --template skeleton
    cd apps/web && pnpm i && cd -
    ```
  - Verify: `pnpm --filter apps/web dev` serves starter page

- [ ] 3) Add Tailwind via svelte-add
  - Commands:
    ```bash
    cd apps/web
    npx svelte-add@latest tailwindcss
    pnpm i
    cd -
    ```
  - Verify: Tailwind classes render (e.g., background colors)

- [ ] 4) Docker Compose: Postgres + pgBackRest sidecar
  - Actions: Add `infra/docker-compose.yml` with Postgres service and pgBackRest sidecar sharing data volume; Postgres NOT exposed to the internet
  - Verify: `docker compose up` shows Postgres healthy

- [ ] 5) Configure Cloudflare R2 and pgBackRest repo
  - Actions: Create R2 bucket + access keys; configure pgBackRest S3 settings; set Postgres GUCs (`wal_level=replica`, `archive_mode=on`, `archive_command='pgbackrest --stanza=main archive-push %p'`)
  - Verify: `pgbackrest --stanza=main check` passes

- [ ] 6) Initial full backup + scheduling
  - Commands:
    ```bash
    pgbackrest --stanza=main --type=full backup
    # Add cron: weekly full (Sun 02:00), daily diff (Mon–Sat 02:00)
    ```
  - Verify: Backup objects visible in R2; `pgbackrest info` shows repo and latest backup

- [ ] 7) Restore smoke test (throwaway container)
  - Actions: Start ephemeral Postgres, perform `pgbackrest backup-fetch` and recovery to LATEST or target time
  - Verify: DB starts successfully from restored data; PITR proven

- [ ] 8) Provision Supabase for Auth only; configure env in web
  - Actions: Enable GitHub, Google, Magic Link; add `PUBLIC_SUPABASE_URL` and anon key to `apps/web/.env`
  - Verify: Dev server loads env without errors

- [ ] 9) Wire Supabase Auth (minimal OAuth button)
  - Commands:
    ```bash
    pnpm -w add @supabase/supabase-js @supabase/auth-helpers-sveltekit
    ```
  - Verify: Clicking “Sign in with GitHub” completes OAuth and returns logged-in

- [ ] 10) Create shared package for types/zod
  - Commands:
    ```bash
    pnpm -w create vite@latest packages/shared -- --template vanilla-ts
    pnpm -w add zod
    ```
  - Verify: `pnpm -w build` succeeds for `packages/shared`

- [ ] 11) Initialize Drizzle in `packages/db`
  - Commands:
    ```bash
    mkdir -p packages/db && cd packages/db
    pnpm init -y
    pnpm add drizzle-orm drizzle-kit pg dotenv tsx typescript -D
    ```
  - Verify: `drizzle.config.ts` present; `pnpm drizzle-kit` shows help

- [ ] 12) Create migrations: `events` and `aggregate_snapshots`; apply to local Postgres
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
    pnpm init -y && pnpm add pg drizzle-orm tsx zod dotenv
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


