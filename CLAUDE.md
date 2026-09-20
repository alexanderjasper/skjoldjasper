# skjoldjasper Development Guidelines

## Stack

- .NET 10 on Blazor Web App (static SSR, interactive server islands where needed)
- [Marten](https://martendb.io) 9 for event sourcing and documents, on Postgres 18
- [Wolverine](https://wolverinefx.net) 6 for command handling, with the Marten outbox
- ASP.NET Core Identity for authentication (email + password, signup closed)
- Deployed behind Cloudflare Tunnel + Traefik via Dokploy

## Project Structure

```text
src/
├── Skjoldjasper.sln(x)
├── Directory.Packages.props   # all package versions, pinned centrally
├── Directory.Build.props      # shared TFM and compiler settings
├── Dockerfile
├── Skjoldjasper.Web/          # the only deployable: host, layout, routing, wiring
├── Skjoldjasper.Finance/      # feature module: domain and pages
└── Skjoldjasper.Finance.Tests/

infra/                         # Docker Compose, Dokploy, backups
```

Feature modules (finance, games, …) are Razor class libraries that own their
domain *and* their Blazor pages. Each exposes one registration method, so
`Program.cs` reads like Django's `INSTALLED_APPS`:

```csharp
builder.Services.AddFinance();
```

Adding a module means a new class library, one line in `Program.cs`, and its
assembly added to Wolverine's discovery and the Blazor router. Keep
`Skjoldjasper.Web` lean — domain logic belongs in the module libraries.

## Running locally

Postgres must be running first; the app will not boot without it.

```bash
podman run -d --name skjoldjasper-dev-db --replace \
  -e POSTGRES_USER=skjoldjasper -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=skjoldjasper \
  -p 127.0.0.1:5433:5432 -v skjoldjasper-dev-db:/var/lib/postgresql \
  docker.io/library/postgres:18

cd src
dotnet run --project Skjoldjasper.Web    # http://localhost:5199
dotnet test
```

Note the volume mounts at `/var/lib/postgresql`, **not** `/var/lib/postgresql/data`:
Postgres 18 changed the convention and refuses to start against the old layout.

## Database schema

Development uses `AutoCreate.CreateOrUpdate`; production uses `AutoCreate.None`
with an explicit apply step at container boot.

```bash
dotnet run --project Skjoldjasper.Web -- db-apply    # apply changes
dotnet run --project Skjoldjasper.Web -- db-assert   # fail if drifted
dotnet run --project Skjoldjasper.Web -- db-dump     # print the DDL
```

## Style

- Near-zero comments. No justification, no narration, nothing inferrable from
  the code. A comment survives only if changing that line would silently break
  something elsewhere. Rationale belongs in the commit message.
- Prefer server-rendered Blazor over client interactivity; reach for
  `InteractiveServer` only where a page genuinely needs live behaviour.
- Event sourcing is the default for domain state. Invariants belong in the
  aggregate, not in database constraints or UI validation.
