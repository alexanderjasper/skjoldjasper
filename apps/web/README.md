## Web App (SvelteKit)

- UI routes live under `src/routes`. Keep server endpoints thin—delegate to `src/lib/server/*`
  modules.
- Finance domain logic (Modellen) is under `src/lib/server/finance` (commands, queries, validations).
- Shared utilities from `packages/*` must remain domain-agnostic. Do not move finance logic out of
  this app.
- Budget features use direct relational reads/writes; there is no projector layer.

For dev server, linting, debugging, and environment setup, follow the root `README.md`.
