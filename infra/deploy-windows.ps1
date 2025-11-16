# Deploy script for Windows
# Run this script from the project root: .\infra\deploy-windows.ps1

param(
    [switch]$SkipMigrations,
    [switch]$NoRebuild
)

$ErrorActionPreference = "Stop"

Write-Host "=== Skjoldjasper Deployment Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker is not running"
    }
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker is not running or not installed" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again" -ForegroundColor Red
    exit 1
}

# Check if .env files exist
Write-Host ""
Write-Host "Checking environment files..." -ForegroundColor Yellow
$envFiles = @(
    "infra\.env",
    "apps\web\.env",
    "apps\game-server\.env",
    "packages\db\.env"
)

$missingEnvFiles = @()
foreach ($file in $envFiles) {
    if (Test-Path $file) {
        Write-Host "✓ Found $file" -ForegroundColor Green
    } else {
        Write-Host "✗ Missing $file" -ForegroundColor Red
        $missingEnvFiles += $file
    }
}

if ($missingEnvFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "Please create the missing .env files from their .example templates:" -ForegroundColor Red
    foreach ($file in $missingEnvFiles) {
        $exampleFile = "$file.example"
        Write-Host "  Copy-Item $exampleFile $file" -ForegroundColor Yellow
    }
    exit 1
}

# Stop existing containers
Write-Host ""
Write-Host "Stopping existing containers..." -ForegroundColor Yellow
docker compose -f infra\docker-compose.yml down
Write-Host "✓ Containers stopped" -ForegroundColor Green

# Build and start Postgres
Write-Host ""
Write-Host "Starting PostgreSQL..." -ForegroundColor Yellow
if ($NoRebuild) {
    docker compose -f infra\docker-compose.yml up -d postgres
} else {
    docker compose -f infra\docker-compose.yml up -d --build postgres
}

# Wait for Postgres to be healthy
Write-Host "Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$healthy = $false

while ($attempt -lt $maxAttempts) {
    $attempt++
    Start-Sleep -Seconds 2
    
    $status = docker compose -f infra\docker-compose.yml ps postgres --format json | ConvertFrom-Json
    if ($status.Health -eq "healthy") {
        $healthy = $true
        break
    }
    
    Write-Host "  Attempt $attempt/$maxAttempts..." -ForegroundColor Gray
}

if (-not $healthy) {
    Write-Host "✗ PostgreSQL failed to become healthy" -ForegroundColor Red
    Write-Host "Check logs with: docker compose -f infra\docker-compose.yml logs postgres" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ PostgreSQL is ready" -ForegroundColor Green

# Run migrations
if (-not $SkipMigrations) {
    Write-Host ""
    Write-Host "Running database migrations..." -ForegroundColor Yellow
    Write-Host "(This may take a few minutes on first run)" -ForegroundColor Gray
    
    docker compose -f infra\docker-compose.yml run --rm web sh -c @"
corepack enable && \
pnpm -w --filter @skjoldjasper/shared --filter @skjoldjasper/db install --no-frozen-lockfile && \
pnpm -w --filter @skjoldjasper/shared --filter @skjoldjasper/db build && \
pnpm --dir packages/db migrate:push
"@
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Migration failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Migrations completed" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⊘ Skipping migrations" -ForegroundColor Yellow
}

# Start all services
Write-Host ""
Write-Host "Starting application services..." -ForegroundColor Yellow
Write-Host "(First run may take 5-10 minutes to install dependencies)" -ForegroundColor Gray

if ($NoRebuild) {
    docker compose -f infra\docker-compose.yml up -d web game-server projector
} else {
    docker compose -f infra\docker-compose.yml up -d --build web game-server projector
}

Write-Host "✓ Services started" -ForegroundColor Green

# Wait a moment for services to initialize
Start-Sleep -Seconds 3

# Show status
Write-Host ""
Write-Host "=== Service Status ===" -ForegroundColor Cyan
docker compose -f infra\docker-compose.yml ps

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Access points:" -ForegroundColor Cyan
Write-Host "  • Web App:     http://localhost:5173/" -ForegroundColor White
Write-Host "  • Game Server: http://localhost:2567/" -ForegroundColor White
Write-Host "  • Database:    localhost:5433 (user: app)" -ForegroundColor White
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "  • View logs:        docker compose -f infra\docker-compose.yml logs -f" -ForegroundColor White
Write-Host "  • View web logs:    docker compose -f infra\docker-compose.yml logs -f web" -ForegroundColor White
Write-Host "  • Restart service:  docker compose -f infra\docker-compose.yml restart web" -ForegroundColor White
Write-Host "  • Stop all:         docker compose -f infra\docker-compose.yml down" -ForegroundColor White
Write-Host ""
Write-Host "Waiting for services to be ready (watching logs for 10 seconds)..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop watching" -ForegroundColor Gray
Write-Host ""

# Show logs for 10 seconds then exit
$job = Start-Job -ScriptBlock {
    param($composePath)
    docker compose -f $composePath logs -f --tail=20
} -ArgumentList "infra\docker-compose.yml"

Start-Sleep -Seconds 10
Stop-Job $job
Remove-Job $job

Write-Host ""
Write-Host "✓ Deployment script finished" -ForegroundColor Green
Write-Host "Continue monitoring with: docker compose -f infra\docker-compose.yml logs -f" -ForegroundColor Yellow

