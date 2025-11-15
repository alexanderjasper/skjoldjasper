# Game Server (Colyseus)

- Hosts realtime rooms used by the web app (via WS). Business rules for matchmaking/room state live inside `src/rooms/*`.
- `src/rooms/MyRoom.ts` shows the pattern: state class in `src/rooms/schema`, handler class in `src/rooms/`.
- Keep game-specific logic inside this app. `packages/*` must stay domain-agnostic (only infra helpers).
- Configure env via `env.example` → `.env` (matches root README instructions).
- Run locally with `pnpm --dir apps/game-server dev` or start via `pnpm dev:stack` (Compose). Attach debugger through VS Code launch configs if needed.

See https://docs.colyseus.io/ for detailed Colyseus APIs.
