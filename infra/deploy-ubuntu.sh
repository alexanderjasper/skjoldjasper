#!/bin/bash
# Minimal deploy script for Ubuntu Server
# Run from project root:
#   bash infra/deploy-ubuntu.sh
#
# What it does:
# - Stops any existing Docker stack
# - Starts Postgres (and builds image if needed)
# - Runs database migrations
# - Starts web, game-server, and optional cloudflared (tunnel) container
#
# Assumes:
# - Docker and Docker Compose are installed
# - .env files are already created
# - User has permission to run docker commands

set -e

echo "Stopping existing containers..."
docker compose -f infra/docker-compose.yml down

echo "Starting PostgreSQL (building image if needed)..."
docker compose -f infra/docker-compose.yml up -d --build postgres

echo "Waiting 15 seconds for PostgreSQL to start..."
sleep 15

echo "Running database migrations..."
docker compose -f infra/docker-compose.yml run --rm web sh -lc "pnpm --dir packages/db migrate:push"

echo "Starting web, game-server (building images if needed)..."
docker compose -f infra/docker-compose.yml up -d --build web game-server

# Only start cloudflared if CLOUDFLARED_TUNNEL_TOKEN is set
if [ -f "infra/.env" ] && grep -q "CLOUDFLARED_TUNNEL_TOKEN=" infra/.env && ! grep -q "^CLOUDFLARED_TUNNEL_TOKEN=$" infra/.env; then
    echo "Starting cloudflared tunnel..."
    docker compose -f infra/docker-compose.yml up -d cloudflared
else
    echo "Skipping cloudflared (no token configured)"
fi

echo ""
echo "Containers running:"
docker compose -f infra/docker-compose.yml ps

echo ""
echo "Done. Services are up." 
echo "Web: http://localhost:5173"
echo "Game server: http://localhost:2567"

