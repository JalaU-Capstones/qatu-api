#!/bin/sh
set -e

log() { printf '[entrypoint] %s\n' "$*"; }

# ── Derive Postgres host/port from DATABASE_URL (falling back to env) ──────
# NOTE: these are named PG_HOST / PG_PORT (not HOST / PORT) on purpose.
# Assigning to HOST or PORT here would shadow the container's exported
# application environment variables (PORT=3000 in the Dockerfile), causing
# Node to listen on the Postgres port instead of the application port.
PG_HOST="${POSTGRES_HOST:-postgres}"
PG_PORT="${POSTGRES_PORT:-5432}"

if [ -n "${DATABASE_URL:-}" ]; then
  HOSTPORT=$(printf '%s' "${DATABASE_URL}" | sed -E 's|^postgres(ql)?://[^@]+@([^/]+)/.*$|\2|')
  case "${HOSTPORT}" in
    *:*) PG_HOST="${HOSTPORT%:*}"; PG_PORT="${HOSTPORT#*:}" ;;
    *)   PG_HOST="${HOSTPORT}";     PG_PORT="5432" ;;
  esac
fi

log "waiting for postgres at ${PG_HOST}:${PG_PORT}..."
MAX_TRIES="${POSTGRES_WAIT_TRIES:-30}"
TRIES=0
until pg_isready -h "${PG_HOST}" -p "${PG_PORT}" -q; do
  TRIES=$((TRIES + 1))
  if [ "${TRIES}" -ge "${MAX_TRIES}" ]; then
    log "postgres did not become ready in ${MAX_TRIES} attempts; aborting"
    exit 1
  fi
  log "not ready (${TRIES}/${MAX_TRIES}); retrying in 2s..."
  sleep 2
done
log "postgres is ready"

# ── Run migrations unless explicitly disabled ──────────────────────────────
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  log "running database migrations..."
  sequelize-cli db:migrate
  log "migrations complete"
else
  log "RUN_MIGRATIONS=false; skipping migrations"
fi

# ── Hand off to CMD (dumb-init already wraps us) ───────────────────────────
exec "$@"
