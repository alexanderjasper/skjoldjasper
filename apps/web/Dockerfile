FROM node:22-alpine

WORKDIR /workspace

# Install git (needed for pnpm to install git-based dependencies)
RUN apk add --no-cache git

# Enable corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

# Copy entire repo (simple, not optimized for build cache)
COPY . .

# Install workspace deps needed for web + db
RUN pnpm -w install --no-frozen-lockfile --filter web... --filter @skjoldjasper/db

# Build db package
RUN pnpm --dir packages/db build

# Start web server
CMD ["pnpm", "--dir", "apps/web", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]


