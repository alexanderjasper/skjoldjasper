#!/usr/bin/env bash
# Nightly skjoldjasper.dk database backup → pCloud.
#
# Installed at /usr/local/sbin/skjoldjasper-web-backup.sh and fired by
# skjoldjasper-web-backup.timer. Runs as root to docker-exec and to read
# alexander's rclone config.

set -euo pipefail

PG_CONTAINER="${PG_CONTAINER:-skjoldjasper_postgres}"
DB_NAME="${DB_NAME:-skjoldjasper}"
DB_USER="${DB_USER:-skjoldjasper}"
RCLONE_CONFIG="${RCLONE_CONFIG:-/home/alexander/.config/rclone/rclone.conf}"
RCLONE_REMOTE="${RCLONE_REMOTE:-pcloudcrypt:.backups/skjoldjasper-web}"
LOG_FILE="${LOG_FILE:-/var/log/skjoldjasper-web-backup.log}"
TMPDIR="${TMPDIR:-/var/tmp/skjoldjasper-web-backup}"
KEEP_DAYS="${KEEP_DAYS:-21}"

mkdir -p "$TMPDIR" "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1

TS="$(date -u +%Y-%m-%dT%H%M%SZ)"
DUMP="$TMPDIR/skjoldjasper-web-db-$TS.dump"

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

cleanup() {
  local rc=$?
  rm -f "$DUMP"
  log "=== finished with exit code $rc at $(date -u +%Y-%m-%dT%H%M%SZ) ==="
}
trap cleanup EXIT

log "=== skjoldjasper web backup started: $TS ==="

if ! docker ps -q --filter "name=^${PG_CONTAINER}$" | grep -q .; then
  log "ERROR: container $PG_CONTAINER is not running. Live containers:"
  docker ps --format '  {{.Names}}'
  exit 1
fi

log "--- pg_dump (custom format) ---"
docker exec "$PG_CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc --compress=9 \
  > "$DUMP"
[[ -s "$DUMP" ]] || { log "ERROR: dump is empty"; exit 1; }
log "Dump size: $(du -h "$DUMP" | cut -f1)"

docker exec -i "$PG_CONTAINER" pg_restore -l > /dev/null < "$DUMP"
log "Dump TOC parses cleanly."

log "--- rclone copy → $RCLONE_REMOTE ---"
rclone --config "$RCLONE_CONFIG" copyto \
  "$DUMP" "$RCLONE_REMOTE/db/skjoldjasper-web-db-$TS.dump"

log "--- retention: delete >${KEEP_DAYS}d on remote ---"
rclone --config "$RCLONE_CONFIG" delete "$RCLONE_REMOTE/db/" --min-age "${KEEP_DAYS}d"

log "--- remote inventory ---"
rclone --config "$RCLONE_CONFIG" lsl "$RCLONE_REMOTE/db/" | tail -5
