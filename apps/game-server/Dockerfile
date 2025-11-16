FROM node:22-alpine

WORKDIR /workspace

RUN corepack enable

COPY . .

# Install shared/db deps and build them
RUN pnpm -w install --no-frozen-lockfile --filter @skjoldjasper/shared --filter @skjoldjasper/db
RUN pnpm -w --filter @skjoldjasper/shared --filter @skjoldjasper/db build

# Install game-server deps
RUN pnpm --dir apps/game-server install --no-frozen-lockfile

CMD ["pnpm", "--dir", "apps/game-server", "start"]


