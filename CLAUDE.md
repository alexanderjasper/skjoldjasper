# skjoldjasper Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-27

## Active Technologies

- TypeScript throughout; Node.js ≥20.9.0 + SvelteKit 2.x (`apps/web`), Drizzle ORM 0.44, pg 8.x, Colyseus 0.16 (001-simplify-project)

## Project Structure

```text
apps/
├── web/          # SvelteKit finance app (primary)
└── game-server/  # Colyseus real-time server

packages/
├── db/           # Drizzle schema + pg pool client
└── shared/       # Generic utilities (rate limiting, HTTP helpers)

infra/            # Docker Compose, pgBackRest config
specs/            # Feature specs, plans, tasks (speckit workflow)
```

## Commands

pnpm --dir packages/db migrate:push   # apply schema changes
cd infra && docker compose up          # start postgres + web + game-server

## Code Style

TypeScript (ESM) throughout. pnpm workspaces. Finance domain logic lives in
`apps/web/src/lib/server/finance/`. Game logic stays in `apps/game-server/`.
`packages/` must contain only infrastructure primitives (no domain concepts).

## Recent Changes

- 001-simplify-project: Added TypeScript throughout; Node.js ≥20.9.0 + SvelteKit 2.x (`apps/web`), Drizzle ORM 0.44, pg 8.x, Colyseus 0.16

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
