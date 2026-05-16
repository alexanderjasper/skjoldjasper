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
                              WebDAV PUT
                                    ▼
                           pCloud /skjoldjasper-backups/
```

## One-time setup

1. On pCloud, create a top-level folder `skjoldjasper-backups`. (Litestream will not create the bucket itself.)
2. Generate an rclone-obscured WebDAV password:
   ```sh
   docker run --rm -it rclone/rclone obscure 'your-pcloud-app-password'
   ```
3. In Dokploy, set the env vars from `.env.example` on this service.

## Verifying the replica

```sh
docker exec skjoldjasper-litestream litestream snapshots /data/db.sqlite3
```

Lists every snapshot stored on pCloud. Empty output means replication isn't happening.

## Restore drill

Run this once after the first deploy and any time you change the replica config:

```sh
# 1. Note the current DB hash.
docker exec skjoldjasper-web sha256sum /data/db.sqlite3

# 2. Stop the app so it can't write during restore.
docker compose stop web

# 3. Move the live DB aside.
docker exec skjoldjasper-litestream sh -c 'mv /data/db.sqlite3 /data/db.sqlite3.predr'

# 4. Restore from the replica.
docker exec skjoldjasper-litestream litestream restore /data/db.sqlite3

# 5. Confirm the hash matches.
docker exec skjoldjasper-litestream sha256sum /data/db.sqlite3

# 6. Bring the app back.
docker compose start web
```

## Why not just back up SQLite nightly with rclone copy?

Litestream's continuous WAL streaming gives ~1s RPO; a nightly snapshot
loses up to 24h. For a file that fits in a single rclone copy, the
diference is "did I lose today's entries?" vs "no, I didn't." The cost
is one extra container.
