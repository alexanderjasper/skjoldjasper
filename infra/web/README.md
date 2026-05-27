# `infra/web` — the website service stack

Three containers serve `skjoldjasper.dk`:

| Container | What it does |
|---|---|
| `web` | The Django app built from `apps/web/Dockerfile`, served by gunicorn. Migrates on every boot. |
| `litestream` | Watches `/data/db.sqlite3` and streams every WAL segment to the rclone S3 bridge below. |
| `rclone` | Runs `rclone serve s3`, presenting the pCloud WebDAV remote as an S3-compatible endpoint that Litestream understands. Litestream does not speak WebDAV natively — this sidecar exists only to bridge the protocol gap. |

## Data flow

```
gunicorn ──writes──> /data/db.sqlite3
                          │
                          └─watched by litestream
                                    │
                              S3 PUT (HTTP, internal)
                                    ▼
                              rclone serve s3
                                    │
                            pCloud API
                                    ▼
                        pcloud:/.backups/web-litestream/
```

## One-time setup

1. On pCloud, create a top-level folder `.backups` and inside it a `web-litestream` folder. (Litestream does not create the bucket itself.)
2. Generate the rclone OAuth token from your laptop:
   ```sh
   docker run --rm -it -p 53682:53682 rclone/rclone authorize "pcloud"
   ```
   This opens a browser, you authorize pCloud once, and rclone prints a JSON
   blob to stdout. That JSON is `RCLONE_PCLOUD_TOKEN`. The OAuth backend is
   used instead of WebDAV because pCloud's WebDAV endpoint refuses logins
   when account 2FA is enabled.
3. In Dokploy, set the env vars from `.env.example` on this service.

## Verifying the replica

```sh
docker compose exec litestream litestream snapshots /data/db.sqlite3
```

Lists every snapshot stored on pCloud. Empty output means replication isn't happening.

## Restore drill

Run this once after the first deploy and any time you change the replica config:

```sh
# 1. Note the current DB hash.
docker compose exec web sha256sum /data/db.sqlite3

# 2. Stop the app so it can't write during restore.
docker compose stop web

# 3. Move the live DB aside, then restore from the replica.
docker compose exec litestream sh -c 'mv /data/db.sqlite3 /data/db.sqlite3.predr'
docker compose exec litestream litestream restore /data/db.sqlite3

# 4. Confirm the hash matches.
docker compose exec litestream sha256sum /data/db.sqlite3

# 5. Bring the app back.
docker compose start web
```

## Auto-deploy on push to `main`

Dokploy redeploys on every push via a **Git webhook** — no GitHub Actions
workflow needed. GitHub POSTs to a Dokploy webhook URL, Dokploy pulls the new
commit, rebuilds the image, and the boot command runs `migrate` and
`ensure_superuser` as usual.

This requires the Dokploy panel to be reachable by GitHub's servers. The
panel sits on a public Cloudflare Tunnel hostname guarded by Dokploy's own
login; we deliberately do **not** put Cloudflare Access in front of it, since
Access would block GitHub's unauthenticated webhook POST.

### One-time setup

1. **Expose the Dokploy panel through the existing Cloudflare Tunnel.** Add a
   public hostname (e.g. `dokploy.skjoldjasper.dk`) routing to the Dokploy
   panel's local port (default `:3000`).

2. **Enable auto-deploy** on the `web` application in the Dokploy UI, then
   copy the generated **webhook URL** from its deployment settings/logs.

3. **Register the webhook in GitHub**: repo → Settings → Webhooks → Add
   webhook. Paste the URL, content type `application/json`, event "Just the
   push event". Make sure the branch Dokploy watches matches `main`.

A push to `main` now triggers a rebuild automatically. You can confirm the
first one fired under the webhook's "Recent Deliveries" in GitHub and in
Dokploy's deployment logs.

## Why not just back up SQLite nightly with rclone copy?

Litestream's continuous WAL streaming gives ~1s RPO; a nightly snapshot
loses up to 24h. For a file that fits in a single rclone copy, the
diference is "did I lose today's entries?" vs "no, I didn't." The cost
is one extra container.
