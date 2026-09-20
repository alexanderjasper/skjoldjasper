# skjoldjasper — .NET

The rewrite of `apps/web/` onto .NET 10 with [Marten](https://martendb.io) and
[Wolverine](https://wolverinefx.net). The Django app keeps running until this
one reaches the point where it can take over.

## Layout

```text
Skjoldjasper.Web/            the only deployable — host, layout, routing, wiring
Skjoldjasper.Finance/        Razor class library: the finance module
Skjoldjasper.Finance.Tests/
```

Each module is a Razor class library that owns its domain *and* its pages, and
exposes one registration method so `Program.cs` reads like Django's
`INSTALLED_APPS`:

```csharp
builder.Services.AddFinance();
```

Adding a module (beer jeopardy, …) means a new class library, one line in
`Program.cs`, and its assembly added to Wolverine's discovery and the Blazor
router.

Package versions are pinned centrally in `Directory.Packages.props`; shared
compiler settings live in `Directory.Build.props`.

## Running locally

Start Postgres (the app will not boot without it):

```bash
podman run -d --name skjoldjasper-dev-db --replace \
  -e POSTGRES_USER=skjoldjasper -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=skjoldjasper \
  -p 127.0.0.1:5433:5432 \
  -v skjoldjasper-dev-db:/var/lib/postgresql \
  --health-cmd 'pg_isready -U skjoldjasper' --health-interval 5s \
  docker.io/library/postgres:18
```

`compose.dev.yml` describes the same container if you ever install a compose
provider for podman — there isn't one on this machine, hence the raw
`podman run`.

Note the volume mounts at `/var/lib/postgresql`, **not** `/var/lib/postgresql/data`:
Postgres 18 changed the convention and refuses to start against the old layout.

Then:

```bash
cd src
dotnet tool restore
dotnet run --project Skjoldjasper.Web -- migrate
ADMIN_USERNAME=you ADMIN_PASSWORD='...' dotnet run --project Skjoldjasper.Web
dotnet test
```

The app runs at http://localhost:5199.

- `/` — placeholder home page
- `/login` — sign in
- `/finance` — placeholder, served from the Finance class library
- `/healthz` — returns `Healthy` only if Postgres is actually reachable

## Accounts

Sign-in is username and password, no email anywhere. Registration is closed:
`ADMIN_USERNAME`/`ADMIN_PASSWORD` seeds one account at boot if it does not
exist, and further accounts come from the CLI.

```bash
dotnet run --project Skjoldjasper.Web -- users-add <username> <password>
```

## Database schema

Two schemas in one database: `identity` holds the EF Core Identity tables,
`public` holds Marten's event store and Wolverine's message tables. Both are
applied by one command, which the container runs before serving:

```bash
dotnet run --project Skjoldjasper.Web -- migrate      # EF migrations + Marten/Wolverine
dotnet run --project Skjoldjasper.Web -- db-assert    # fail if Marten has drifted
dotnet run --project Skjoldjasper.Web -- db-dump      # print Marten's DDL
```

New Identity migrations:

```bash
dotnet dotnet-ef migrations add <Name> --project Skjoldjasper.Web --output-dir Identity/Migrations
```
