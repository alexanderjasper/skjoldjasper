## Web App (SvelteKit)

- UI routes live under `src/routes`. Keep server endpoints thin—delegate to `src/lib/server/*` modules.
- Finance domain logic (Modellen) is under `src/lib/server/finance` (commands, queries, events, state). Add new aggregates/modules beside existing ones.
- Supabase Auth config: copy `env.example` → `.env` and fill `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY`.
- Shared utilities from `packages/*` must remain domain-agnostic. Do not move finance logic out of this app.
- Projections/read models are produced by `apps/projector`; this app should only read them via queries/repositories.

For dev server, linting, debugging, and environment setup, follow the root `README.md`.
