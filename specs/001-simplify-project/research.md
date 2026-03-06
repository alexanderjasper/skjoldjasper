# Research: Project Simplification Overhaul

**Branch**: `001-simplify-project` | **Date**: 2026-02-27

## Q1: Service count conflict — FR-005 vs SC-001

**Conflict**: FR-005 states "no more than 2 services for local development"; SC-001 states
"reduced from 5 to 3 (web app + game server + database)". User Story 4 acceptance scenario
says "only 2 services start: postgres and web".

**Decision**: Target **3 services** (postgres + web + game-server).

**Rationale**: SC-001 is the formal, measurable success criterion; User Story 2 explicitly
retains the game server ("The Colyseus framework itself is intentionally kept"). The "2
services" in FR-005 and the Story 4 acceptance scenario are artefacts of the spec draft that
didn't account for the game server. The user input says "remove event sourcing" from the
game server, not remove the game server itself. SC-001 is authoritative.

**What moves**: cloudflared → `profiles: [tunnel]`; pgBackRest already has `profiles:
["backup"]`. Postgres WAL archiving (`wal_level`, `archive_mode`, `archive_command`)
removed from default postgres command, moved to a `docker-compose.prod.yml` override.

---

## Q2: Audit log approach — database trigger vs application-level

**Decision**: **Application-level audit helper** in the finance domain.

**Rationale**:
- Drizzle ORM manages the schema declaratively; PostgreSQL triggers are not expressible in
  Drizzle schema and would require raw migration SQL outside the normal `drizzle-kit push`
  workflow, adding a separate maintenance surface.
- The finance domain already has a clear write boundary (route handlers calling commands) —
  inserting a call to an audit helper at the point of each write is explicit and testable.
- The audit log only needs to capture application-level changes (not schema migrations or
  manual psql edits), which is exactly what application-level logging captures.
- All changes go through TypeScript route handlers, so there is no path that bypasses the
  audit without also bypassing the app's auth layer.

**Alternatives considered**:
- *PostgreSQL triggers*: Auto-captures every write including manual psql. Rejected: not
  expressible in Drizzle schema; couples DB to business logic in a non-TypeScript layer;
  no benefit for this use case since all writes go through the app.
- *Dedicated audit microservice*: Overkill. Rejected immediately.

---

## Q3: Finance domain schema shape

**Decision**: Normalized relational tables. Current event-sourced `BudgetSnapshotState`
(a JSONB blob with nested maps) maps 1:1 to normalized SQL tables.

**Mapping from current state to tables**:

| `BudgetSnapshotState` field | New table | Notes |
|-----------------------------|-----------|-------|
| `name`, `currency`, `creatorUserId` | `budgets` | Core budget row |
| `members[]` | `budget_members` | Many-to-many junction |
| `categories{}` | `categories` | `parent_id` FK for hierarchy |
| `categories[].yearlyTarget` | `categories.yearly_target` | Nullable column |
| `transactions{}` | `transactions` | Content-addressed PK retained |
| `splits{}` | `transaction_splits` | One row per (transaction, category) pair |
| `notes{}` | `transactions.note` | Inline column (one note per transaction) |

**Transaction deduplication**: The SHA-256 hash of `(date, description, amount)` remains
the transaction `id`. This is unchanged from the current `generateTransactionId()` helper
in `commands.ts`. Inserting a duplicate yields a unique constraint violation; the route
handler returns HTTP 409 as it does today.

---

## Q4: Game server state persistence

**Decision**: Single `game_room_states` table with `room_id` as PK, storing `counter`
as an integer column.

**Rationale**: Colyseus already maintains the authoritative in-memory state for connected
rooms. The DB row is only needed to restore the counter when all clients disconnect and
the room is recreated. A single `INSERT … ON CONFLICT DO UPDATE` per increment handles
persistence with no separate snapshot/event overhead.

**Impact on `MyRoom.ts`**:
- `appendIncrementEvent()` method → deleted
- `restoreFromStorage()` method → replaced with a single `SELECT counter FROM game_room_states WHERE room_id = $1`
- `streamIdForEvents` field → deleted
- `onAuth` restore call → simplified to single-row read
- `onCreate` persist → `upsert counter` after each increment (fire-and-forget)

---

## Q5: Dependencies to remove

| Package | Location | Reason to remove |
|---------|----------|-----------------|
| `colyseus.js` (client SDK) | `apps/web` | Frontend connects to game server; no longer needed in web app after verifying rooms feature usage |
| `@sentry/sveltekit` | `apps/web` | Review: remove if no DSN configured; retain if actively used |
| `@sentry/node` | `apps/game-server` | Same review |
| `@skjoldjasper/shared` (events.ts exports) | both apps | Removed by pruning events.ts |

**Note on `colyseus.js` in `apps/web`**: The `/rooms/[id]` route uses Colyseus client SDK
to connect to the game server WebSocket. If the rooms feature is retained (game server is
kept), `colyseus.js` in the web app is still needed. The spec story says to remove it, but
that conflicts with keeping the rooms UI. **Resolution**: Remove `colyseus.js` from web app
only if the `/rooms` routes are also removed. Since the game server is retained, keep
`colyseus.js` and the rooms routes. Revisit as a separate cleanup once the rooms feature is
evaluated for removal.

---

## Q6: `/api/events` route

**Decision**: **Delete** `apps/web/src/routes/api/events/+server.ts`.

**Rationale**: This is a general-purpose event-append HTTP endpoint backed by the events
table. After removing the events table, it has no backing store. The game server does not
use this HTTP endpoint (it writes directly via `pg`). No external callers documented.
