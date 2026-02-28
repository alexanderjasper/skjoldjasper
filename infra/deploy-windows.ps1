<# Minimal deploy script for Windows
   Run from project root:
     .\infra\deploy-windows.ps1

   What it does:
   - Stops any existing Docker stack
   - Starts Postgres (and builds image if needed)
   - Runs database migrations using pnpm on the host
  - Starts cloudflared (tunnel) container if token is configured

   Assumes:
   - Docker Desktop is running
   - .env files are already created
   - Node + pnpm are installed on the host (server)
#>

$ErrorActionPreference = "Stop"

Write-Host "Stopping existing containers..." -ForegroundColor Yellow
docker compose -f infra\docker-compose.yml down

Write-Host "Starting PostgreSQL (building image if needed)..." -ForegroundColor Yellow
docker compose -f infra\docker-compose.yml up -d --build postgres

Write-Host "Waiting 15 seconds for PostgreSQL to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host "Running database migrations in web container..." -ForegroundColor Yellow
docker compose -f infra\docker-compose.yml run --rm web sh -lc "pnpm --dir packages/db migrate:push"

if ($env:CLOUDFLARED_TUNNEL_TOKEN) {
    Write-Host "Starting web, game-server, and cloudflared (building images if needed)..." -ForegroundColor Yellow
    docker compose -f infra\docker-compose.yml up -d --build web game-server cloudflared
} else {
    Write-Host "Starting web and game-server (no CLOUDFLARED_TUNNEL_TOKEN configured)..." -ForegroundColor Yellow
    docker compose -f infra\docker-compose.yml up -d --build web game-server
}

Write-Host ""
Write-Host "Containers running:" -ForegroundColor Cyan
docker compose -f infra\docker-compose.yml ps

Write-Host ""
Write-Host "Done." -ForegroundColor Green
