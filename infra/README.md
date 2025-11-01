# Infra

## Postgres + pgBackRest (Docker Compose)

1) Create an `.env` file next to `docker-compose.yml` with:

```
POSTGRES_USER=app
POSTGRES_PASSWORD=app-password-change-me
POSTGRES_DB=appdb
```

2) Start services:

```
docker compose -f infra/docker-compose.yml up -d
```

3) Verify health:

```
docker compose -f infra/docker-compose.yml ps
```

Expected: `postgres` is `running (healthy)`.

Stop services:

```
docker compose -f infra/docker-compose.yml down -v
```

### Configure pgBackRest with Cloudflare R2

1) Create `infra/.env` from `infra/env.example` and set:

```
PGBACKREST_REPO1_S3_BUCKET=...
PGBACKREST_REPO1_S3_ENDPOINT=YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
PGBACKREST_REPO1_S3_KEY=...
PGBACKREST_REPO1_S3_KEY_SECRET=...
PGBACKREST_REPO1_S3_REGION=auto
```

2) Create stanza and verify (starts pgBackRest container only for the command):

```
docker compose -f infra/docker-compose.yml --env-file infra/.env run --rm pgbackrest pgbackrest --stanza=main stanza-create
docker compose -f infra/docker-compose.yml --env-file infra/.env run --rm pgbackrest pgbackrest --stanza=main info
```


### Restore smoke test (ephemeral)

Prerequisites:
- You have completed an initial FULL backup to R2 (`pgbackrest info` lists a backup)
- `infra/.env` is populated with the S3/R2 credentials

Run the smoke test:

```
./infra/scripts/pgbackrest-restore-smoke.sh
```

What it does:
- Creates a throwaway Docker volume
- Runs `pgbackrest restore` into that volume
- Boots a temporary Postgres container using the restored data (with pgBackRest config mounted for WAL restore)
- Waits for readiness, then cleans up the container and volume

Expected output:
- Ends with `Restore smoke test PASSED. Cleaning up...` and deletes temporary resources

On failure:
- The script prints the last container logs and leaves the container and volume for inspection
- Clean up manually when done:

```
docker rm -f <container-name>
docker volume rm <volume-name>
```

Expected: stanza-create completes successfully; `info` lists stanza `main`.
Note: `check` may require a PostgreSQL local socket inside the same container. If desired, run `check` inside the DB container with pgBackRest installed.

### Backups (initial full + scheduling)

1) Run initial FULL backup:

```
./infra/scripts/pgbackrest-backup.sh full
```

2) Optional: run DIFF backup manually to test:

```
./infra/scripts/pgbackrest-backup.sh diff
```

3) Install cron schedule (weekly FULL Sunday 02:00, daily DIFF Mon–Sat 02:00):

```
crontab infra/cron/pgbackrest.cron
```

4) Verify repo and latest backup metadata:

```
docker compose -f infra/docker-compose.yml --env-file infra/.env run --rm pgbackrest pgbackrest --stanza=main info
```

