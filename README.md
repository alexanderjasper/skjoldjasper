# skjoldjasper

Monorepo for a SvelteKit app Postgres + pgBackRest backups, and a CQRS/ES
foundation using Drizzle ORM.

## Layout

- `apps/` — every bounded context (web, projector, game-server). Domain logic stays here.
    - `apps/web` — SvelteKit + Tailwind, hosts finance domain logic
      under `src/lib/server`
    - `apps/projector` — applies events into read models per context (finance handler, etc.)
    - `apps/game-server` — Colyseus server; game rules/rooms live here, not in shared packages
- `packages/` — infrastructure-only shared libraries (database primitives, generic config, rate
  limiting). **Never add domain-specific schemas or logic here.**
    - `packages/shared` — Shared TypeScript utilities and zod schemas that are domain-agnostic
    - `packages/db` — Drizzle config, schema, migrations, DB scripts (event store + snapshots)
- `infra/` — Docker Compose for Postgres and pgBackRest, backup scripts and tunnels
- `PLAN.md` — living checklist for implementation

### Architecture principles

1. **Domain-first organization.** All business logic, aggregates, commands, queries, and projections
   belong to their owning app under `apps/`. Keep UI adapters (`routes/*`) thin and delegate to
   domain modules in `apps/web/src/lib/server/<context>`.
2. **Shared code stays generic.** `packages/*` must remain free of finance/game-specific
   concepts—only primitives (db clients, config, ids, events helpers).
3. **Separated read/write paths.** Event-sourced writes live beside their context (e.g.,
   `apps/web/src/lib/server/finance`). Projector handlers per context sit in
   `apps/projector/src/handlers/<context>`.

### Modellen (Family Finance)

- Purpose: budgets, hierarchical categories with yearly targets, CSV imports, transaction splits,
  notes, budget vs actual, family sharing
- Architecture: event-sourced writes, snapshot-based reads via a projector
- Domain location: `apps/web/src/lib/server/finance` (domain logic) and
  `apps/projector/src/handlers/finance/budget.ts` (projection)
- UI: `apps/web/src/routes/modellen` with APIs under `apps/web/src/routes/api/budgets`
- See also: `apps/web/src/lib/server/finance/README.md` (overview) and `@general-info.mdc` (project
  structure and domain boundary guidance)

## Quickstart

### Local Development (macOS/Linux)

```bash
# Install deps for working packages on demand
pnpm --dir packages/shared install && pnpm --dir packages/shared build
pnpm --dir packages/db install

# Start database locally (exposed on host 5433)
docker compose -f infra/docker-compose.yml up -d postgres

# Configure db package
cp packages/db/env.example packages/db/.env
pnpm --dir packages/db migrate:push

# Web dev (with debugger)
pnpm --dir apps/web dev   # or use the "SvelteKit Dev (inspect)" launch config

# Run full stack locally (web + game-server + projector)
pnpm dev

# Validate required env
pnpm** check:env
```

### Windows Server Deployment

```powershell
# From project root
Copy-Item infra\env.example infra\.env
Copy-Item apps\web\env.example apps\web\.env
Copy-Item apps\game-server\env.example apps\game-server\.env
Copy-Item packages\db\env.example packages\db\.env

# Edit the .env files, then:
.\infra\deploy-windows.ps1

# After git pull:
.\infra\update-windows.ps1
```

### Dev stack via Docker Compose

```bash
# 1) Database
pnpm dev:db

# 2) Set envs
cp apps/web/env.example apps/web/.env
cp apps/game-server/env.example apps/game-server/.env
# Optional: Sentry
# export SENTRY_DSN=...

# For public WS through Cloudflare Tunnel (optional)
# Set in apps/web/.env: PUBLIC_GAME_SERVER_WS=wss://ws.<your-domain>
# Set in apps/web/.env: ALLOWED_ORIGINS=http://localhost:5173,https://app.<your-domain>

# 3) Start web + game-server + projector
pnpm dev:stack

# 4) Optional: start Cloudflare Tunnel (token mode)
# Put CLOUDFLARED_TUNNEL_TOKEN in infra/.env, then:
pnpm tunnel:up
```

Endpoints:

- Web: http://localhost:5173/rooms
- Game server: http://localhost:2567/

```

## Web (apps/web)

Debugging in Cursor:
- Added `.vscode/launch.json` → "SvelteKit Dev (inspect)"; or run `pnpm --dir apps/web dev:inspect`
- Set breakpoints inside `<script>` blocks for reliable binding

## Database (packages/db)

Schema: multi-context event store with snapshots

- `events(position, event_id, context, stream_category, stream_id, version, type, payload jsonb, metadata jsonb, created_at)`
  - Unique: `(stream_id, version)`, `event_id`
  - Indexes: `(context, stream_category, created_at)`, `(stream_id)`, `(type)`
- `aggregate_snapshots(context, stream_category, stream_id, version, payload jsonb, created_at)`
  - Unique: `(context, stream_category, stream_id, version)`

Commands:

```bash
# Apply schema to local Postgres
pnpm --dir packages/db migrate:push

# Simple integration test (inserts one event and reads it back)
pnpm --dir packages/db test:roundtrip
```

## Infra (Postgres + pgBackRest)

Create `infra/.env` from `infra/env.example`, then:

```bash
# Start Postgres
docker compose -f infra/docker-compose.yml up -d

# Health
docker compose -f infra/docker-compose.yml ps

# Stop
docker compose -f infra/docker-compose.yml down -v
```

Backups to Cloudflare R2 (configure first in `infra/.env`):

```bash
# Create stanza and verify
docker compose -f infra/docker-compose.yml --env-file infra/.env run --rm pgbackrest \
  pgbackrest --stanza=main stanza-create

docker compose -f infra/docker-compose.yml --env-file infra/.env run --rm pgbackrest \
  pgbackrest --stanza=main info

# Initial full backup
./infra/scripts/pgbackrest-backup.sh full
```

Restore smoke test (ephemeral):

```bash
./infra/scripts/pgbackrest-restore-smoke.sh
```

What it does: restores latest backup into a throwaway volume, boots a temp Postgres, waits for
readiness, cleans up.

## Add a new bounded context/app

- Define events:
    - Use `packages/shared/eventAppendSchema` for shape; append via
      `appendEvent(pool, dto, metadata)`.
- Project state:
    - Create a handler in `apps/projector/src/handlers/<context>/<category>.ts` implementing
      `ensureSchema` and `apply`.
    - Add it to `handlers` in `apps/projector/src/index.ts`.
- Consume in web:
    - Query projection tables via `getPool()` from `@skjoldjasper/db`.
- Rate limit:
    - Use `createTokenBucket` from `@skjoldjasper/shared`; read caps from `getServerConfig()`.
- CORS:
    - Use `buildCorsHeaders` and `buildPreflightHeaders` from `@skjoldjasper/shared` with
      `allowedOrigins` from config.

## Scripts

- Root: `dev`, `check:env`, `dev:db`, `dev:stack`, `tunnel:up`, `compose:down`
- `packages/db`: `migrate:push`, `test:roundtrip`
- `infra/scripts/pgbackrest-backup.sh` — run full/diff backups
- `infra/scripts/pgbackrest-restore-smoke.sh` — restore validation

## Notes

- Postgres is published on host `localhost:5433` for local tooling (Azure Data Studio, psql, etc.)
  with credentials from `infra/.env`.
- See `PLAN.md` for the current roadmap and verification steps.


