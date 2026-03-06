# API Contract Changes: Project Simplification Overhaul

**Branch**: `001-simplify-project` | **Date**: 2026-02-27

All routes are internal to the SvelteKit app (consumed by the SvelteKit frontend). The
**external contract** (request/response shapes, HTTP methods, status codes) is **unchanged**
for all retained routes. Only the internal implementation changes from event sourcing to
direct CRUD.

---

## Deleted Routes

### `POST /api/events`

**Status**: **DELETED**

This was a general-purpose event-append HTTP endpoint backed by the `events` table. After
the events table is removed, it has no backing store and no callers.

### `OPTIONS /api/events`

**Status**: **DELETED** (same file as above)

---

## Retained Routes (external contract unchanged)

### `GET /api/budgets`

**Before**: Queries `aggregate_snapshots` table, filters by `payload.members`.
**After**: Queries `budgets` JOIN `budget_members` WHERE `user_id = $userId`.

Request/response shape: **unchanged**.

```
Response 200:
{
  "budgets": [
    { "id": string, "name": string, "currency": string, "createdAt": string }
  ]
}
```

---

### `POST /api/budgets`

**Before**: Calls `appendEvent(pool, { type: 'BudgetCreated', ... })`.
**After**: Inserts row into `budgets` + row into `budget_members` + audit log entry.

Request/response shape: **unchanged**.

```
Request body: { "name": string, "currency": string }
Response 201: { "id": string }
```

---

### `POST /api/budgets/[budgetId]/categories`

**Before**: Loads aggregate via `loadBudget()`, validates with `addCategory()`, calls
`appendEvent()`.
**After**: Validates category name + parent existence via direct DB lookup, inserts into
`categories` + audit log.

Request/response shape: **unchanged**.

```
Request body: { "name": string, "parentId": string | null }
Response 201: { "id": string }
```

---

### `PATCH /api/budgets/[budgetId]/categories`

**Before**: Loads aggregate, validates with `setCategoryTarget()`, calls `appendEvent()`.
**After**: Validates category exists + has no children via direct DB lookup, updates
`categories.yearly_target` + audit log.

Request/response shape: **unchanged**.

```
Request body: { "categoryId": string, "yearlyTarget": number }
Response 200: { "ok": true }
Response 400: { "error": "validation_failed", "message": string }
```

---

### `POST /api/budgets/[budgetId]/import`

**Before**: Loads aggregate, calls `importTransactions()` (hash-based dedup against state),
calls `appendEvent()`.
**After**: Hashes each transaction, checks for existing IDs in `transactions` table, bulk
inserts new rows + audit log entries. Dedup logic (`generateTransactionId`) is unchanged.

Request/response shape: **unchanged**.

```
Request: text/plain CSV body
Query: ?confirm=1 (optional, to proceed past duplicate warning)
Response 201: { "imported": number, "duplicates": number }
Response 409: { "duplicates": [...], "newCount": number, "message": string }
```

---

### `POST /api/budgets/[budgetId]/transactions/[transactionId]/note`

**Before**: Loads aggregate, calls `addNote()`, calls `appendEvent()`.
**After**: Updates `transactions.note` + audit log.

Request/response shape: **unchanged**.

---

### `POST /api/budgets/[budgetId]/transactions/[transactionId]/splits`

**Before**: Loads aggregate, calls `assignSplits()` (validates amounts), calls `appendEvent()`.
**After**: Validates splits sum == transaction amount via DB lookup, deletes existing splits,
inserts new `transaction_splits` rows + audit log.

Request/response shape: **unchanged**.

```
Request body: { "splits": [{ "categoryId": string, "amount": number }] }
Response 200: { "ok": true }
Response 400: validation errors
```

---

## No-change Routes

The following routes have no event-sourcing dependency and require no changes:

- `GET /` (home page)
- `POST /login`, `GET /login`
- `POST /register`, `GET /register`
- `POST /logout`
- `GET /modellen`, `GET /modellen/[budgetId]`
- `GET /rooms`, `GET /rooms/[id]`
- All auth routes via Lucia
