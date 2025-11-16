<# Minimal update script for Windows
   Run from project root after pulling new code:
   .\infra\update-windows.ps1

   Assumes:
   - Containers have been created at least once via deploy-windows.ps1
#>

$ErrorActionPreference = "Stop"

Write-Host "Rebuilding and restarting web, game-server, and cloudflared..." -ForegroundColor Yellow
docker compose -f infra\docker-compose.yml up -d --build web game-server cloudflared

Write-Host ""
Write-Host "Containers running:" -ForegroundColor Cyan
docker compose -f infra\docker-compose.yml ps

Write-Host ""
Write-Host "Done." -ForegroundColor Green

