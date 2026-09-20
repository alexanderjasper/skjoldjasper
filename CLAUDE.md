# skjoldjasper Development Guidelines

## Stack

- .NET 10 on Blazor Web App (static SSR, interactive server islands where needed)
- [Marten](https://martendb.io) 9 for event sourcing and documents, on Postgres 18
- [Wolverine](https://wolverinefx.net) 6 for command handling, with the Marten outbox
- ASP.NET Core Identity for authentication (username + password, signup closed, no email)
- Deployed behind Cloudflare Tunnel + Traefik via Dokploy

## Project Structure

```text
src/
├── Skjoldjasper.sln(x)
├── Directory.Packages.props   # all package versions, pinned centrally
├── Directory.Build.props      # shared TFM and compiler settings
├── Dockerfile
├── Skjoldjasper.Web/          # the only deployable: host, layout, routing, wiring
│   ├── Cli/                   # JasperFx CLI commands (migrate, users-add)
│   └── Identity/              # sign-in: EF Core Identity in its own schema
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

`identity` holds the EF Core Identity tables, `public` holds Marten's event
store and Wolverine's message tables. The `migrate` command applies both and
runs as a one-shot compose service before the app starts; the app never
migrates itself.

```bash
dotnet run --project Skjoldjasper.Web -- migrate     # EF migrations + Marten/Wolverine
dotnet run --project Skjoldjasper.Web -- db-assert   # fail if Marten has drifted
```

## Style

- Near-zero comments. No justification, no narration, nothing inferrable from
  the code. A comment survives only if changing that line would silently break
  something elsewhere. Rationale belongs in the commit message.
- Prefer server-rendered Blazor over client interactivity; reach for
  `InteractiveServer` only where a page genuinely needs live behaviour.
- Event sourcing is the default for domain state. Invariants belong in the
  aggregate, not in database constraints or UI validation.
- One class per file, named after the class. This includes types that would
  otherwise sit in a Razor component's `@code` block.
- Domain modules are organised CQRS-style into `Commands/` and `Queries/`.
  Auxiliary subsystems that are not event-sourced — Identity, for one — are
  plain services and should not be forced behind the mediator.
