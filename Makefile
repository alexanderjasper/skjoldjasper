.PHONY: help setup install migrate build dev dev-infra clean docker-up docker-down docker-logs

help:
	@echo "🚀 skjoldjasper Development Commands"
	@echo ""
	@echo "Setup & Installation:"
	@echo "  make setup              - One-time setup (install deps, db migrations)"
	@echo "  make install            - Install dependencies"
	@echo "  make migrate            - Apply database migrations"
	@echo ""
	@echo "Development:"
	@echo "  make build              - Build TypeScript"
	@echo "  make dev                - Start development (web + game-server)"
	@echo "  make dev-infra          - Start with Docker (postgres, web, game-server)"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up          - Start 3 services (postgres, web, game-server)"
	@echo "  make docker-tunnel      - Add Cloudflare Tunnel to running services"
	@echo "  make docker-down        - Stop all services"
	@echo "  make docker-logs        - Show service logs"
	@echo ""
	@echo "Database:"
	@echo "  make db-push            - Push schema changes to database"
	@echo "  make db-drop            - Drop all tables (DESTRUCTIVE!)"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean              - Remove build artifacts"
	@echo "  make clean-all          - Remove everything (artifacts + node_modules)"

setup:
	bash scripts/setup.sh

install:
	pnpm install

migrate:
	pnpm --dir packages/db migrate:push

build:
	pnpm build

dev:
	@echo "Starting development servers..."
	@echo "Web:  http://localhost:5173"
	@echo "Game: ws://localhost:2567"
	pnpm dev

dev-infra:
	cd infra && docker compose up

docker-up:
	cd infra && docker compose up -d
	@echo "✅ Services started:"
	@echo "   - postgres (localhost:5433)"
	@echo "   - web      (localhost:5173)"
	@echo "   - game-server (localhost:2567)"

docker-tunnel:
	cd infra && docker compose --profile tunnel up -d cloudflared
	@echo "✅ Cloudflare Tunnel added"

docker-down:
	cd infra && docker compose down

docker-logs:
	cd infra && docker compose logs -f

db-push:
	pnpm --dir packages/db migrate:push

db-drop:
	@echo "⚠️  This will DROP ALL TABLES in appdb!"
	@read -p "Are you sure? Type 'yes' to continue: " confirm; \
	[ "$$confirm" = "yes" ] && pnpm --dir packages/db migrate:fresh || echo "Cancelled"

clean:
	rm -rf dist build .svelte-kit apps/web/build apps/game-server/build
	find . -name ".turbo" -type d -exec rm -rf {} + 2>/dev/null || true

clean-all: clean
	rm -rf node_modules pnpm-lock.yaml
	rm -rf apps/web/node_modules apps/game-server/node_modules
	rm -rf packages/*/node_modules
