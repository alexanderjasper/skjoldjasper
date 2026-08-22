# `infra/dlna` — DLNA/UPnP in front of Immich (LAN-only)

Immich ships no DLNA server. [immich-dlna](https://github.com/SemaiCZE/immich-dlna)
reads Immich over its **REST API** and re-publishes it as a UPnP/DLNA media
server, so the browse tree on the TV mirrors Immich: Timeline and Albums,
including shared albums and partner content.

| Container | What it does |
|---|---|
| `immich-dlna` | DLNA server. SSDP on `:1900/udp`, HTTP (device description + media proxy) on `:8200`. |

Not on the public site — no Cloudflare Tunnel, no Traefik. The TV discovers the
server itself over SSDP; there is no UI to visit.

> Earlier this directory ran [Gerbera](https://gerbera.io) against the library on
> disk. That worked, but Immich albums are database rows with no filesystem
> existence, so albums could not be browsed at all — which was the point of the
> exercise. See git history if you need it back.

## Why host networking

`network_mode: host` is load-bearing, same reason as `infra/musicbox`:

- **SSDP discovery is multicast** and does not cross Docker's bridge network.
  On a bridge the container runs fine and no renderer ever sees it.
- **Renderers fetch media over plain HTTP** from an address the server
  advertises about itself. Behind NAT it advertises a `172.x` address the TV
  cannot reach. (`IMMICH_DLNA_BASE_URL` can override this, but then multicast
  still has to be solved separately.)

## Reaching Immich

Immich's port `2283` is not exposed to the LAN — traffic enters through Traefik,
matched on `Host`. A host-networked container therefore cannot reach the API by
container name, and hitting `127.0.0.1:80` sends a Host header matching neither
router.

So `infra/immich/docker-compose.yml` publishes `127.0.0.1:2283:2283` —
loopback only, not LAN-visible — and `IMMICH_URL` points at that. Both stacks
must be deployed for this to work.

## Version compatibility

`v0.2.0` fetches album assets via `POST /search/metadata` with `albumIds`, the
**Immich v3** API. It does not work against Immich v2, which used
`GET /albums/{id}?withoutAssets=false`. Pin `v0.1.1` for Immich v2.

## Deploy (Dokploy)

1. Create a new **Compose** application — type **Compose**, *not* "Application",
   or the deploy tries a Nixpacks build and fails with `Failed to read app source
   directory` (see `infra/musicbox/README.md`). Compose path
   `infra/dlna/docker-compose.yml`.
2. Create a **read-only API key** in Immich (Account Settings → API Keys).
3. Set the env vars from `.env.example` in the Dokploy UI, `IMMICH_API_TOKEN`
   included. Leave **Isolated Deployment** off.
4. Deploy, then look for the server in the TV's media-source list.

`IMMICH_DLNA_SERVER_UUID` must be **stable across restarts**. Left unset the
server generates a fresh one each boot and TVs accumulate stale duplicates.

## Known rough edges

- **Alpha.** 15 commits, one author, no release notes, MIT. Read the diff before
  bumping a version.
- **No transcoding** — assets are proxied at native quality. HEIC/HEVC that the
  TV refuses will still be refused; there is no `encoded-video/` fallback to
  point at the way there was under Gerbera.
- **All media flows through the Python proxy** rather than being served off disk.
  Fine on a LAN, but it is a hop that did not exist before.

## Troubleshooting

- **TV finds nothing** — almost always networking. Confirm `network_mode: host`
  took effect and that the server and TV are on the same LAN/VLAN (multicast
  does not route between VLANs).
- **Server appears, browsing is empty** — API token or URL. `curl
  http://127.0.0.1:8200/health` on the host, then check the container logs for
  upstream 401s.
- **Duplicate servers on the TV** — unpinned `IMMICH_DLNA_SERVER_UUID`. Pin it,
  then clear the TV's media-source cache.

Prometheus metrics are at `:8200/metrics` if you ever want them.
