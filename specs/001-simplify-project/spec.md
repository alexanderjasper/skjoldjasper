# Feature Specification: Project Simplification Overhaul

**Feature Branch**: `001-simplify-project`
**Created**: 2026-02-27
**Status**: Draft
**Input**: User description: "I want to simplify this project. It should have less complexity in the code and infrastructure. Identify stuff that we can shave off. E.g. removing event sourcing, merging projects/apps, removing unnecessary styling, libraries etc."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remove Event Sourcing from Finance Domain (Priority: P1)

A developer working on budget features currently has to understand event sourcing patterns, an append-only events table, aggregate snapshots, and a separate projector service just to read or write a budget entry. After this simplification, they work directly with budget records using straightforward read/write operations — no events, no snapshots, no projector polling loop.

**Why this priority**: Event sourcing is the single largest source of complexity in the project. It spans three separate packages/apps (db schema, projector service, shared event helpers), requires additional infrastructure to run, and imposes a steep learning curve. Removing it delivers the highest complexity reduction per effort spent. The finance domain use case (personal/family budgeting) does not justify this level of infrastructure.

**Independent Test**: Can be fully tested by verifying that all existing budget management features (create/edit budgets, categories, transactions, analytics) continue to work after the events table, aggregate_snapshots table, projector_checkpoints table, applied_events table, and the projector service are removed. Delivers value as a fully functional budget app with simpler storage.

**Acceptance Scenarios**:

1. **Given** the project is running, **When** a developer looks at the database schema, **Then** there are no events, aggregate_snapshots, projector_checkpoints, or applied_events tables
2. **Given** a budget operation is performed (create, update, delete), **When** the database is inspected, **Then** the result is written directly to a budget record — no event rows are created
3. **Given** the project is started in development, **When** all services are up, **Then** there is no projector process running
4. **Given** the codebase is reviewed, **When** searching for event sourcing patterns, **Then** no appendEvent calls, EventAppend types, or projector handlers exist in the finance domain

---

### User Story 2 - Remove Event Sourcing from Game Server (Priority: P2)

The game server currently persists every increment action as an event row, rebuilds state from a snapshot + event tail on each reconnection, and writes snapshots every 25 events. This is unnecessary for a real-time game where state is already held in Colyseus room memory and can be restored with a single database read. After simplification, the game server stores only its current state directly — no event log, no snapshots, no version tracking.

The Colyseus framework itself is intentionally kept: it handles efficient real-time state synchronization across players (delta patches, reconnection, room management) and will be needed when a real multiplayer game is built.

**Why this priority**: Event sourcing in the game server is the second largest complexity sink. It spans the events table, aggregate_snapshots table, and the shared appendEvent helper — all for a demo counter game. Colyseus already handles state sync, making the event log redundant.

**Independent Test**: Can be fully tested by verifying the game server starts, a room is joined, and the counter increments are visible to all connected clients — without any event rows being written to the database. Delivers value as a simpler real-time service that's easier to extend for a real game.

**Acceptance Scenarios**:

1. **Given** the game server is running and a room is joined, **When** a player increments the counter, **Then** no row is inserted into the events or aggregate_snapshots tables
2. **Given** a player reconnects to a room, **When** state is restored, **Then** state is loaded from a single current-state record, not by replaying events
3. **Given** the game server source code, **When** reviewed, **Then** there are no calls to appendEvent, no version conflict handling, and no snapshot logic

---

### User Story 3 - Prune Event Sourcing Code from Shared Packages (Priority: P3)

The `packages/db` and `packages/shared` packages currently contain event sourcing infrastructure: the events and snapshots schema, the appendEvent helper, projector checkpoint tables, and event type definitions. This code is shared between the web app and the game server. After removing event sourcing from both domains, these packages should retain only what is genuinely shared and needed — database connection setup, Drizzle schema for the finance domain, and any real shared utilities.

**Why this priority**: The shared packages still serve a purpose (sharing DB access and utilities between web and game server), but they are polluted with event sourcing concepts that will no longer exist. Pruning them reduces the package footprint without requiring a full monorepo restructure.

**Independent Test**: Can be tested by verifying `packages/db` has no events, snapshots, or checkpoint table definitions, and `packages/shared` has no event-related types or helpers, while both apps still build and run correctly.

**Acceptance Scenarios**:

1. **Given** the `packages/db` schema, **When** reviewed, **Then** there are no events, aggregate_snapshots, projector_checkpoints, or applied_events table definitions
2. **Given** the `packages/shared` source, **When** reviewed, **Then** there are no EventAppend types, appendEvent functions, or VersionConflictError classes
3. **Given** both apps after pruning, **When** built and started, **Then** they run correctly with no missing dependency errors

---

### User Story 4 - Simplify Infrastructure to Web + Database Only (Priority: P4)

The Docker Compose configuration currently runs 5 services: postgres, web, game-server, cloudflared, and an optional pgBackRest backup service. The postgres service is configured with WAL-level replication archiving for backup purposes. After simplification, development requires only a database service and the web app — no backup agent, no Cloudflare tunnel in the default setup.

**Why this priority**: Simpler infrastructure means faster startup, fewer failure points, and less cognitive overhead when onboarding or debugging.

**Independent Test**: Can be tested by verifying `docker compose up` starts exactly 2 services (postgres and web), and the development environment is fully functional for the finance domain.

**Acceptance Scenarios**:

1. **Given** the Docker Compose configuration, **When** running `docker compose up`, **Then** only 2 services start: postgres and web
2. **Given** the postgres configuration, **When** reviewing it, **Then** WAL archiving and pgBackRest configuration is either removed or isolated to a separate production-only compose file
3. **Given** cloudflared configuration, **When** reviewing the default compose file, **Then** it is not included in the default service set (moved to an optional profile or separate file)

---

### User Story 5 - Remove Unnecessary Dependencies (Priority: P5)

The project carries several dependencies that either duplicate functionality, are tied to removed features, or add overhead disproportionate to the value they provide. After cleanup, the web app has a lean dependency list with only libraries that are actively used by current features.

**Why this priority**: Unused or heavy dependencies increase install time, attack surface, and cognitive overhead. This is a straightforward cleanup once higher-priority removals are complete.

**Independent Test**: Can be tested by reviewing the dependency list after other stories are complete and verifying no Colyseus, projector, or event-sourcing related packages remain.

**Acceptance Scenarios**:

1. **Given** the web app's dependencies, **When** reviewed after all other stories are complete, **Then** `colyseus.js` and Sentry packages are removed (or Sentry is verified as actively configured and intentionally kept)
2. **Given** the shared utilities previously in `packages/shared`, **When** reviewed, **Then** only utilities actually used by the web app are retained; unused helpers (e.g., event schema types, CORS helpers for game server) are deleted

---

### Edge Cases

- What happens to existing finance data if the schema changes from event-sourced read models to direct storage? A one-time migration plan must be defined before removing the events table.
- How does the web app handle the `/rooms/[id]` routes if game-server is removed without a redirect or removal of those routes?
- What happens to the `packages/shared` Zod validation schemas that the web app currently depends on — are any of them used solely for event sourcing?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The finance domain MUST store budget, category, and transaction data using direct read/write operations with no event log intermediary
- **FR-002**: The project MUST NOT include a standalone projector service or process
- **FR-003**: The database schema MUST NOT contain event sourcing tables (events, aggregate_snapshots, projector_checkpoints, applied_events)
- **FR-004**: All existing finance features (budget creation, category management, transaction entry, CSV import, analytics, family sharing) MUST continue to work after simplification
- **FR-005**: The Docker Compose default configuration MUST start no more than 2 services for local development
- **FR-006**: The game server MUST NOT use event sourcing; game state MUST be stored as a single current-state record per room
- **FR-007**: The `packages/db` and `packages/shared` workspace packages MUST have all event sourcing related schema and code removed
- **FR-008**: Backup infrastructure (pgBackRest, WAL archiving) MUST be isolated to a production-only or opt-in configuration and not run by default
- **FR-009**: The web app MUST continue to be deployable from a single Dockerfile after all removals
- **FR-010**: The finance domain MUST maintain a database-level audit log of changes to transactions, budgets, and categories — storing before/after values so that previous states can be reconstructed by querying the audit log directly (no in-app UI required)
- **FR-011**: The audit log MUST be append-only; records in the audit log MUST never be deleted

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Number of separately running services in development is reduced from 5 to 3 (web app + game server + database)
- **SC-002**: Number of distinct app directories in `apps/` is reduced from 3 to 2 (web and game-server; projector removed)
- **SC-003**: The database schema contains no event sourcing tables (events, aggregate_snapshots, projector_checkpoints, applied_events)
- **SC-004**: All existing finance domain features remain functional with no regression in capabilities
- **SC-005**: Docker Compose startup time is reduced by removing the projector service and pgBackRest from the default configuration
- **SC-006**: The `pnpm install` dependency count is reduced by at least 20% due to removal of projector and event-sourcing libraries
- **SC-007**: A developer can understand the full finance domain by reading only the web app source — no cross-package tracing required

## Assumptions

- The Colyseus game server is intentionally kept as the foundation for a future real-time multiplayer game; only event sourcing is removed from it
- The finance domain is the core value of the application; all simplification decisions preserve its functionality
- There is no existing production data, so schema changes can be applied without a data migration strategy
- Sentry error tracking will be re-evaluated as part of dependency cleanup — if actively configured and used, it may be retained
- Tailwind CSS is intentionally kept; it is the standard styling approach and not considered excessive complexity
- Lucia authentication is retained; it is actively used and not a source of unnecessary complexity
- The audit log for finance data is a database-level concern only; no in-app UI for viewing or reverting history is required as part of this simplification
