# Modellen (Family Finance)

High-level overview of the finance/budgeting bounded context.

## Scope (what it does)

- Create budgets
- Define hierarchical categories with optional yearly targets
- Import bank statements (CSV; Danish format)
- Categorize transactions with splits (must sum to the transaction amount)
- Add notes to transactions
- Show budget vs. actual per category
- Share budgets with family members (equal permissions); friends have isolated budgets

## Architecture (how it works)

- Event Sourcing + CQRS: commands append events; a projector updates snapshots for fast reads
- Postgres stores events (event store) and read snapshots (aggregate snapshots)
- SvelteKit for UI and APIs; Supabase Auth (GitHub) for authentication
- Domain logic lives in `apps/web`; infra-only code lives in `packages/`

## Where things live (at a glance)

- UI and APIs: `apps/web/src/routes/modellen` and `apps/web/src/routes/api/budgets`
- Domain logic: `apps/web/src/lib/server/finance`
- Projector handler: `apps/projector/src/handlers/finance/budget.ts`

## Read more

- Project-wide structure and domain boundary guidance: see `@general-info.mdc`
- Repository quickstart and environment notes: see `/README.md`

