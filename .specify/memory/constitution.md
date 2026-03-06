<!--
  SYNC IMPACT REPORT
  ==================
  Version change: 1.0.0 → 2.0.0
  Type of bump: MAJOR — Principle III redefined; CQRS/Event-Sourcing mandate removed and
  replaced with Direct CRUD + Audit Log.

  Principles:
  - (unchanged) I. Domain-First Organization
  - (unchanged) II. Generic Shared Packages
  - (REDEFINED) III. Separated Read/Write Paths → III. Direct CRUD with Audit Log

  Modified sections:
  - Core Principles: Principle III rewritten (rationale updated)
  - Technology Stack & Conventions: Event store and snapshot schema removed; finance
    domain CRUD tables and audit log added; projector references removed
  - Development Workflow: Event-sourcing new-context checklist replaced with direct
    CRUD + audit log checklist

  Removed sections:
  - None (structure preserved)

  Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — Constitution Check section is a runtime
       placeholder filled by /speckit.plan; no principle-name hard-coding found. No edit needed.
  - ✅ .specify/templates/spec-template.md — No principle-driven mandatory sections
       added/removed. No edit needed.
  - ✅ .specify/templates/tasks-template.md — Task categories (Setup, Foundational,
       User Stories) are generic and principle-agnostic. No edit needed.
  - ⚠️  README.md — Contains stale CQRS/ES architecture description, projector layout
       reference, event store schema docs, and "Add a new bounded context" guide using
       appendEvent. PENDING: update after feature 001-simplify-project implementation
       lands on main.

  Deferred TODOs:
  - README.md update deferred until implementation is complete (code must match docs).
-->

# Skjoldjasper Constitution

## Core Principles

### I. Domain-First Organization

All business logic, commands, queries, and domain entities MUST belong to their
owning bounded context inside `apps/`. UI adapters (`routes/*`) MUST remain thin and
delegate to domain modules (e.g., `apps/web/src/lib/server/<context>`). Domain code
(entities, business rules, room logic) MUST NOT be placed in `packages/`.

When adding new capabilities:
1. Extend the domain module inside the owning app.
2. Expose it through adapters (routes, handlers) in the same app.
3. Touch `packages/` only when a genuinely reusable infrastructure helper is required.

**Rationale**: Collocating domain logic with its owning application prevents leakage across
bounded contexts, makes each context independently navigable, and keeps the dependency graph
acyclic at the domain level.

### II. Generic Shared Packages

`packages/*` MUST remain free of domain-specific concepts — no aggregates, domain types,
projection schemas, room logic, or business rules. Only infrastructure primitives
that are genuinely reusable across all contexts belong here (e.g., db clients, HTTP utils,
rate limiting, ID helpers, generic Zod schemas).

Every addition to `packages/` MUST be evaluated against the question: "Does this make
sense completely outside of any single bounded context?" If the answer is no, it belongs
in the owning app instead.

**Rationale**: Shared packages are a structural coupling point. Keeping them purely
infrastructural prevents domain concepts from bleeding across contexts and ensures
`packages/*` can evolve without knowledge of any specific business domain.

### III. Direct CRUD with Audit Log

Domain state MUST be stored in normalized relational tables and accessed via direct
read/write operations:

- **Writes**: Route handlers MUST call domain helpers in
  `apps/web/src/lib/server/<context>/commands.ts` for business rule validation, then
  execute SQL INSERT/UPDATE/DELETE against the domain tables directly.
- **Reads**: MUST query domain tables directly. Query helpers MUST live in
  `apps/<app>/src/lib/server/<context>/queries.ts` (or equivalent location in the
  owning app).
- **Auditability**: Every write to finance domain tables (budgets, categories,
  transactions, transaction_splits) MUST append a row to `finance_audit_log` via the
  `logAudit(pool, entry)` helper. Audit log rows MUST NEVER be deleted or updated.
- **No event log**: An append-only domain event store is NOT used. The `events` and
  `aggregate_snapshots` tables MUST NOT exist in the schema.

**Rationale**: The finance domain use case (personal/family budgeting) does not justify
the infrastructure overhead of event sourcing (projector process, snapshot polling,
cross-package event types). Direct CRUD is simpler to understand, debug, and extend.
Auditability is preserved by the append-only `finance_audit_log` table.

## Technology Stack & Conventions

- **Runtime**: Node.js; TypeScript across all apps and packages.
- **Frontend**: SvelteKit + Tailwind CSS (`apps/web`).
- **Database**: PostgreSQL (exposed on `localhost:5433` for local tooling).
- **ORM / Migrations**: Drizzle ORM; apply via `pnpm --dir packages/db migrate:push`.
- **Finance domain schema**: normalized tables — `budgets`, `budget_members`, `categories`,
  `transactions`, `transaction_splits`, `finance_audit_log` (append-only).
- **Game server schema**: `game_room_states(room_id, counter, updated_at)`.
- **Auth schema**: `user`, `session` (Lucia).
- **Game server**: Colyseus (`apps/game-server`); game rules and room logic stay here,
  never in shared packages. Room state is persisted as a single row per room.
- **Infra**: Docker Compose runs 3 services by default: `postgres`, `web`, `game-server`.
  Cloudflare Tunnel available via `--profile tunnel`. pgBackRest available via
  `--profile backup`.
- **Package manager**: pnpm workspaces.
- **Backups**: pgBackRest to Cloudflare R2; available as an opt-in Docker Compose profile.

## Development Workflow

New bounded context checklist:

1. Add normalized tables to `packages/db/src/schema.ts` and run
   `pnpm --dir packages/db migrate:push`.
2. Create `apps/web/src/lib/server/<context>/commands.ts` with business rule validation
   functions (pure or reading directly from DB).
3. Create `apps/web/src/lib/server/<context>/queries.ts` with read helpers querying the
   new tables via `getPool()` from `@skjoldjasper/db`.
4. Create `apps/web/src/lib/server/<context>/audit.ts` (if auditability required) and
   call `logAudit(pool, entry)` in every write handler.
5. Wire up route handlers in `apps/web/src/routes/` delegating to commands and queries.
6. Apply rate limiting with `createTokenBucket` from `@skjoldjasper/shared`.
7. Apply CORS with `buildCorsHeaders` / `buildPreflightHeaders` from
   `@skjoldjasper/shared`.

All PRs MUST verify compliance with the three Core Principles before merging.
Complexity deviations (e.g., placing domain logic in `packages/` for expedience) MUST
be documented and justified in the PR description.

## Governance

This Constitution supersedes all other development practices for the skjoldjasper project.
Amendments require:

1. Documenting the proposed change and its rationale.
2. Bumping the version according to the policy below.
3. Overwriting `.specify/memory/constitution.md` with the updated content.
4. Propagating changes to dependent templates under `.specify/templates/`.

**Versioning policy**:

- **MAJOR**: Backward-incompatible removal or redefinition of a Core Principle.
- **MINOR**: New principle or section added, or materially expanded guidance.
- **PATCH**: Clarifications, wording fixes, typo corrections, non-semantic refinements.

All PRs and agent-assisted plan/spec/task workflows MUST verify compliance with the
Core Principles defined here. The authoritative constitution is always at
`.specify/memory/constitution.md`.

**Version**: 2.0.0 | **Ratified**: 2026-02-27 | **Last Amended**: 2026-02-27
