#!/usr/bin/env bash
set -euo pipefail

# Determine repository root based on this script's location
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/../.." && pwd)"

compose_file="$repo_dir/infra/docker-compose.yml"
env_file="$repo_dir/infra/.env"

backup_type="${1:-full}"
if [[ "$backup_type" != "full" && "$backup_type" != "diff" ]]; then
  echo "Usage: $0 [full|diff]" >&2
  exit 1
fi

if [[ ! -f "$compose_file" ]]; then
  echo "docker-compose file not found: $compose_file" >&2
  exit 1
fi

if [[ ! -f "$env_file" ]]; then
  echo "infra/.env not found: $env_file" >&2
  echo "Create it from infra/env.example before running backups." >&2
  exit 1
fi

echo "Running pgBackRest $backup_type backup for stanza 'main'..."

docker compose \
  -f "$compose_file" \
  --env-file "$env_file" \
  run --rm pgbackrest \
  pgbackrest --stanza=main --type="$backup_type" backup

echo "Backup completed. Show repo info:"
docker compose \
  -f "$compose_file" \
  --env-file "$env_file" \
  run --rm pgbackrest \
  pgbackrest --stanza=main info


