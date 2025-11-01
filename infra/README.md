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

Note: pgBackRest configuration for the repository (Cloudflare R2/S3) will be added in a later step.

