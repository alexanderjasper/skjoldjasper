# Development Setup Guide

Quick reference for setting up and running skjoldjasper locally.

## First Time Setup

**Option 1: Automated Setup (Recommended)**
```bash
make setup
```

Or using npm:
```bash
pnpm setup
bash scripts/setup.sh
```

This will:
- Install dependencies
- Start PostgreSQL
- Apply database migrations

**Option 2: Manual Setup**
```bash
pnpm install
cd infra && docker compose up postgres -d
pnpm --dir packages/db migrate:push
```

## Running the Application

### Quick Start (All Services with Docker)
```bash
make dev-infra
# or: cd infra && docker compose up
```

This starts 3 services:
- **PostgreSQL** - Database (localhost:5433)
- **Web** - SvelteKit app (localhost:5173)
- **Game Server** - Colyseus (localhost:2567)

### Local Development (TypeScript Watch)
```bash
make dev
# or: pnpm dev
```

Starts web and game-server in watch mode (requires postgres running separately).

### With Cloudflare Tunnel (Optional)
```bash
make docker-tunnel
# or: cd infra && docker compose --profile tunnel up -d cloudflared
```

## Common Tasks

| Task | Command | Alternative |
|------|---------|-------------|
| Install deps | `pnpm install` | `make install` |
| Build | `pnpm build` | `make build` |
| Database migrations | `pnpm --dir packages/db migrate:push` | `make migrate` |
| Fresh database | `pnpm --dir packages/db migrate:fresh` | `make db-drop` |
| Start all services | `cd infra && docker compose up` | `make dev-infra` |
| Stop services | `cd infra && docker compose down` | `make docker-down` |
| View logs | `cd infra && docker compose logs -f` | `make docker-logs` |
| Help | `make help` | `make` |

## Architecture

### 3-Service Architecture (Default)

```
┌─────────────────┐
│   PostgreSQL    │ :5433
├─────────────────┤
│  SvelteKit Web  │ :5173
├─────────────────┤
│  Game Server    │ :2567 (WebSocket)
└─────────────────┘
```

### Optional Add-ons

- **Cloudflare Tunnel** (`--profile tunnel`) - Public URL tunneling
- **pgBackRest** (`--profile backup`) - Database backups to S3/R2

## Project Structure

```
apps/
├── web/              # SvelteKit finance app
├── game-server/      # Colyseus game server
packages/
├── db/               # Drizzle schema + migrations
└── shared/           # Rate limiting, HTTP helpers
infra/
└── docker-compose.yml  # 3-service default setup
scripts/
└── setup.sh          # One-time initialization
```

## Database Schema

New tables (after 001-simplify-project):
- `budgets` - Budget records
- `budget_members` - Budget membership (many-to-many)
- `categories` - Budget categories (hierarchical)
- `transactions` - Imported transactions
- `transaction_splits` - Transaction allocations to categories
- `finance_audit_log` - Audit trail (append-only)
- `game_room_states` - Game room persistent state
- `user`, `session` - Authentication (Lucia)

## Troubleshooting

### "relation 'budgets' does not exist"
Database tables haven't been created. Run:
```bash
pnpm --dir packages/db migrate:push
```

### PostgreSQL won't start
Check Docker is running and port 5433 is free:
```bash
docker ps
lsof -i :5433
```

### Changes not reflecting in browser
- **Web**: Vite hot-reload should work automatically
- **API changes**: May need to rebuild with `pnpm build`
- **Database schema**: Stop services, run `pnpm --dir packages/db migrate:push`, restart

### Permission issues
If you get permission errors with Docker:
```bash
# Add your user to docker group (Linux)
sudo usermod -aG docker $USER
newgrp docker
```

## Environment Configuration

Database credentials are in `infra/.env`:
```
POSTGRES_USER=app
POSTGRES_PASSWORD=app-password-change-me
POSTGRES_DB=appdb
```

Change these before running in production!

## Next Steps

1. ✅ [Setup](#first-time-setup)
2. 🚀 Start developing
3. 📚 Check [CLAUDE.md](./CLAUDE.md) for coding standards
4. 📋 See [specs/001-simplify-project/](./specs/001-simplify-project/) for feature documentation
