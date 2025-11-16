# Windows Server Deployment Guide

This guide covers deploying Skjoldjasper on Windows 10/11 or Windows Server using Docker Compose.

## Prerequisites

1. **Docker Desktop for Windows**
   - Download: https://www.docker.com/products/docker-desktop/
   - Enable WSL 2 backend (recommended)
   - Ensure it starts automatically on system boot
   - Minimum 4GB RAM allocated to Docker

2. **Git for Windows**
   - Download: https://git-scm.com/download/win
   - Required to clone the repository

## Initial Setup

### 1. Clone Repository

```powershell
cd C:\
git clone <repository-url> skjoldjasper
cd skjoldjasper
```

### 2. Create Environment Files

```powershell
# Infrastructure
Copy-Item infra\env.example infra\.env

# Web application
Copy-Item apps\web\env.example apps\web\.env

# Game server
Copy-Item apps\game-server\env.example apps\game-server\.env

# Database package
Copy-Item packages\db\env.example packages\db\.env
```

### 3. Configure Environment Files

**Edit `infra\.env`:**
```env
POSTGRES_USER=app
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD_HERE  # Change this!
POSTGRES_DB=appdb
```

**Edit `apps\web\.env`:**
```env
DATABASE_URL=postgres://app:YOUR_SECURE_PASSWORD_HERE@localhost:5433/appdb
PUBLIC_GAME_SERVER_WS=ws://localhost:2567
ALLOWED_ORIGINS=http://localhost:5173

# Optional: Add Supabase credentials for GitHub OAuth
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Edit `apps\game-server\.env`:**
```env
DATABASE_URL=postgres://app:YOUR_SECURE_PASSWORD_HERE@localhost:5433/appdb
```

**Edit `packages\db\.env`:**
```env
DATABASE_URL=postgres://app:YOUR_SECURE_PASSWORD_HERE@localhost:5433/appdb
```

> **Important:** Use the same password in all files!

### 4. Deploy

Run the deployment script from the project root:

```powershell
.\infra\deploy-windows.ps1
```

This script will:
1. ✓ Check Docker is running
2. ✓ Verify all .env files exist
3. ✓ Stop any existing containers
4. ✓ Build and start PostgreSQL
5. ✓ Wait for PostgreSQL to be healthy
6. ✓ Run database migrations
7. ✓ Start web, game-server, and projector services
8. ✓ Show status and logs

**First run takes 5-10 minutes** to download images and install dependencies.

### 5. Verify Deployment

Once complete, access:
- **Web App:** http://localhost:5173/
- **Game Server:** http://localhost:2567/
- **Database:** localhost:5433 (username: `app`)

## Updating After Code Changes

When you pull new code from git:

```powershell
git pull
.\infra\update-windows.ps1
```

This restarts the services to pick up changes. Code is mounted as volumes, so dev servers auto-reload.

For major updates (new dependencies, package changes):

```powershell
.\infra\update-windows.ps1 -FullRebuild
```

## Script Options

### deploy-windows.ps1

```powershell
# Full deployment (recommended)
.\infra\deploy-windows.ps1

# Skip database migrations (if already run)
.\infra\deploy-windows.ps1 -SkipMigrations

# Don't rebuild Docker images (faster, but may miss updates)
.\infra\deploy-windows.ps1 -NoRebuild
```

### update-windows.ps1

```powershell
# Quick restart (for code changes)
.\infra\update-windows.ps1

# Full rebuild (for dependency changes)
.\infra\update-windows.ps1 -FullRebuild

# Skip migrations during update
.\infra\update-windows.ps1 -SkipMigrations
```

## Common Commands

### View Logs

```powershell
# All services
docker compose -f infra\docker-compose.yml logs -f

# Specific service
docker compose -f infra\docker-compose.yml logs -f web
docker compose -f infra\docker-compose.yml logs -f game-server
docker compose -f infra\docker-compose.yml logs -f projector
```

### Restart a Service

```powershell
docker compose -f infra\docker-compose.yml restart web
```

### Check Status

```powershell
docker compose -f infra\docker-compose.yml ps
```

### Stop All Services

```powershell
docker compose -f infra\docker-compose.yml down
```

### Stop and Remove All Data

```powershell
# WARNING: This deletes the database!
docker compose -f infra\docker-compose.yml down -v
```

### Access Database Shell

```powershell
docker exec -it skjoldjasper-postgres psql -U app -d appdb
```

## Troubleshooting

### Services Won't Start

**Check Docker is running:**
```powershell
docker version
```

**Check for port conflicts:**
- Web: 5173
- Game Server: 2567
- Database: 5433

Stop other services using these ports or modify `infra\docker-compose.yml` port mappings.

### Database Connection Errors

**Verify PostgreSQL is healthy:**
```powershell
docker compose -f infra\docker-compose.yml ps postgres
```

**Check passwords match:**
- All `.env` files should use the same `POSTGRES_PASSWORD`

**Wait longer:**
- PostgreSQL can take 30-60 seconds to fully initialize on first run

### Slow Performance

**Increase Docker resources:**
1. Open Docker Desktop
2. Settings → Resources
3. Increase CPU and Memory allocations
4. Apply & Restart

**Check disk space:**
```powershell
docker system df
```

**Clean up unused images:**
```powershell
docker system prune -a
```

### Cannot Access from Other Machines

By default, services only bind to localhost. To allow network access:

1. Edit `infra\docker-compose.yml`
2. Change port bindings from `"5173:5173"` to `"0.0.0.0:5173:5173"`
3. Update `ALLOWED_ORIGINS` in `apps\web\.env`
4. Restart: `docker compose -f infra\docker-compose.yml restart web`

### Migrations Fail

**Check database is running:**
```powershell
docker compose -f infra\docker-compose.yml ps postgres
```

**Check database credentials in `packages\db\.env`**

**Manually run migrations:**
```powershell
docker compose -f infra\docker-compose.yml run --rm web sh -c "corepack enable && pnpm -w --filter @skjoldjasper/shared --filter @skjoldjasper/db install --no-frozen-lockfile && pnpm -w --filter @skjoldjasper/shared --filter @skjoldjasper/db build && pnpm --dir packages/db migrate:push"
```

## Production Considerations

### Security

1. **Change default passwords** in all `.env` files
2. **Don't expose ports** to the public internet directly
3. **Use a reverse proxy** (nginx, Traefik) with HTTPS
4. **Enable firewall rules** to restrict access
5. **Keep Docker Desktop updated**

### Backups

Configure pgBackRest for automatic backups:

1. Set up Cloudflare R2 or S3-compatible storage
2. Add credentials to `infra\.env`
3. Create stanza:
```powershell
docker compose -f infra\docker-compose.yml run --rm pgbackrest pgbackrest --stanza=main stanza-create
```
4. Run initial backup:
```powershell
.\infra\scripts\pgbackrest-backup.sh full
```
5. Set up scheduled task for daily backups

### Monitoring

**View container resource usage:**
```powershell
docker stats
```

**Check container health:**
```powershell
docker compose -f infra\docker-compose.yml ps
```

### Automatic Startup

Configure Docker Desktop to start on system boot:
1. Docker Desktop → Settings → General
2. Enable "Start Docker Desktop when you log in"
3. Create a scheduled task to run `deploy-windows.ps1` on startup (optional)

### Updates

Regularly update:
1. **Docker Desktop** - check for updates monthly
2. **Node base images** - rebuild with latest: `.\infra\deploy-windows.ps1 -NoRebuild=false`
3. **Dependencies** - run `.\infra\update-windows.ps1 -FullRebuild` after package updates

## Support

For issues specific to:
- **Docker:** Check Docker Desktop logs
- **Application:** Check service logs with `docker compose logs`
- **Database:** Check PostgreSQL logs or connect with a SQL client to localhost:5433

Common log locations:
- `%LOCALAPPDATA%\Docker\log.txt` (Docker Desktop)
- Container logs via `docker compose logs`

