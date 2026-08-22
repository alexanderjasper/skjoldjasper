# `infra/dlna` — DLNA/UPnP in front of Immich (LAN-only)

Immich ships no DLNA server. [Gerbera](https://gerbera.io) (the maintained
MediaTomb/ReadyMedia successor) reads Immich's files straight off disk,
**read-only**, and advertises them to TVs and other UPnP renderers.

| Container | What it does |
|---|---|
| `gerbera` | UPnP/DLNA media server. Web UI on `:49494`, SSDP on `:1900/udp`, media served over HTTP on the LAN. |

Not on the public site — no Cloudflare Tunnel, no Traefik. Reachable only on
the LAN at `http://<home-server-ip>:49494` for the admin UI; the TV finds the
server itself via SSDP.

## Why host networking

`network_mode: host` is load-bearing, same reason as `infra/musicbox`:

- **SSDP discovery is multicast** and does not cross Docker's bridge network.
  On a bridge the container runs fine and no renderer ever sees it.
- **Renderers fetch media over plain HTTP** from an address Gerbera advertises
  about itself. Behind NAT it would advertise a `172.x` bridge address the TV
  cannot reach.

The trade-off: port `49494` is open on the LAN with **no authentication**, and
Dokploy's Traefik is bypassed entirely. Acceptable for a home LAN; if it isn't,
Gerbera's `config.xml` has a `<ui>` account block you can enable after first run.

## Deploy (Dokploy)

1. In Dokploy, create a new **Compose** application — type **Compose**, *not*
   "Application", or the deploy tries a Nixpacks build and fails with
   `Failed to read app source directory` (see `infra/musicbox/README.md`).
   Point it at this repo, compose path `infra/dlna/docker-compose.yml`.
2. Set the env vars from `.env.example` in the Dokploy UI. `IMMICH_UPLOAD_LOCATION`
   must match `UPLOAD_LOCATION` in `infra/immich/.env`.
3. Deploy.
4. Open `http://<home-server-ip>:49494` and add the content directories
   (below) as **autoscan** dirs.

## First-run configuration

The image ships no library config; the mounts alone do nothing until you add
them in the web UI. Under **Filesystem**, for each directory you want, click the
scan icon and add it as **Timed** or **Inotify**, recursive, ignore-unknown off:

| Mount | Contents | Add it when |
|---|---|---|
| `/media/photos` | Immich originals | Always — unless the library is mostly HEIC |
| `/media/videos` | Immich's H.264 transcodes | Always, in preference to original video |
| `/media/previews` | JPEG thumbnails | The phone shoots HEIC/AVIF |

Inotify on a large library costs a watch descriptor per directory; if the scan
stalls, raise `fs.inotify.max_user_watches` on the host or switch to Timed.

## Three things that will bite you

- **Filenames.** With Immich's storage template engine **off**, originals live at
  `library/<user-id>/ab/cd/<uuid>.jpg` — indexable, but unnavigable on a TV
  remote. Turn on Admin → Settings → Storage Template *first* (it rewrites
  existing files) to get `library/<user>/2026/2026-08-22/IMG_1234.jpg`.
- **HEIC/HEIF/AVIF do not render** on essentially any DLNA client. Mount
  `/media/previews` instead of, or alongside, the originals.
- **Video codecs.** Originals may be HEVC/10-bit. `/media/videos` holds Immich's
  H.264 transcodes, which is why it is a separate mount — point the TV there.

## Updating

Bump `GERBERA_VERSION` in the Dokploy env and redeploy. The SQLite index in the
`gerbera-config` volume survives; Gerbera migrates its schema on start.

If an upgrade goes wrong, deleting the `gerbera-config` volume is safe — it
costs a full rescan and the UI config, nothing else. The library is read-only.

## The `-transcoding` variant

`gerbera/gerbera:3.2.1-transcoding` bundles ffmpeg, letting Gerbera convert on
the fly for renderers that refuse a format. It is **off by default** even in
that image — it needs transcoding profiles written into `config.xml`, and it
transcodes on the host CPU per stream.

Reach for it only if a specific TV rejects specific files. If you find yourself
writing several profiles, run Jellyfin instead: it does this properly, with
hardware acceleration, at the cost of a much heavier service and a second media
library to keep in sync.
