# skjoldjasper

Personal website at [skjoldjasper.dk](https://skjoldjasper.dk).

A small .NET site hosting a family finance module (modellen) and later other
things — games, etc. Deployed behind Cloudflare Tunnel + Traefik via Dokploy.

It was a Django app until September 2026; the rewrite onto .NET with event
sourcing starts from an empty database. The old code is in the history.

## Stack

- .NET 10 on Blazor (static server rendering, interactive islands where needed)
- [Marten](https://martendb.io) for event sourcing and document storage
- [Wolverine](https://wolverinefx.net) for command handling and the outbox
- ASP.NET Core Identity for sign-in (email + password, signup closed)
- Postgres 18

## Layout

```text
src/                     # the .NET solution
  Skjoldjasper.Web/      # the only deployable — host, layout, routing, wiring
  Skjoldjasper.Finance/  # the finance module: domain and pages
infra/                   # Docker Compose, Dokploy, backups
```

Each feature module is a Razor class library owning both its domain and its
pages, registered with one line in `Program.cs`.

## Local development

See [`src/README.md`](src/README.md). Short version:

```bash
podman run -d --name skjoldjasper-dev-db --replace \
  -e POSTGRES_USER=skjoldjasper -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=skjoldjasper \
  -p 127.0.0.1:5433:5432 -v skjoldjasper-dev-db:/var/lib/postgresql \
  docker.io/library/postgres:18

cd src
dotnet run --project Skjoldjasper.Web    # http://localhost:5199
dotnet test
```

## Configuration

Production settings come from Dokploy's environment. See
`infra/web/.env.example`.

| Var | Purpose |
|---|---|
| `POSTGRES_PASSWORD` | Database password, shared by both containers |
| `ConnectionStrings__Postgres` | Built from the above in the compose file |
| `ASPNETCORE_ENVIRONMENT` | `Production` |

## Deployment

Built from `src/Dockerfile` and rolled out by Dokploy on push to `main`.
Database changes are applied by `db-apply` at container boot. Nightly
`pg_dump` backups go to pCloud; see [`infra/web/README.md`](infra/web/README.md).
