FROM node:22-alpine

WORKDIR /workspace

# Install git (needed for pnpm to install git-based dependencies)
RUN apk add --no-cache git

# Enable corepack so pnpm from packageManager is available
RUN corepack enable

# Copy entire repo (simple, not optimized for build cache)
COPY . .

# Install workspace deps needed for web + shared + db
RUN pnpm -w install --no-frozen-lockfile --filter web... --filter @skjoldjasper/shared --filter @skjoldjasper/db

# Build shared/db packages
RUN pnpm -w --filter @skjoldjasper/shared --filter @skjoldjasper/db build

# Install web deps
RUN pnpm --dir apps/web install --no-frozen-lockfile

# Start web server
CMD ["pnpm", "--dir", "apps/web", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]


