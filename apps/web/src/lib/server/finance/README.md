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

- Direct relational writes/reads against budgets, categories, transactions, and splits
- Postgres stores current state plus append-only `finance_audit_log` rows for change history
- SvelteKit for UI and APIs
- Domain logic lives in `apps/web`; infra-only code lives in `packages/`

## Where things live (at a glance)

- UI and APIs: `apps/web/src/routes/modellen` and `apps/web/src/routes/api/budgets`
- Domain logic: `apps/web/src/lib/server/finance`

## Contribution guidelines

- Keep all finance-specific schemas, commands, and queries inside this directory. Do **not** move
  them into `packages/*`.
- Server routes should import domain services from here instead of re-implementing business rules.
- When adding a new capability, extend domain modules first and expose APIs/routes that call into
  them.

## Read more

- Project-wide structure and domain boundary guidance: see `@general-info.mdc`
- Repository quickstart and environment notes: see `/README.md`

