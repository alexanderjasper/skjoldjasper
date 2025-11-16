<# Minimal update script for Windows
   Run from project root after pulling new code:
     .\infra\update-windows.ps1

   What it does:
   - Rebuilds and restarts web, game-server, and cloudflared (and postgres if needed)
#>

$ErrorActionPreference = "Stop"

Write-Host "Rebuilding and restarting postgres, web, game-server, and cloudflared..." -ForegroundColor Yellow
docker compose -f infra\docker-compose.yml up -d --build postgres web game-server cloudflared

Write-Host ""
Write-Host "Containers running:" -ForegroundColor Cyan
docker compose -f infra\docker-compose.yml ps

Write-Host ""
Write-Host "Done." -ForegroundColor Green

