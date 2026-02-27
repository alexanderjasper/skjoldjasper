<!--
  SYNC IMPACT REPORT
  ==================
  Version change: (template) → 1.0.0
  Type of bump: MINOR — first population of constitution from project README and repo context.

  Principles:
  - (new) I. Domain-First Organization
  - (new) II. Generic Shared Packages
  - (new) III. Separated Read/Write Paths

  Added sections:
  - Core Principles (3 principles derived from README architecture section)
  - Technology Stack & Conventions
  - Development Workflow
  - Governance

  Removed sections:
  - None (no prior content)

  Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — Constitution Check section is a runtime
       placeholder filled by /speckit.plan; aligns with the 3 principles. No edit needed.
  - ✅ .specify/templates/spec-template.md — No principle-driven mandatory sections
       added/removed. No edit needed.
  - ✅ .specify/templates/tasks-template.md — Task categories (Setup, Foundational,
       User Stories) are consistent with domain-first and CQRS patterns. No edit needed.
  - ✅ .claude/commands/speckit.constitution.md — No CLAUDE-only agent references
       requiring generalisation found.
  - ✅ README.md — Architecture principles remain authoritative source; no changes needed.

  Deferred TODOs:
  - None. All placeholders resolved.
-->

# Skjoldjasper Constitution

## Core Principles

### I. Domain-First Organization

All business logic, aggregates, commands, queries, and projections MUST belong to their
owning bounded context inside `apps/`. UI adapters (`routes/*`) MUST remain thin and
delegate to domain modules (e.g., `apps/web/src/lib/server/<context>`). Domain code
(aggregates, event types, projections, room rules) MUST NOT be placed in `packages/`.

When adding new capabilities:
1. Extend the domain module inside the owning app.
2. Expose it through adapters (routes, handlers) in the same app.
3. Touch `packages/` only when a genuinely reusable infrastructure helper is required.

**Rationale**: Collocating domain logic with its owning application prevents leakage across
bounded contexts, makes each context independently navigable, and keeps the dependency graph
acyclic at the domain level.

### II. Generic Shared Packages

`packages/*` MUST remain free of domain-specific concepts — no aggregates, domain event
types, projection schemas, room logic, or business rules. Only infrastructure primitives
that are genuinely reusable across all contexts belong here (e.g., db clients, HTTP utils,
rate limiting, ID helpers, generic Zod schemas).

Every addition to `packages/` MUST be evaluated against the question: "Does this make
sense completely outside of any single bounded context?" If the answer is no, it belongs
in the owning app instead.

**Rationale**: Shared packages are a structural coupling point. Keeping them purely
infrastructural prevents domain concepts from bleeding across contexts and ensures
`packages/*` can evolve without knowledge of any specific business domain.

### III. Separated Read/Write Paths

The system MUST maintain strict CQRS / Event-Sourcing separation:

- **Writes**: MUST append domain events to the event store via `appendEvent(pool, dto,
  metadata)`. Aggregate + command logic lives in `apps/web/src/lib/server/<context>`.
- **Reads**: MUST query projection tables built by the projector. Projection handlers
  MUST live in `apps/projector/src/handlers/<context>/<category>.ts` and implement
  `ensureSchema` + `apply`. Each handler MUST be registered in
  `apps/projector/src/index.ts`.
- Direct reads from the event store in application code are NOT permitted except for
  aggregate rehydration.

**Rationale**: Clean separation of reads and writes enables independent scaling,
full auditability via the append-only event log, and replay/time-travel capabilities
without retrofitting existing read models.

## Technology Stack & Conventions

- **Runtime**: Node.js; TypeScript across all apps and packages.
- **Frontend**: SvelteKit + Tailwind CSS (`apps/web`).
- **Database**: PostgreSQL (exposed on `localhost:5433` for local tooling).
- **ORM / Migrations**: Drizzle ORM; apply via `pnpm --dir packages/db migrate:push`.
- **Event Store schema**: `events(position, event_id, context, stream_category, stream_id,
  version, type, payload jsonb, metadata jsonb, created_at)` with uniqueness on
  `(stream_id, version)` and `event_id`.
- **Snapshot store**: `aggregate_snapshots(context, stream_category, stream_id, version,
  payload jsonb, created_at)`.
- **Game server**: Colyseus (`apps/game-server`); game rules and room logic stay here,
  never in shared packages.
- **Infra**: Docker Compose for Postgres + pgBackRest; Cloudflare Tunnel optional for
  public WebSocket exposure.
- **Package manager**: pnpm workspaces.
- **Backups**: pgBackRest to Cloudflare R2; validated via restore smoke test.

## Development Workflow

New bounded context checklist:

1. Define events using `packages/shared/eventAppendSchema`; append via
   `appendEvent(pool, dto, metadata)`.
2. Create a projector handler in `apps/projector/src/handlers/<context>/<category>.ts`
   implementing `ensureSchema` and `apply`.
3. Register the handler in `apps/projector/src/index.ts`.
4. Consume read models in `apps/web` by querying projection tables via
   `getPool()` from `@skjoldjasper/db`.
5. Apply rate limiting with `createTokenBucket` from `@skjoldjasper/shared`.
6. Apply CORS with `buildCorsHeaders` / `buildPreflightHeaders` from
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

**Version**: 1.0.0 | **Ratified**: 2026-02-27 | **Last Amended**: 2026-02-27
