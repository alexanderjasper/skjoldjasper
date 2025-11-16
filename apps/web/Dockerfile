FROM node:22-alpine

WORKDIR /workspace

# Enable corepack so pnpm from packageManager is available
RUN corepack enable

# Copy entire repo (simple, not optimized for build cache)
COPY . .

# Install workspace deps needed for web + shared + db
RUN pnpm -w install --no-frozen-lockfile --filter web... --filter @skjoldjasper/shared --filter @skjoldjasper/db

# Build shared/db packages
RUN pnpm -w --filter @skjoldjasper/shared --filter @skjoldjasper/db build

# Install projector deps
RUN pnpm --dir apps/projector install --no-frozen-lockfile

# Run projector and web together
CMD ["sh", "-lc", "pnpm --dir apps/projector run & pnpm --dir apps/web dev -- --host 0.0.0.0 --port 5173 --strictPort"]


