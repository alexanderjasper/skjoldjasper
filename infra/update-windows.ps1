# Quick update script for code changes
# Run this after pulling new code: .\infra\update-windows.ps1

param(
    [switch]$SkipMigrations,
    [switch]$FullRebuild
)

$ErrorActionPreference = "Stop"

Write-Host "=== Skjoldjasper Update Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if containers are running
Write-Host "Checking existing containers..." -ForegroundColor Yellow
$containers = docker compose -f infra\docker-compose.yml ps --format json | ConvertFrom-Json
if ($null -eq $containers -or $containers.Count -eq 0) {
    Write-Host "✗ No containers running. Use deploy-windows.ps1 for initial setup." -ForegroundColor Red
    exit 1
}

Write-Host "✓ Found running containers" -ForegroundColor Green

if ($FullRebuild) {
    Write-Host ""
    Write-Host "Performing full rebuild..." -ForegroundColor Yellow
    Write-Host ""
    
    # Stop all
    docker compose -f infra\docker-compose.yml down
    
    # Rebuild and start
    docker compose -f infra\docker-compose.yml up -d --build postgres
    
    # Wait for postgres
    Write-Host "Waiting for PostgreSQL..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    # Run migrations if needed
    if (-not $SkipMigrations) {
        Write-Host "Running migrations..." -ForegroundColor Yellow
        $migrateCmd = "corepack enable && pnpm -w --filter @skjoldjasper/shared --filter @skjoldjasper/db install --no-frozen-lockfile && pnpm -w --filter @skjoldjasper/shared --filter @skjoldjasper/db build && pnpm --dir packages/db migrate:push"
        docker compose -f infra\docker-compose.yml run --rm web sh -c $migrateCmd
    }
    
    # Start services
    docker compose -f infra\docker-compose.yml up -d --build web game-server projector
    
} else {
    Write-Host ""
    Write-Host "Restarting services (code is auto-mounted)..." -ForegroundColor Yellow
    
    # Run migrations if needed
    if (-not $SkipMigrations) {
        Write-Host "Running migrations..." -ForegroundColor Yellow
        $migrateCmd = "corepack enable && pnpm -w --filter @skjoldjasper/shared --filter @skjoldjasper/db install --no-frozen-lockfile && pnpm -w --filter @skjoldjasper/shared --filter @skjoldjasper/db build && pnpm --dir packages/db migrate:push"
        docker compose -f infra\docker-compose.yml run --rm web sh -c $migrateCmd
    }
    
    # Just restart (volumes are already mounted, dev servers will reload)
    docker compose -f infra\docker-compose.yml restart web game-server projector
}

Write-Host ""
Write-Host "✓ Update complete" -ForegroundColor Green
Write-Host ""
Write-Host "Watching logs (press Ctrl+C to stop)..." -ForegroundColor Yellow
docker compose -f infra\docker-compose.yml logs -f --tail=50

