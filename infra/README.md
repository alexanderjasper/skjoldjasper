See the root `README.md` for setup and usage. This
directory holds infrastructure definitions only—keep application/domain code inside `apps/*`.

## Compose services

- Postgres
- Web (SvelteKit dev)
- Game server (Colyseus dev)
- Cloudflare Tunnel (optional, maps web+WS to public hostnames)

### Running

```bash
cd infra
# DB only
docker compose up -d postgres

# Dev stack (web, game-server)
docker compose up -d web game-server

# Optional: Cloudflare Tunnel (requires CLOUDFLARED_TUNNEL_TOKEN in infra/.env)
docker compose --profile tunnel up -d cloudflared
```
