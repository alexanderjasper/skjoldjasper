# Windows Quick Reference Card

## Initial Setup (One-time)

```powershell
# 1. Clone repo
git clone <repo-url> C:\skjoldjasper
cd C:\skjoldjasper

# 2. Create .env files
Copy-Item infra\env.example infra\.env
Copy-Item apps\web\env.example apps\web\.env
Copy-Item apps\game-server\env.example apps\game-server\.env
Copy-Item packages\db\env.example packages\db\.env

# 3. Edit .env files (set POSTGRES_PASSWORD in all files)

# 4. Deploy
.\infra\deploy-windows.ps1
```

## Daily Operations

### Apply Updates
```powershell
cd C:\skjoldjasper
git pull
.\infra\update-windows.ps1
```

### View Logs
```powershell
# All logs
docker compose -f infra\docker-compose.yml logs -f

# Single service
docker compose -f infra\docker-compose.yml logs -f web
```

### Restart a Service
```powershell
docker compose -f infra\docker-compose.yml restart web
```

### Check Status
```powershell
docker compose -f infra\docker-compose.yml ps
```

### Stop Everything
```powershell
docker compose -f infra\docker-compose.yml down
```

### Start After Stop
```powershell
.\infra\deploy-windows.ps1 -SkipMigrations
```

## Service URLs

- **Web:** http://localhost:5173/
- **Game Server:** http://localhost:2567/
- **Database:** localhost:5433 (user: `app`)

## Troubleshooting

### Service not responding
```powershell
# Check if running
docker compose -f infra\docker-compose.yml ps

# Restart it
docker compose -f infra\docker-compose.yml restart <service-name>
```

### Cannot connect to database
```powershell
# Check database health
docker compose -f infra\docker-compose.yml ps postgres

# View database logs
docker compose -f infra\docker-compose.yml logs postgres
```

### After power outage / reboot
```powershell
# Start Docker Desktop, then:
cd C:\skjoldjasper
.\infra\deploy-windows.ps1 -SkipMigrations
```

### Disk space full
```powershell
# Check Docker disk usage
docker system df

# Clean up
docker system prune -a
```

### Major issues - full reset
```powershell
# WARNING: Deletes all data!
docker compose -f infra\docker-compose.yml down -v
.\infra\deploy-windows.ps1
```

## Backup & Recovery

### Manual Backup
```powershell
docker exec skjoldjasper-postgres pg_dump -U app appdb > backup.sql
```

### Restore from Backup
```powershell
docker exec -i skjoldjasper-postgres psql -U app appdb < backup.sql
```

## Support Contacts

- Full documentation: `infra\WINDOWS-SETUP.md`
- Docker issues: Check Docker Desktop logs
- Application issues: Share logs from `docker compose logs`

