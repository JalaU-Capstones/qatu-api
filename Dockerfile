# syntax=docker/dockerfile:1.7
# ────────────────────────────────────────────────────────────────────────────
# Qatu API — Multi-stage Dockerfile (US-36, ADR-016)
#
# Stage 1 (deps):    install production dependencies only
# Stage 2 (build):   install all dependencies, run openapi:bundle
# Stage 3 (runtime): minimal image with prod deps + compiled artifacts
#
# Best practices applied:
#   - Alpine base (pinned tag, no :latest)
#   - Multi-stage separation (build tools never reach runtime)
#   - Layer caching (package.json before source)
#   - Non-root user (`node`, UID 1001 from the base image)
#   - dumb-init as PID 1 (signal forwarding + zombie reaping)
#   - Healthcheck against the public /health endpoint (no auth, no DB)
#   - No secrets baked (env vars via .env / docker compose env_file)
# ────────────────────────────────────────────────────────────────────────────

# ── Stage 1: deps ───────────────────────────────────────────────────────────
FROM node:26-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm@12 && npm cache clean --force
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

# ── Stage 2: build ──────────────────────────────────────────────────────────
FROM node:26-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@12 && npm cache clean --force
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm openapi:bundle

# ── Stage 2.5: development ──────────────────────────────────────────────────
# Extends `build` with the same runtime tooling as `runtime` (entrypoint.sh,
# dumb-init, postgresql17-client, global sequelize-cli) so that
# `docker compose -f docker-compose.yml -f docker-compose.dev.yml up api`
# runs the SAME migration-and-start flow as production, plus hot reload via
# the dev compose's `command:` override (pnpm dev) and bind mounts.
#
# Why this stage exists: `build` has no ENTRYPOINT, so `docker compose run`
# (and `up` when combined with the dev override) would bypass entrypoint.sh
# and skip migrations. This stage closes that gap without polluting the
# `runtime` stage with dev-only tooling.
FROM build AS development

ENV NODE_ENV=development \
    NODE_NO_WARNINGS=1 \
    HUSKY=0

RUN apk add --no-cache postgresql17-client dumb-init \
    && npm install -g sequelize-cli@6 \
    && npm cache clean --force

COPY --chown=node:node docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh

# Fix ownership: the `build` stage leaves /app owned by root, but the
# dev command (docker-compose.dev.yml) runs `pnpm install` as `node`.
# Without this chown, pnpm hits EACCES on the anonymous /app/node_modules
# volume (initialized from the root-owned image).
RUN chown -R node:node /app

USER node
EXPOSE 3000

ENTRYPOINT ["dumb-init", "--", "./docker/entrypoint.sh"]
CMD ["node", "src/server.js"]

# ── Stage 3: runtime ────────────────────────────────────────────────────────
FROM node:26-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NODE_NO_WARNINGS=1 \
    HUSKY=0 \
    PORT=3000

# System dependencies:
#   - postgresql17-client: pg_isready for the entrypoint wait loop
#   - dumb-init: PID 1 signal handling + zombie reaping
#   - sequelize-cli (global): migrations at container startup
RUN apk add --no-cache postgresql17-client dumb-init \
    && npm install -g sequelize-cli@6 \
    && npm cache clean --force

# Production dependencies (no dev deps)
COPY --from=deps --chown=node:node /app/node_modules ./node_modules

# App files (source, sequelize config, migrations, built artifacts)
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/.sequelizerc ./.sequelizerc
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/dist ./dist

# Entrypoint
COPY --chown=node:node docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh

USER node
EXPOSE 3000

# /health returns {"status":"ok"} with no authentication and no DB dependency.
# start-period=90s covers the postgres wait loop + migration run time.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["dumb-init", "--", "./docker/entrypoint.sh"]
CMD ["node", "src/server.js"]
