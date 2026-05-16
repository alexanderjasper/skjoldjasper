# Immich backup

A pre-existing 3-2-1 setup runs on the host *outside* this repo. It is
not managed by Dokploy and is intentionally left alone — these notes
exist so it stays findable.

## Topology

| Copy | What | Where |
|---|---|---|
| 1 (live) | photo library + Postgres | `/home/alexander/Immich/library`, `immich_postgres` container |
| 2 (local) | restic repo on a dedicated 1.8 TB disk | `/mnt/immich-backup/restic` |
| 3 (off-site) | encrypted mirror in pCloud | `pcloudcrypt:restic` (rclone crypt remote) |

> **Backup-root convention:** every other service in this repo stores backups
> under `pcloudcrypt:.backups/<service>/` (Nextcloud, future additions). This
> repo predates that convention and sits at `pcloudcrypt:restic` — moving it
> would mean re-uploading 476 GiB through the crypt remote (filename changes
> don't survive server-side on encrypted remotes). Leave it. If we ever rotate
> the restic key or rebuild the repo, do that at the new path.

The local restic repo is reached via mount `/mnt/immich-backup`. The
systemd units guard on `RequiresMountsFor=/mnt/immich-backup`, so if
the disk is missing they fail loud instead of writing to `/`.

## Schedule

Two timers on the host:

- `immich-backup.timer` — daily at 02:30 UTC (±30 min jitter). Runs
  `/usr/local/sbin/immich-backup.sh`: `pg_dump` (custom format) from
  `immich_postgres` → restic snapshot of the library + dump → restic
  forget/prune.
- `immich-offsite.timer` — daily at 04:00 UTC (±30 min jitter). Runs
  `rclone sync /mnt/immich-backup/restic pcloudcrypt:restic`. Sequenced
  via `After=immich-backup.service`.

Both are `Persistent=true`, so a missed run (host off, disk unmounted)
catches up at boot.

Retention (set in the backup script): 7 daily, 4 weekly, 12 monthly
restic snapshots; plus the last 7 raw `pg_dump` files kept under
`/mnt/immich-backup/tmp/` for fast restores.

## Secrets

- `RESTIC_PASSWORD_FILE=/etc/restic/immich-repo.pw` — repo password
- `rclone` config at `/home/alexander/.config/rclone/rclone.conf` —
  holds the `pcloudcrypt:` crypt remote (which wraps a separate
  pCloud OAuth remote). Different remote than the Litestream one
  in `infra/web/` so the keys can rotate independently.

## Health check

```sh
systemctl list-timers immich-backup.timer immich-offsite.timer
sudo -E RESTIC_PASSWORD_FILE=/etc/restic/immich-repo.pw \
    restic -r /mnt/immich-backup/restic snapshots --tag immich | tail
ls -lh /mnt/immich-backup/tmp/immich-db-*.dump | tail -3
tail -50 /mnt/immich-backup/logs/immich-backup-*.log
```

Both timers should show a recent `LAST` and a future `NEXT`. The latest
restic snapshot should be < 26 h old. The most recent log should end
with `Immich backup finished:`.

## Restore drill

### Library files only

```sh
sudo -E RESTIC_PASSWORD_FILE=/etc/restic/immich-repo.pw \
    restic -r /mnt/immich-backup/restic restore latest \
    --target /tmp/immich-restore \
    --include /home/alexander/Immich/library
```

### Database from the last pg_dump

```sh
# Find the latest dump
ls -1t /mnt/immich-backup/tmp/immich-db-*.dump | head -1

# With Immich stopped (so nothing else is writing):
docker stop immich_server
docker exec -i immich_postgres dropdb -U postgres immich
docker exec -i immich_postgres createdb -U postgres immich
docker cp <dumpfile> immich_postgres:/tmp/restore.dump
docker exec immich_postgres pg_restore -U postgres -d immich /tmp/restore.dump
docker exec immich_postgres rm -f /tmp/restore.dump
docker start immich_server
```

### Full DR from pCloud (local disk lost)

1. Restore the restic repo first: `rclone sync pcloudcrypt:restic <new-disk>/restic`.
2. Pull library + the latest dump out of restic: `restic restore latest --target /tmp/r --include /home/alexander/Immich/library --include /mnt/immich-backup/tmp` (yes, `tmp` is part of the snapshot tags).
3. Bring up the stack (`infra/immich/docker-compose.yml`) pointing at the restored library path.
4. Run the database-restore steps above with the recovered dump.

## Why this isn't in the repo

The script and timers predate this repo and run as root with paths that
assume the host's filesystem layout. Pulling them in would mean either
running root cron via Dokploy (it can't) or rewriting them as a
sidecar (extra moving parts for a system that already works). The right
trade-off is to keep them where they are and pin the contract: "the DB
container is named `immich_postgres`" — which is now enforced by
`docker-compose.yml`.
