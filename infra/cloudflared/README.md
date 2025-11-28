# Cloudflare Tunnel

This sets up a Cloudflare Tunnel container that exposes the local `web` (HTTP) and `game-server` (
HTTP/WS) services without opening inbound ports.

## Steps

1) Create a Tunnel in Cloudflare Zero Trust

- Go to Zero Trust → Networks → Tunnels → Create a tunnel
- Choose "Cloudflared" and give it a name
- Download the credentials file (UUID.json) for the tunnel
- Copy it to `infra/cloudflared/UUID.json`

2) Configure ingress

- Copy `infra/cloudflared/config.example.yml` to `infra/cloudflared/config.yml`
- Replace `YOUR_TUNNEL_UUID`, hostnames and credentials-file path
- Example ingress maps:
    - `app.your-domain.com` → `http://web:5173`
    - `ws.your-domain.com` → `http://game-server:2567`

3) Run via Compose

```bash
cd infra
docker compose up -d cloudflared
```

4) Verify

- Open `https://app.your-domain.com/rooms`
- Open `https://ws.your-domain.com/` (should return 200)
- WebSocket connections from the web app will use your public WS hostname if configured (
  `PUBLIC_GAME_SERVER_WS`)

Notes

- Postgres remains private on the Compose network and is not exposed
- You can also run token-based tunnels by using `cloudflared tunnel run --token` instead of
  file-based config; this setup prefers file-based for clear ingress mapping


