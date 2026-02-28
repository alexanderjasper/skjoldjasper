<# Minimal update script for Windows
   Run from project root after pulling new code:
     .\infra\update-windows.ps1

   What it does:
  - Rebuilds and restarts postgres, web, and game-server
  - Starts cloudflared only if token is configured
#>

$ErrorActionPreference = "Stop"

if ($env:CLOUDFLARED_TUNNEL_TOKEN) {
    Write-Host "Rebuilding and restarting postgres, web, game-server, and cloudflared..." -ForegroundColor Yellow
    docker compose -f infra\docker-compose.yml up -d --build postgres web game-server cloudflared
} else {
    Write-Host "Rebuilding and restarting postgres, web, and game-server..." -ForegroundColor Yellow
    docker compose -f infra\docker-compose.yml up -d --build postgres web game-server
}

Write-Host ""
Write-Host "Containers running:" -ForegroundColor Cyan
docker compose -f infra\docker-compose.yml ps

Write-Host ""
Write-Host "Done." -ForegroundColor Green

