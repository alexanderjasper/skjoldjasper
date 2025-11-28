See the root `README.md` for setup and usage of Postgres + pgBackRest, backups, and restore. This
directory holds infrastructure definitions only—keep application/domain code inside `apps/*`.

## Compose services

- Postgres + pgBackRest sidecar
- Web (SvelteKit dev)
- Game server (Colyseus dev)
- Projector (one-shot)
- Cloudflare Tunnel (optional, maps web+WS to public hostnames)

### Running

```bash
cd infra
# DB only
docker compose up -d postgres

# Dev stack (web, game-server, projector)
docker compose up -d web game-server projector

# Optional: Cloudflare Tunnel (requires config.yml + credentials JSON)
docker compose up -d cloudflared
```
