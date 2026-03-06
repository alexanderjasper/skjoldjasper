# Data Model: Project Simplification Overhaul

**Branch**: `001-simplify-project` | **Date**: 2026-02-27

## Tables to Remove

| Table | Owner | Reason |
|-------|-------|--------|
| `events` | `packages/db/src/schema.ts` | Event sourcing log — replaced by direct CRUD + audit log |
| `aggregate_snapshots` | `packages/db/src/schema.ts` | Projector snapshot cache — no longer needed |
| `projector_checkpoints` | `packages/db/src/projector.ts` | Projector bookmark — service deleted |
| `projector_applied_events` | `packages/db/src/projector.ts` | Projector idempotency — service deleted |

---

## Tables to Add

All new tables are added to `packages/db/src/schema.ts` and exported from `packages/db/src/index.ts`.

### Finance Domain

#### `budgets`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `text` | PK | UUID, prefixed `budget-{uuid}` |
| `name` | `text` | NOT NULL | |
| `currency` | `text` | NOT NULL | ISO 4217 code, e.g. `DKK` |
| `creator_user_id` | `text` | NOT NULL, FK → `user.id` | |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | |

#### `budget_members`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `budget_id` | `text` | NOT NULL, FK → `budgets.id` | |
| `user_id` | `text` | NOT NULL, FK → `user.id` | |
| `joined_at` | `timestamptz` | NOT NULL, DEFAULT now() | |
| — | PK | `(budget_id, user_id)` | |

Index: `(user_id)` to support "budgets for user" query.

#### `categories`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `text` | PK | UUID |
| `budget_id` | `text` | NOT NULL, FK → `budgets.id` | |
| `name` | `text` | NOT NULL | |
| `parent_id` | `text` | NULLABLE, FK → `categories.id` | `null` = root category |
| `yearly_target` | `integer` | NULLABLE | Leaf categories only |

Index: `(budget_id)` for category list queries.

Validation rule (enforced in application): `yearly_target` may only be set when the
category has no children (enforced in `commands.ts`).

#### `transactions`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `text` | PK | SHA-256(`date\|description\|amount`) first 16 hex chars — existing `generateTransactionId()` logic retained |
| `budget_id` | `text` | NOT NULL, FK → `budgets.id` | |
| `date` | `date` | NOT NULL | |
| `description` | `text` | NOT NULL | |
| `amount` | `numeric(15,2)` | NOT NULL | |
| `note` | `text` | NULLABLE | Previously stored in `notes` map |
| `imported_at` | `timestamptz` | NOT NULL, DEFAULT now() | |

Index: `(budget_id)` for transaction list queries.

Deduplication: inserting a transaction whose `id` already exists raises a unique constraint
violation → route handler returns HTTP 409 (same behaviour as before).

#### `transaction_splits`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `transaction_id` | `text` | NOT NULL, FK → `transactions.id` | |
| `category_id` | `text` | NOT NULL, FK → `categories.id` | |
| `amount` | `numeric(15,2)` | NOT NULL | |
| — | PK | `(transaction_id, category_id)` | |

Validation rule (enforced in application): sum of splits for a transaction must equal
`transactions.amount` within ±0.01 tolerance.

#### `finance_audit_log`

Append-only. Rows are never updated or deleted (FR-010, FR-011).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `bigserial` | PK | |
| `table_name` | `text` | NOT NULL | `'budgets'`, `'categories'`, `'transactions'`, `'transaction_splits'` |
| `record_id` | `text` | NOT NULL | PK of the affected row |
| `operation` | `text` | NOT NULL | `'INSERT'`, `'UPDATE'`, `'DELETE'` |
| `changed_by_user_id` | `text` | NULLABLE | `null` for system/cascade operations |
| `before_data` | `jsonb` | NULLABLE | `null` for INSERT |
| `after_data` | `jsonb` | NOT NULL | Snapshot of row after operation |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |

Index: `(table_name, record_id)` for "history of a record" queries.
Index: `(created_at)` for time-range queries.

**Application helper**: `apps/web/src/lib/server/finance/audit.ts` exports
`logAudit(pool, entry)` called explicitly at each write point in the route handlers.

---

### Game Server Domain

#### `game_room_states`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `room_id` | `text` | PK | Colyseus `roomId` |
| `counter` | `integer` | NOT NULL, DEFAULT 0 | |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | |

Persistence pattern in `MyRoom.ts`:
- **Restore**: `SELECT counter FROM game_room_states WHERE room_id = $1` (in `onAuth`)
- **Persist**: `INSERT … ON CONFLICT (room_id) DO UPDATE SET counter = $2, updated_at = now()`
  (fire-and-forget in the `increment` message handler)

---

## Retained Tables (unchanged)

| Table | Owner | Notes |
|-------|-------|-------|
| `user` | `packages/db/src/schema.ts` | Lucia auth, no changes |
| `session` | `packages/db/src/schema.ts` | Lucia auth, no changes |

---

## Entity Relationships

```text
user ──< budget_members >── budgets ──< categories (self-ref parent_id)
                                   ──< transactions ──< transaction_splits >── categories
                                   ──< finance_audit_log (by record_id lookup)

game_room_states (standalone, no FK to finance domain)
```
