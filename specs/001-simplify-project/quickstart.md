# Quickstart: Post-Simplification Development Setup

**Branch**: `001-simplify-project` | **Date**: 2026-02-27

## What changed

The projector service (`apps/projector/`) has been removed. The finance domain now uses
direct CRUD tables instead of an event log + snapshot cycle. Docker Compose runs 3 services
by default instead of 4–5.

## Local development

### Start the stack

```bash
cd infra
docker compose up
```

This starts: `postgres` + `web` + `game-server`. The projector no longer runs.

### Optional services

```bash
# Cloudflare tunnel (production/staging only)
docker compose --profile tunnel up

# pgBackRest backup agent (production only)
docker compose --profile backup up
```

### Apply schema migrations

```bash
pnpm --dir packages/db migrate:push
```

This applies the new finance domain tables (`budgets`, `budget_members`, `categories`,
`transactions`, `transaction_splits`, `finance_audit_log`) and game server table
(`game_room_states`), and removes the event sourcing tables.

### Environment variables

`apps/web/.env` — no new variables required. `PUBLIC_GAME_SERVER_WS` remains for the
rooms feature.

## What's gone

- `apps/projector/` directory — deleted
- `events` and `aggregate_snapshots` tables — dropped
- `projector_checkpoints` and `projector_applied_events` tables — dropped
- `POST /api/events` route — deleted
- `appendEvent` / `VersionConflictError` / `eventAppendSchema` exports from
  `@skjoldjasper/shared` — deleted

## Finance domain write pattern (new)

All writes go through route handlers that:

1. Validate the request body with Zod
2. Call a helper in `apps/web/src/lib/server/finance/commands.ts` for business rule
   validation (direct DB reads instead of aggregate loading)
3. Execute SQL INSERT/UPDATE
4. Call `logAudit(pool, entry)` from `audit.ts` to append an audit log entry

## Finance domain read pattern (new)

`apps/web/src/lib/server/finance/queries.ts` contains plain SQL queries against the
normalized tables. No snapshot loading or event replay.

## Game server (simplified)

`MyRoom` persists counter state as a single row in `game_room_states`. On room creation,
it loads the row if it exists. On each increment, it upserts the counter (fire-and-forget).
