FROM node:22-alpine

WORKDIR /workspace

# Install git (needed for pnpm to install git-based dependencies like uWebSockets.js)
RUN apk add --no-cache git

RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

COPY . .

# Install shared/db deps and build them
RUN pnpm -w install --no-frozen-lockfile --filter @skjoldjasper/shared --filter @skjoldjasper/db
RUN pnpm --dir packages/shared build && pnpm --dir packages/db build

CMD ["pnpm", "--dir", "apps/game-server", "start"]


