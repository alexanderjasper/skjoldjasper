# `infra/musicbox` — the Music Box web faceplate (LAN-only)

Deploys the Flask web simulator from the [music-box](https://github.com/alexanderjasper/music-box)
repo on the home server, so the panel UI can be tried out **against the real
Sonos speakers** before the physical box exists.

| Container | What it does |
|---|---|
| `musicbox` | The Flask faceplate (`software/web`) built from the music-box repo, served by gunicorn on port `8480`. Drives the real Sonos via [SoCo](https://github.com/SoCo/SoCo). |

This is **not** on the public site — no Cloudflare Tunnel, no Traefik. It's
reachable only on the LAN at `http://<home-server-ip>:8480`
(e.g. `http://192.168.0.245:8480`).

## Why host networking

The compose uses `network_mode: host`, which is load-bearing:

- **Sonos discovery needs it.** SoCo finds speakers via **SSDP multicast**,
  which does not cross Docker's bridge network. On the host network the
  container sees the speakers directly.
- **It exposes the UI on the LAN** without port mapping — gunicorn binds the
  host's `:8480`.

The flip side: the home server **must be on the same LAN/VLAN as the Sonos
speakers**. If it isn't, the UI still loads but shows "not connected" and the
controls won't drive anything.

## Deploy (Dokploy)

The image builds straight from the music-box GitHub repo (the `build.context`
is a git URL), so nothing about the app lives in this repo.

1. In Dokploy, create a new **Compose** application (type **Compose**, *not*
   "Application") pointing at this repo, compose path
   `infra/musicbox/docker-compose.yml`.
2. (Optional) set `MUSICBOX_PORT` if `8480` clashes with something on the host.
3. Deploy. First build clones music-box and builds `software/Dockerfile`.
4. Open `http://<home-server-ip>:8480`.

(Tip: give the server a **DHCP reservation** so its IP — and thus the URL —
stays put.)

## Updating

To pick up later changes to the web UI, **redeploy** (Dokploy re-clones and
rebuilds). You can wire a GitHub webhook on the *music-box* repo to auto-redeploy,
the same way the `web` service does.

## Editing the card map

The card → favorite map (`software/cards.json`) is **baked into the image**.
To change it, edit `cards.json` in the music-box repo, push, and redeploy.
(A later iteration could bind-mount it as a volume for live edits; for now a
redeploy is fine while ironing out edges.)

## Troubleshooting

- **`Starting nixpacks build... Failed to read app source directory / Not a
  directory`** — the service was created as a Dokploy **Application** (which
  uses the Nixpacks auto-builder) instead of a **Compose** service. Nixpacks
  ignores this compose file and the `Dockerfile`. Recreate the service as type
  **Compose** with the compose path above.

## Notes

- **One gunicorn worker on purpose** — the box's state (armed rooms, playing,
  card on the spot) is in-process, so multiple workers would show inconsistent
  UI. Fine for a single-user LAN tool.
- This is a stepping stone toward the on-device config web app; the same Flask
  code will grow the card-enrollment view later.
