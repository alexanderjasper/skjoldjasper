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
- **HEIC stills need the build-time patch** (below). Upstream advertises the
  original file and its real mime type, so iPhone HEIC reaches the TV as
  undecodable bytes — it shows as a missing image, or "disconnected" on open.
- **Video is not transcoded.** HEVC/10-bit the TV refuses stays refused, and
  unlike Gerbera there is no `encoded-video/` directory to point at instead.
- **All media flows through the Python proxy** rather than being served off disk.
  Fine on a LAN, but it is a hop that did not exist before.

## The HEIC patch

The image is **built, not pulled**: `Dockerfile` layers `patch-preview-jpeg.py`
over the upstream release.

`_to_media_item()` in `catalog.py` advertises `/media/asset/{id}` — the original
file — with the asset's real mime type. `thumbnail_url` is only emitted as
`<upnp:albumArtURI>`, the browse-grid icon, never as a playable resource. So a
TV asking for an iPhone photo gets `image/heic` and gives up.

The patch points stills whose format renderers cannot decode (HEIC/HEIF/AVIF/RAW)
at the existing `/thumbnail` endpoint instead, declaring `image/jpeg`. That
endpoint already requests Immich's `size=preview`, a full-size JPEG (1440px by
default), so quality is fine for a TV. JPEG/PNG/GIF/BMP still stream as
originals at full resolution.

The patch script asserts on the upstream source text, so bumping
`IMMICH_DLNA_VERSION` **fails the build** rather than silently reverting to
broken behaviour. When that happens, re-read `catalog.py` upstream and update the
patch.

This is worth pushing upstream; it is a small change and the endpoint it needs
already exists.

### It depends on an Immich setting

`web.py` falls back to streaming the *original* if Immich's preview does not come
back as a non-WebP image. So if Immich is generating WebP previews, the patch
silently achieves nothing. Check Admin → Settings → Image Settings and keep the
**preview** format as JPEG.

## Troubleshooting

- **TV finds nothing, but `/health` is ok** — check `IMMICH_DLNA_BASE_URL`
  first. Unset, the fallback is `socket.gethostbyname(socket.gethostname())`,
  which is `127.0.1.1` on Debian; the periodic SSDP alive NOTIFY advertises that
  verbatim, so the TV has nothing reachable to fetch. (Unicast replies to an
  active M-SEARCH get corrected by a separate code path, which is why this can
  look intermittent.) Confirm with
  `python3 -c 'import socket;print(socket.gethostbyname(socket.gethostname()))'`.
- **Still nothing** — confirm `network_mode: host` took effect, that port 8200 is
  open to the LAN (`ufw status`), and that server and TV share a LAN/VLAN
  (multicast does not route between VLANs). Watch the announcements with
  `sudo tcpdump -i wlo1 -n -A port 1900 | grep -i location`.
- **Multicast joined on the wrong interface** — `ssdp.py` joins the group on
  `0.0.0.0`, letting the kernel pick by route. On this host, with its many
  `docker0`/`br-*`/`veth*` interfaces, that need not be `wlo1`, and there is no
  env var to override it. Same class of problem as the Avahi gotcha in
  `infra/immich/README.md`.
- **Server appears, browsing is empty** — API token or URL. `curl
  http://127.0.0.1:8200/health` on the host, then check the container logs for
  upstream 401s.
- **Duplicate servers on the TV** — unpinned `IMMICH_DLNA_SERVER_UUID`. Pin it,
  then clear the TV's media-source cache.

- **Photo opens then "disconnected"** — the HEIC patch is not in effect. Confirm
  the deploy actually rebuilt, and check the advertised mime type:
  `curl -s http://127.0.0.1:8200/media/asset/<asset-id>/thumbnail -o /dev/null -w '%{content_type}\n'`
  should print `image/jpeg`.

Prometheus metrics are at `:8200/metrics` if you ever want them.
