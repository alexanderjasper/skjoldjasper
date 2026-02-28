# Cloudflare Tunnel

The default setup uses token mode from `infra/.env`:

```yaml
command: [ "tunnel", "run", "--token", "${CLOUDFLARED_TUNNEL_TOKEN}" ]
```

## Steps

1) Create a tunnel in Cloudflare Zero Trust and copy its run token.

2) Add the token to `infra/.env`:

```bash
CLOUDFLARED_TUNNEL_TOKEN=...
```

3) Start the tunnel profile:

```bash
cd infra
docker compose --profile tunnel up -d cloudflared
```

4) Verify:

- Open your public app hostname and ensure `/rooms` loads.
- Verify WebSocket traffic works through your configured WS hostname.

Notes:

- Postgres stays private on the compose network.
- `config.example.yml` is kept only as optional reference if you prefer file-based tunnel config.


