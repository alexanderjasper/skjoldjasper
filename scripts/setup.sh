#!/bin/bash
# Setup script for skjoldjasper development environment
# Run this once to initialize your dev environment

set -e

echo "🚀 Setting up skjoldjasper development environment..."

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker and try again."
  exit 1
fi

echo "📦 Installing dependencies..."
pnpm install

echo "🗄️  Starting PostgreSQL..."
cd infra
docker compose up postgres -d
echo "⏳ Waiting for PostgreSQL to be healthy..."
sleep 3
docker compose logs postgres | grep "ready to accept connections" || sleep 5

echo "🔄 Applying database migrations..."
cd ..
pnpm --dir packages/db migrate:push

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  pnpm build              # Verify TypeScript compilation"
echo "  cd infra && docker compose up  # Start all services (postgres, web, game-server)"
echo "  cd infra && docker compose --profile tunnel up  # Add Cloudflare Tunnel"
echo ""
echo "Or use: pnpm dev (if configured)"
