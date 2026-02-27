# Tasks: Project Simplification Overhaul

**Input**: Design documents from `/specs/001-simplify-project/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api-changes.md ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.
**Tests**: No tests requested in spec — test tasks are omitted.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths are included in every task description

---

## Phase 1: Setup

**Purpose**: Gate task required before any implementation begins (constitution violation documented in plan.md).

- [ ] T001 Amend project constitution by running `/speckit.constitution` to replace Principle III ("Separated Read/Write Paths" CQRS/ES mandate) with "Direct CRUD with Audit Log" — update specs/constitution.md with MAJOR version bump

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema and package index changes that MUST be complete before any user story can compile or run.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 Update packages/db/src/schema.ts — remove `events` and `aggregate_snapshots` table definitions; add `budgets`, `budget_members`, `categories`, `transactions`, `transaction_splits`, `finance_audit_log`, and `game_room_states` table definitions per data-model.md
- [ ] T003 [P] Delete packages/db/src/projector.ts — removes `projector_checkpoints` and `projector_applied_events` table definitions
- [ ] T004 Update packages/db/src/index.ts — remove projector.ts re-exports; add exports for all new tables added in T002
- [ ] T005 [P] Delete apps/projector/ directory entirely

**Checkpoint**: Schema compiles, projector is gone — user story implementation can now begin.

---

## Phase 3: User Story 1 — Remove Event Sourcing from Finance Domain (Priority: P1) 🎯 MVP

**Goal**: Replace event-sourced finance domain (events table + aggregate loader + projector) with direct CRUD against normalized relational tables; add append-only audit log helper.

**Independent Test**: Create a budget, add a category, import a CSV of transactions — verify the DB shows rows in `budgets`, `categories`, `transactions`, `transaction_splits`, and `finance_audit_log` with no rows in any event/snapshot table.

### Implementation for User Story 1

- [ ] T006 [P] [US1] Delete apps/web/src/lib/server/finance/repository.ts (event-sourcing aggregate loader — loadBudget, etc.)
- [ ] T007 [P] [US1] Delete apps/web/src/lib/server/finance/state.ts (event apply/reduce functions — BudgetCreated handler, etc.)
- [ ] T008 [P] [US1] Delete apps/web/src/lib/server/finance/events.ts (domain event type schemas and Zod definitions)
- [ ] T009 [P] [US1] Delete apps/web/src/routes/api/events/+server.ts (POST /api/events and OPTIONS /api/events — no backing store after schema change)
- [ ] T010 [US1] Trim apps/web/src/lib/server/finance/types.ts — remove BudgetState, BudgetSnapshotState, and all event-sourced aggregate types; retain only domain value types still used by commands.ts and queries.ts (depends on T006, T007, T008)
- [ ] T011 [P] [US1] Create apps/web/src/lib/server/finance/audit.ts — export `logAudit(pool, entry)` that inserts one row into `finance_audit_log`; entry type: `{ tableName, recordId, operation, changedByUserId, beforeData, afterData }`
- [ ] T012 [US1] Rewrite apps/web/src/lib/server/finance/commands.ts — replace `loadBudget()` + `appendEvent()` calls with direct Drizzle validation reads against `budgets`, `categories`, `transactions`; retain `generateTransactionId()`; enforce business rules (no `yearly_target` on parent category, splits sum tolerance) via DB queries (depends on T010, T011)
- [ ] T013 [P] [US1] Rewrite apps/web/src/lib/server/finance/queries.ts — replace snapshot/event table queries with direct SELECT queries against `budgets JOIN budget_members`, `categories`, `transactions JOIN transaction_splits`; no event replay or snapshot loading
- [ ] T014 [P] [US1] Rewrite apps/web/src/routes/api/budgets/+server.ts — GET queries `budgets JOIN budget_members WHERE user_id`; POST inserts into `budgets` + `budget_members` + calls `logAudit`; external request/response shape unchanged (depends on T012, T013)
- [ ] T015 [P] [US1] Rewrite apps/web/src/routes/api/budgets/[budgetId]/categories/+server.ts — POST validates parent existence via DB + inserts into `categories` + calls `logAudit`; PATCH validates leaf-only rule via DB + updates `categories.yearly_target` + calls `logAudit`; external shape unchanged (depends on T012, T013)
- [ ] T016 [P] [US1] Rewrite apps/web/src/routes/api/budgets/[budgetId]/import/+server.ts — hash each row with `generateTransactionId()`, check existing IDs in `transactions`, bulk insert new rows into `transactions` + `transaction_splits` + calls `logAudit` per row; return HTTP 409 on duplicates; external shape unchanged (depends on T012, T013)
- [ ] T017 [P] [US1] Rewrite apps/web/src/routes/api/budgets/[budgetId]/transactions/[transactionId]/note/+server.ts — UPDATE `transactions.note` + calls `logAudit`; external shape unchanged (depends on T012, T013)
- [ ] T018 [P] [US1] Rewrite apps/web/src/routes/api/budgets/[budgetId]/transactions/[transactionId]/splits/+server.ts — validate splits sum == transaction amount (±0.01), DELETE existing `transaction_splits`, INSERT new rows, call `logAudit`; external shape unchanged (depends on T012, T013)

**Checkpoint**: US1 fully functional — all budget/category/transaction features work with no event tables.

---

## Phase 4: User Story 2 — Remove Event Sourcing from Game Server (Priority: P2)

**Goal**: Simplify `MyRoom.ts` to persist a single current-state row per room in `game_room_states` instead of appending events + replaying snapshots.

**Independent Test**: Start game server, join a room, increment the counter — verify no row is inserted into `events` or `aggregate_snapshots`; disconnect and reconnect — verify counter is restored from `game_room_states` with a single SELECT.

### Implementation for User Story 2

- [ ] T019 [US2] Rewrite apps/game-server/src/rooms/MyRoom.ts — delete `appendIncrementEvent()`, `restoreFromStorage()`, `streamIdForEvents`; in `onAuth`/`onCreate` add `SELECT counter FROM game_room_states WHERE room_id = $1` to restore state; in `increment` handler add fire-and-forget `INSERT … ON CONFLICT (room_id) DO UPDATE SET counter = $2, updated_at = now()`

**Checkpoint**: Game server starts, rooms work, no event rows written.

---

## Phase 5: User Story 3 — Prune Event Sourcing Code from Shared Packages (Priority: P3)

**Goal**: Remove all event sourcing exports from `packages/shared`; packages/db pruning was completed in Phase 2.

**Independent Test**: After this phase, `packages/db` and `packages/shared` have no event/snapshot/projector table definitions or event helper exports; both apps still build with no missing dependency errors.

### Implementation for User Story 3

- [ ] T020 [P] [US3] Delete packages/shared/src/events.ts — removes `appendEvent`, `VersionConflictError`, `eventAppendSchema`, `EventAppend` type
- [ ] T021 [US3] Update packages/shared/src/index.ts — remove events.ts re-export; retain only exports still in use (depends on T020)

**Checkpoint**: `packages/shared` and `packages/db` contain no event-sourcing code; both apps compile.

---

## Phase 6: User Story 4 — Simplify Infrastructure to 3 Default Services (Priority: P4)

**Goal**: `docker compose up` starts exactly 3 services (postgres + web + game-server); cloudflared and pgBackRest are opt-in only.

**Independent Test**: Run `docker compose up` from `infra/` — verify only 3 services start; verify cloudflared requires `--profile tunnel` and pgBackRest requires `--profile backup`.

### Implementation for User Story 4

- [ ] T022 [P] [US4] Create infra/docker-compose.prod.yml — postgres WAL archiving override (`wal_level=replica`, `archive_mode=on`, `archive_command`) and pgBackRest service config moved here from default compose
- [ ] T023 [US4] Update infra/docker-compose.yml — move cloudflared service to `profiles: [tunnel]`; remove WAL archiving flags from default postgres command (those move to docker-compose.prod.yml); confirm 3 default services: postgres, web, game-server (depends on T022)

**Checkpoint**: `docker compose up` starts exactly 3 services with no extra processes.

---

## Phase 7: User Story 5 — Remove Unnecessary Dependencies (Priority: P5)

**Goal**: Remove packages whose only purpose was event sourcing or that are unused; `pnpm install` count reduced.

**Independent Test**: After this phase, `apps/web/package.json` and `apps/game-server/package.json` contain no Sentry packages (if no DSN is configured); both apps build successfully.

### Implementation for User Story 5

- [ ] T024 [P] [US5] Remove `@sentry/sveltekit` from apps/web/package.json; delete Sentry initialization code in apps/web/src/hooks.server.ts if no DSN is actively configured
- [ ] T025 [P] [US5] Remove `@sentry/node` from apps/game-server/package.json; delete Sentry initialization calls in apps/game-server/src/ if no DSN is configured
- [ ] T026 [US5] Run `pnpm install` from repo root to update pnpm-lock.yaml after package.json changes in T024 and T025 (depends on T024, T025)

**Checkpoint**: Dependency list is pruned; pnpm install count reduced.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verify the full stack is consistent and all acceptance criteria pass.

- [ ] T027 [P] Run `pnpm --dir packages/db migrate:push` to apply schema changes to development database and verify no errors
- [ ] T028 [P] Verify TypeScript compilation succeeds across all workspaces by running `pnpm build` from repo root
- [ ] T029 Verify `docker compose up` from infra/ starts exactly 3 services (postgres, web, game-server) per quickstart.md and that `docker compose --profile tunnel up` adds cloudflared correctly
- [ ] T030 Validate finance domain end-to-end against US1 acceptance scenarios: create a budget → add a category → import CSV transactions → verify rows in budgets/categories/transactions/transaction_splits/finance_audit_log, no rows in events/aggregate_snapshots

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — can run in parallel with US2, US4
- **US2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1, US4
- **US3 (Phase 5)**: Depends on US1 (Phase 3) and US2 (Phase 4) — all consumers of events.ts must be rewritten first
- **US4 (Phase 6)**: Depends on Phase 2 — infrastructure changes are independent of app rewrites
- **US5 (Phase 7)**: Depends on US3 completion — ensures no indirect dependency on removed packages remains
- **Polish (Phase 8)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — independent, no US dependencies
- **US2 (P2)**: After Phase 2 — independent, no US dependencies; can run in parallel with US1
- **US3 (P3)**: After US1 + US2 — `packages/shared/events.ts` must not be imported by either app before deletion
- **US4 (P4)**: After Phase 2 — fully independent of app rewrites
- **US5 (P5)**: After US3 — ensures all event-sourcing code paths are gone before final dep cleanup

### Within User Story 1

- T006–T009 (deletions) run in parallel — no dependencies
- T010 depends on T006, T007, T008 (types.ts cleanup after deleting event type files)
- T011 is independent (new file, no dependencies)
- T012 depends on T010, T011
- T013 is independent (different file)
- T014–T018 depend on T012, T013; run in parallel with each other (different route files)

### Parallel Opportunities

- T003, T005 run in parallel during Phase 2
- T006, T007, T008, T009, T011, T013 run in parallel within Phase 3
- T014, T015, T016, T017, T018 run in parallel within Phase 3 (after T012, T013)
- T020 and Phase 6 (T022) can run in parallel with Phase 3 if separate developers
- T024, T025 run in parallel within Phase 7
- T027, T028 run in parallel in Polish phase

---

## Parallel Example: User Story 1

```bash
# Step 1 — delete obsolete files in parallel (all different files):
Task: "Delete apps/web/src/lib/server/finance/repository.ts"       # T006
Task: "Delete apps/web/src/lib/server/finance/state.ts"            # T007
Task: "Delete apps/web/src/lib/server/finance/events.ts"           # T008
Task: "Delete apps/web/src/routes/api/events/+server.ts"           # T009
Task: "Create apps/web/src/lib/server/finance/audit.ts"            # T011
Task: "Rewrite apps/web/src/lib/server/finance/queries.ts"         # T013

# Step 2 — types + commands (after deletions):
Task: "Trim apps/web/src/lib/server/finance/types.ts"              # T010 (after T006-T008)
# Then:
Task: "Rewrite apps/web/src/lib/server/finance/commands.ts"        # T012 (after T010, T011)

# Step 3 — all route rewrites in parallel (after T012, T013):
Task: "Rewrite apps/web/src/routes/api/budgets/+server.ts"                                           # T014
Task: "Rewrite apps/web/src/routes/api/budgets/[budgetId]/categories/+server.ts"                     # T015
Task: "Rewrite apps/web/src/routes/api/budgets/[budgetId]/import/+server.ts"                         # T016
Task: "Rewrite apps/web/src/routes/api/budgets/[budgetId]/transactions/[id]/note/+server.ts"         # T017
Task: "Rewrite apps/web/src/routes/api/budgets/[budgetId]/transactions/[id]/splits/+server.ts"       # T018
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T005) — CRITICAL, blocks everything
3. Complete Phase 3: User Story 1 (T006–T018)
4. **STOP and VALIDATE**: Run finance domain end-to-end — create budget, add category, import CSV
5. All finance features work with no event tables — core value delivered

### Incremental Delivery

1. Phase 1 + Phase 2 → Schema ready, projector gone
2. Phase 3 (US1) → Finance domain simplified → MVP validated
3. Phase 4 (US2) → Game server simplified → independently tested
4. Phase 5 (US3) → Shared packages pruned → full build validated
5. Phase 6 (US4) → Infrastructure simplified → 3-service startup confirmed
6. Phase 7 (US5) → Deps pruned → install count reduced
7. Phase 8 (Polish) → Full stack validated

### Parallel Team Strategy

With multiple developers after Phase 2 is complete:

- Developer A: Phase 3 (US1 — finance domain rewrite, largest effort)
- Developer B: Phase 4 (US2 — game server) + Phase 6 (US4 — infra)
- After A + B complete: Phase 5 (US3) → Phase 7 (US5) → Phase 8 (Polish)

---

## Notes

- [P] tasks touch different files — no write conflicts
- No test tasks generated (not requested in spec)
- `packages/db` event-sourcing removal is in Phase 2 (Foundational) because US1/US2 both need the new schema before they can compile
- US3 Phase 5 is intentionally small — most of the DB cleanup happens in Phase 2; packages/shared cleanup happens here
- `colyseus.js` in apps/web is intentionally retained per research.md Q5 — rooms feature still active
- Constitution amendment (T001) is a hard gate per plan.md — do not skip
