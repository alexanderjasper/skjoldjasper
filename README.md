# skjoldjasper

Monorepo for a SvelteKit app with Supabase Auth, Postgres + pgBackRest backups, and a CQRS/ES foundation using Drizzle ORM.

## Layout

- `apps/web` — SvelteKit + Tailwind, Supabase Auth (GitHub), debugging ready for Cursor
- `packages/shared` — Shared TypeScript utilities and zod schemas
- `packages/db` — Drizzle config, schema, migrations and DB scripts
- `infra` — Docker Compose for Postgres and pgBackRest, backup scripts
- `PLAN.md` — living checklist for implementation

## Quickstart

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

Env: copy `apps/web/env.example` to `apps/web/.env` and set your Supabase values

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

Debugging in Cursor:
- Added `.vscode/launch.json` → "SvelteKit Dev (inspect)"; or run `pnpm --dir apps/web dev:inspect`
- Set breakpoints inside `<script>` blocks for reliable binding

## Auth (Supabase)

- Create a Supabase project → Settings → API → copy Project URL and anon key to `apps/web/.env`
- Enable GitHub provider and set callback:
  - Callback URL: `https://<project-ref>.supabase.co/auth/v1/callback`
  - Paste GitHub OAuth Client ID/Secret into Supabase

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

What it does: restores latest backup into a throwaway volume, boots a temp Postgres, waits for readiness, cleans up.

## Scripts

- Root: `dev:db`, `dev:stack`, `tunnel:up`, `compose:down`
- `packages/db`: `migrate:push`, `test:roundtrip`
- `infra/scripts/pgbackrest-backup.sh` — run full/diff backups
- `infra/scripts/pgbackrest-restore-smoke.sh` — restore validation

## Notes

- Postgres is published on host `localhost:5433` for local tooling (Azure Data Studio, psql, etc.) with credentials from `infra/.env`.
- See `PLAN.md` for the current roadmap and verification steps.


