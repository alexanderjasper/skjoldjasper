#!/usr/bin/env bash
# Nightly Nextcloud backup → pCloud (encrypted via rclone crypt remote).
#
# Installed on the host (not in a container) at /usr/local/sbin/nextcloud-backup.sh
# and fired by /etc/systemd/system/nextcloud-backup.timer. Runs as root so it
# can docker-exec and read alexander's rclone config without permission gymnastics.
#
# Output: two dated artifacts per run, pushed to a flat per-type folder:
#   <ROOT>/db/nextcloud-db-<ts>.dump          (~1 MB, pg_dump custom format)
#   <ROOT>/files/nextcloud-files-<ts>.tar.zst (data dir, zstd-compressed)
#
# Retention: rclone delete --min-age on each folder. Anything older than
# KEEP_DAYS days is removed *on the remote* (irreversible — restic-style snapshot
# history isn't needed here; a single day's archive is a complete restore).

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────
PROJECT="${NEXTCLOUD_PROJECT:-skjoldjasper-nextcloud-xuv26s}"
DATA_DIR="${NEXTCLOUD_DATA_DIR:-/home/alexander/nextcloud/files}"
RCLONE_CONFIG="${RCLONE_CONFIG:-/home/alexander/.config/rclone/rclone.conf}"
RCLONE_REMOTE="${RCLONE_REMOTE:-pcloudcrypt:.backups/nextcloud}"
LOG_FILE="${LOG_FILE:-/var/log/nextcloud-backup.log}"
TMPDIR="${TMPDIR:-/var/tmp/nextcloud-backup}"
KEEP_DAYS="${KEEP_DAYS:-21}"   # ~3 weeks, slightly more than the planned 14 dailies

# ── Setup ─────────────────────────────────────────────────────────────────
mkdir -p "$TMPDIR" "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1

TS="$(date -u +%Y-%m-%dT%H%M%SZ)"
DUMP="$TMPDIR/nextcloud-db-$TS.dump"
TAR="$TMPDIR/nextcloud-files-$TS.tar.zst"

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

log "=== Nextcloud backup started: $TS ==="

# Discover containers by compose labels (Dokploy's project suffix is stable
# until the service is recreated; if you ever recreate it, set NEXTCLOUD_PROJECT).
NC=$(docker ps -q --filter "label=com.docker.compose.project=$PROJECT" --filter "label=com.docker.compose.service=nextcloud")
PG=$(docker ps -q --filter "label=com.docker.compose.project=$PROJECT" --filter "label=com.docker.compose.service=nextcloud-postgres")
if [[ -z "$NC" || -z "$PG" ]]; then
  log "ERROR: could not locate containers (project=$PROJECT). Live containers:"
  docker ps --format '  {{.Names}} (project={{.Label "com.docker.compose.project"}}, service={{.Label "com.docker.compose.service"}})'
  exit 1
fi
log "Using nextcloud=$NC postgres=$PG"

# Read the DB password directly from config.php — keeps the script in sync with
# whatever credential the live install is actually using and avoids a second
# source of truth.
DB_PASSWORD=$(docker exec "$NC" sh -c 'grep -oP "(?<='\''dbpassword'\'' => '\'').*?(?='\'',)" /var/www/html/config/config.php')
if [[ -z "$DB_PASSWORD" ]]; then
  log "ERROR: failed to read dbpassword from config.php"
  exit 1
fi

# Always drop maintenance mode on exit, even if a later step fails. Important —
# a forgotten maintenance:on locks the site until manually cleared.
cleanup() {
  local rc=$?
  log "--- cleanup: maintenance mode off ---"
  docker exec --user www-data "$NC" php occ maintenance:mode --off || true
  rm -f "$DUMP" "$TAR"
  log "=== finished with exit code $rc at $(date -u +%Y-%m-%dT%H%M%SZ) ==="
}
trap cleanup EXIT

# ── 1. Maintenance mode on ────────────────────────────────────────────────
log "--- maintenance mode on ---"
docker exec --user www-data "$NC" php occ maintenance:mode --on

# ── 2. DB dump ────────────────────────────────────────────────────────────
log "--- pg_dump (custom format) ---"
docker exec -e PGPASSWORD="$DB_PASSWORD" "$PG" \
  pg_dump -U nextcloud_user -d nextcloud -Fc --compress=9 \
  > "$DUMP"
[[ -s "$DUMP" ]] || { log "ERROR: dump is empty"; exit 1; }
log "Dump size: $(du -h "$DUMP" | cut -f1)"

# Sanity-check the dump is readable before we trust it as a backup.
docker exec -i "$PG" pg_restore -l > /dev/null < "$DUMP"
log "Dump TOC parses cleanly."

# ── 3. Files tarball ──────────────────────────────────────────────────────
log "--- tar files dir ($DATA_DIR) ---"
tar --zstd -cf "$TAR" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
log "Tar size: $(du -h "$TAR" | cut -f1)"

# ── 4. Push to pCloud ─────────────────────────────────────────────────────
log "--- rclone copy → $RCLONE_REMOTE ---"
rclone --config "$RCLONE_CONFIG" copyto "$DUMP" "$RCLONE_REMOTE/db/nextcloud-db-$TS.dump" --transfers=2
rclone --config "$RCLONE_CONFIG" copyto "$TAR"  "$RCLONE_REMOTE/files/nextcloud-files-$TS.tar.zst" --transfers=2

# ── 5. Retention ──────────────────────────────────────────────────────────
log "--- retention: delete >${KEEP_DAYS}d on remote ---"
rclone --config "$RCLONE_CONFIG" delete "$RCLONE_REMOTE/db/" --min-age "${KEEP_DAYS}d"
rclone --config "$RCLONE_CONFIG" delete "$RCLONE_REMOTE/files/" --min-age "${KEEP_DAYS}d"

log "--- remote inventory ---"
rclone --config "$RCLONE_CONFIG" lsl "$RCLONE_REMOTE/db/"    | tail -5
rclone --config "$RCLONE_CONFIG" lsl "$RCLONE_REMOTE/files/" | tail -5

# cleanup() handles maintenance:off + tmp removal via the EXIT trap.
