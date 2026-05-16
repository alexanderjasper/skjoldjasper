# Nextcloud backup

Nightly, single-stage: dump + tar → encrypted pCloud. No second local copy
(Immich's restic-on-USB exists for media; Nextcloud is small and pCloud
alone is sufficient for an off-site copy).

## What runs

- **`/usr/local/sbin/nextcloud-backup.sh`** — installed from
  `infra/nextcloud/backup.sh`. Runs as root from a systemd timer; does
  maintenance-mode on → pg_dump → tar files → rclone copy → retention.
- **`nextcloud-backup.timer`** — daily at 03:00 UTC ±30 min jitter,
  between Immich's two timers. `Persistent=true`, so a missed run
  catches up at boot.

## Artifacts on pCloud

Encrypted via the `pcloudcrypt:` rclone crypt remote (same one Immich
uses for its off-site copy). Two flat folders, one file per run:

```
pcloudcrypt:.backups/nextcloud/
├── db/    nextcloud-db-<UTC-timestamp>.dump          (pg_dump custom format)
└── files/ nextcloud-files-<UTC-timestamp>.tar.zst    (whole data dir)
```

The leading dot hides the root in the pCloud UI. (Cosmetic on the crypt
side — the actual stored names are encrypted gibberish anyway.)

## Retention

Anything older than 21 days is removed on the remote. Set in the script
as `KEEP_DAYS=21` (overridable via env). Three weeks of dailies gives a
generous window to notice a problem and roll back; longer history would
just bloat the pCloud quota.

## Health check

```sh
systemctl list-timers nextcloud-backup.timer
journalctl -u nextcloud-backup.service --since '24 hours ago' | tail -50
tail -30 /var/log/nextcloud-backup.log
rclone --config /home/alexander/.config/rclone/rclone.conf \
    lsl pcloudcrypt:.backups/nextcloud/db/ | tail
```

Latest dump should be < 26 h old. Log should end with `finished with
exit code 0`. If maintenance mode is on after an unscheduled hour,
something went wrong — clear it manually:

```sh
docker exec --user www-data <nextcloud-container> php occ maintenance:mode --off
```

(The script's EXIT trap clears it on any failure, but check anyway.)

## Restore drill

Test this once, end to end, before relying on it. Both halves restore
independently — you can restore just the DB, or just the files, or both.

### 1. Pull a snapshot back from pCloud

```sh
TS=2026-05-16T030000Z   # pick any timestamp from `rclone lsl …`
RCFG=/home/alexander/.config/rclone/rclone.conf
mkdir -p /tmp/nc-restore
rclone --config $RCFG copy "pcloudcrypt:.backups/nextcloud/db/nextcloud-db-$TS.dump" /tmp/nc-restore/
rclone --config $RCFG copy "pcloudcrypt:.backups/nextcloud/files/nextcloud-files-$TS.tar.zst" /tmp/nc-restore/
```

### 2. Restore the files (out-of-place, then swap if you like)

```sh
mkdir -p /tmp/nc-restore/files
tar --zstd -xf /tmp/nc-restore/nextcloud-files-$TS.tar.zst -C /tmp/nc-restore/files
# Inspect, then either rsync into place or replace the live dir.
```

### 3. Restore the database (with Nextcloud stopped)

```sh
# Find the compose project name from `docker ps --format … --filter …`
NC=$(docker ps -q --filter 'label=com.docker.compose.service=nextcloud' \
                  --filter 'label=com.docker.compose.project=skjoldjasper-nextcloud-xuv26s')
PG=$(docker ps -q --filter 'label=com.docker.compose.service=nextcloud-postgres' \
                  --filter 'label=com.docker.compose.project=skjoldjasper-nextcloud-xuv26s')

docker stop "$NC"
docker exec "$PG" psql -U nextcloud_user -d postgres -c "DROP DATABASE nextcloud;"
docker exec "$PG" psql -U nextcloud_user -d postgres -c "CREATE DATABASE nextcloud OWNER nextcloud_user;"
docker cp /tmp/nc-restore/nextcloud-db-$TS.dump "$PG":/tmp/restore.dump
docker exec "$PG" pg_restore -U nextcloud_user -d nextcloud --no-owner --no-acl /tmp/restore.dump
docker exec "$PG" rm -f /tmp/restore.dump
docker start "$NC"
docker exec --user www-data "$NC" php occ status
```

If `occ status` shows `installed: true` and `maintenance: false`, you're
done. Log in and spot-check a file you remember.

## Why not restic, like Immich?

Restic gives incremental snapshots with deduplication — valuable for
hundreds of GB of photos. Nextcloud's data here is ~650 MB and grows
slowly; a full tar per day is simpler (one script, one tool) and
recovery is trivial (un-tar, no repo open). If the dataset grows past a
few GB the calculus changes — switch to restic at that point.
