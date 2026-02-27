# Implementation Plan: Project Simplification Overhaul

**Branch**: `001-simplify-project` | **Date**: 2026-02-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-simplify-project/spec.md`

## Summary

Remove event sourcing from the finance domain and game server, delete the projector service,
prune event sourcing infrastructure from shared packages, and simplify Docker Compose to 3
services. The finance domain is rewritten to use normalized relational tables with direct
CRUD; an append-only audit log table replaces the event log as the auditability mechanism.
The game server stores a single current-state row per room instead of an event tail + snapshot.
The constitution must be amended (MAJOR bump) to remove the CQRS/Event-Sourcing mandate in
Principle III.

## Technical Context

**Language/Version**: TypeScript throughout; Node.js ≥20.9.0
**Primary Dependencies**: SvelteKit 2.x (`apps/web`), Drizzle ORM 0.44, pg 8.x, Colyseus 0.16
(`apps/game-server`), Lucia 3.x (auth), Tailwind CSS 4.x
**Storage**: PostgreSQL; schema managed via `drizzle-kit push` in `packages/db`
**Testing**: Mocha (`apps/game-server`); no formal test runner in `apps/web`
**Target Platform**: Docker Compose (local dev), single Dockerfile for web deployment
**Project Type**: SvelteKit web app + Colyseus game server; pnpm workspaces monorepo
**Performance Goals**: None stated; personal/family budgeting load
**Constraints**: No production data — no data migration strategy required; Tailwind CSS and
Lucia authentication are retained as-is; Colyseus framework retained
**Scale/Scope**: Personal/family finance domain; small number of users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Domain-First Organization** | ✅ PASS | Finance domain logic remains in `apps/web/src/lib/server/finance/`. Game logic remains in `apps/game-server/`. No domain code moves to `packages/`. |
| **II. Generic Shared Packages** | ✅ IMPROVED | Removing `appendEvent`, `VersionConflictError`, `eventAppendSchema` from `packages/shared` and event-sourcing schema from `packages/db` **strengthens** compliance — packages become more purely infrastructural. |
| **III. Separated Read/Write Paths** | ❌ VIOLATION — **JUSTIFIED** | This feature deliberately removes the CQRS/Event-Sourcing mandate. Justification: the finance use case (personal budgeting) does not justify append-only event log infrastructure; spec FR-001–003, FR-006–007 explicitly require removal; auditability is preserved via an append-only `finance_audit_log` table. **Required action**: MAJOR constitution amendment to replace Principle III with "Direct CRUD with Audit Log". |

**GATE STATUS**: Violation in Principle III is justified and documented. Constitution amendment
(`/speckit.constitution`) is a required task before this feature merges.

## Project Structure

### Documentation (this feature)

```text
specs/001-simplify-project/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── api-changes.md   # Web app route contract delta
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
apps/
├── web/                                       # SvelteKit finance app — RETAINED + simplified
│   ├── src/lib/server/finance/
│   │   ├── commands.ts                        # REWRITTEN: pure validation → direct DB writes
│   │   ├── queries.ts                         # REWRITTEN: direct table reads (no snapshot queries)
│   │   ├── repository.ts                      # DELETED (event-sourcing aggregate loader)
│   │   ├── state.ts                           # DELETED (event apply/reduce functions)
│   │   ├── events.ts                          # DELETED (domain event type schemas)
│   │   ├── types.ts                           # TRIMMED (remove BudgetState/event-sourced types)
│   │   └── audit.ts                           # NEW: append-only audit log helper
│   └── src/routes/
│       ├── api/budgets/                       # REWRITTEN internals to use direct CRUD
│       ├── api/events/                        # DELETED (general event-append endpoint)
│       └── rooms/                             # RETAINED (game server frontend)
│
├── game-server/                               # Colyseus — RETAINED, event sourcing removed
│   └── src/rooms/MyRoom.ts                    # SIMPLIFIED: remove appendIncrementEvent, restoreFromStorage
│                                              # ADD: single-row game_room_states persistence
│
└── projector/                                 # DELETED entirely
    # apps/projector/ directory removed

packages/
├── db/
│   ├── src/schema.ts                          # PRUNED: remove events + aggregate_snapshots tables
│   │                                          # ADD: budgets, budget_members, categories, transactions,
│   │                                          #      transaction_splits, finance_audit_log, game_room_states
│   ├── src/projector.ts                       # DELETED
│   └── src/index.ts                           # UPDATED: remove projector exports
└── shared/
    ├── src/events.ts                          # DELETED (appendEvent, VersionConflictError, etc.)
    └── src/index.ts                           # UPDATED: remove events.ts re-export

infra/
└── docker-compose.yml                         # SIMPLIFIED: cloudflared → optional profile
                                               #             postgres WAL archiving removed from default
                                               #             game-server remains as 3rd default service
```

**Structure Decision**: Monorepo with `apps/` and `packages/` is retained. The projector is
the only directory to be fully deleted (`apps/projector/`). All other changes are internal
rewrites within existing file locations.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Constitution Principle III removed (CQRS/ES mandate) | Finance domain uses personal budgeting — no replay, time-travel, or independent scaling needed; infrastructure overhead unjustified | Keeping event sourcing means keeping projector process, snapshot polling, event table, and 3 packages of infrastructure for a single-user app |
| `finance_audit_log` append-only table added | FR-010/FR-011 require database-level audit trail replacing the event log's auditability | Without it, history of changes is permanently lost after removing the event log |
