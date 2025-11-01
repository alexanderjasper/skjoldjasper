#!/usr/bin/env bash
set -euo pipefail

# Restore smoke test: fetch latest backup into a throwaway volume and boot Postgres.
# Exits non-zero on failure. Leaves artifacts on failure for debugging.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/../.." && pwd)"

compose_file="$repo_dir/infra/docker-compose.yml"
env_file="$repo_dir/infra/.env"
pg_conf_dir="$repo_dir/infra/pgbackrest/conf.d"
postgres_dockerfile_dir="$repo_dir/infra/postgres"

if [[ ! -f "$compose_file" ]]; then
  echo "docker-compose file not found: $compose_file" >&2
  exit 1
fi

if [[ ! -f "$env_file" ]]; then
  echo "infra/.env not found: $env_file" >&2
  echo "Create it from infra/env.example before running restore tests." >&2
  exit 1
fi

if [[ ! -d "$pg_conf_dir" ]]; then
  echo "pgBackRest conf dir missing: $pg_conf_dir" >&2
  exit 1
fi

timestamp="$(date +%s)"
restore_volume="skjoldjasper-restore-test-data-$timestamp"
container_name="skjoldjasper-restore-test-$timestamp"

echo "[1/5] Creating throwaway Docker volume: $restore_volume"
docker volume create "$restore_volume" >/dev/null

echo "[2/5] Restoring latest backup into volume via pgBackRest..."
docker compose \
  -f "$compose_file" \
  --env-file "$env_file" \
  run --rm \
  -v "$restore_volume:/var/lib/postgresql/data" \
  -v "$pg_conf_dir:/etc/pgbackrest/conf.d:ro" \
  pgbackrest \
  pgbackrest --stanza=main restore

echo "[3/5] Building Postgres image with pgBackRest (for WAL restore on boot)..."
restore_image="$(docker build -q -f "$postgres_dockerfile_dir/Dockerfile" "$postgres_dockerfile_dir")"

echo "[4/5] Starting restored Postgres container: $container_name"
docker run -d \
  --name "$container_name" \
  --env-file "$env_file" \
  -v "$restore_volume:/var/lib/postgresql/data" \
  -v "$pg_conf_dir:/etc/pgbackrest/conf.d:ro" \
  "$restore_image" \
  postgres -c archive_mode=off -c wal_level=replica >/dev/null

echo "Waiting for Postgres to become ready (up to 120s)..."
deadline=$((SECONDS + 120))
ready=0
while (( SECONDS < deadline )); do
  if docker exec "$container_name" pg_isready >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done

if (( ready == 0 )); then
  echo "[FAIL] Postgres did not become ready in time. Container logs:" >&2
  docker logs --tail 200 "$container_name" || true
  echo "Leaving container '$container_name' and volume '$restore_volume' for debugging." >&2
  exit 2
fi

echo "[5/5] Restore smoke test PASSED. Cleaning up..."
docker rm -f "$container_name" >/dev/null
docker volume rm "$restore_volume" >/dev/null
echo "Done."


