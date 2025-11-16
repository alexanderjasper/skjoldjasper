<# Minimal deploy script for Windows
   Run from project root:
   .\infra\deploy-windows.ps1

   Assumes:
   - Docker Desktop is running
   - .env files are already created
#>

$ErrorActionPreference = "Stop"

Write-Host "Stopping existing containers..." -ForegroundColor Yellow
docker compose -f infra\docker-compose.yml down

Write-Host "Starting PostgreSQL (building image if needed)..." -ForegroundColor Yellow
docker compose -f infra\docker-compose.yml up -d --build postgres

Write-Host "Waiting 15 seconds for PostgreSQL to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host "Running database migrations (this may take a while on first run)..." -ForegroundColor Yellow
$migrateCmd = "corepack enable && pnpm -w --filter @skjoldjasper/shared --filter @skjoldjasper/db install --no-frozen-lockfile && pnpm -w --filter @skjoldjasper/shared --filter @skjoldjasper/db build && pnpm --dir packages/db migrate:push"
docker compose -f infra\docker-compose.yml run --rm web sh -c $migrateCmd

Write-Host "Starting web, game-server, projector, and cloudflared (building images if needed)..." -ForegroundColor Yellow
docker compose -f infra\docker-compose.yml up -d --build web game-server projector cloudflared

Write-Host ""
Write-Host "Containers running:" -ForegroundColor Cyan
docker compose -f infra\docker-compose.yml ps

Write-Host ""
Write-Host "Done. Web should be on http://localhost:5173/" -ForegroundColor Green
