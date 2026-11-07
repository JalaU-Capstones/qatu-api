# Containerization Guide — Qatu API

This document describes how the Qatu API is containerized: how to run it locally, how to run it in production, how to add a new service, how to debug, and how CI publishes images.

**Design references:**

- [SP-16: Containerization Strategy](../../Methodology/Spikes-and-PoC/SP-16-Containerization) (wiki)
- [ADR-016: Containerization Architecture](../../Architecture/ADR/ADR-016-Containerization) (wiki)
- [US-36](https://gitlab.com/jala-university1/cohort-5/ES.CSSD-245.GA.T2.26.M2/SD/group-b/grupo-2/api/-/work_items/37) (GitLab issue)

---

## Prerequisites

| Tool                               | Version       | Install                                 |
| ---------------------------------- | ------------- | --------------------------------------- |
| Docker Engine (not Docker Desktop) | 27.x or newer | https://docs.docker.com/engine/install/ |
| Docker Compose plugin              | v2.30+        | ships with Docker Engine 27+            |
| Git                                | any           | —                                       |

Verify:

```bash
docker --version              # Docker version 27.x.x
docker compose version        # Docker Compose version v2.x.x
```

**Disk space:** ~2 GB free for images (postgres 250 MB, rabbitmq 180 MB, api 366 MB, pgadmin 350 MB).

**Ports that must be free on the host:**

- `3000` (api, dev only)
- `8080` (pgAdmin, dev only, dev-tools override)
- `15672` (rabbitmq management, dev only)

Production mode does **not** open any host ports on the API host (nginx will front everything from the client repo's compose).

---

## Environment Setup

Every container reads configuration from `.env`. Copy the template:

```bash
cp .env.example .env
```

Then edit `.env` for your environment. The template documents **three deployment modes** for the database + auth pair:

| Mode                                    | When to use                               | `DATABASE_URL`                                                       | `SUPABASE_URL`                      |
| --------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- | ----------------------------------- |
| **A — Supabase CLI on host**            | You run `npx supabase start` for auth     | `postgresql://postgres:postgres@host.docker.internal:54322/postgres` | `http://host.docker.internal:54321` |
| **B — Fully containerized** _(default)_ | API + DB in compose; auth via CLI on host | `postgresql://postgres:postgres@postgres:5432/postgres`              | `http://host.docker.internal:54321` |
| **C — Supabase Cloud**                  | Production deployment                     | `postgresql://postgres:<pwd>@db.<project>.supabase.co:5432/postgres` | `https://<project>.supabase.co`     |

**Linux users on Mode A/B:** the compose file adds `extra_hosts: ["host.docker.internal:host-gateway"]` automatically, so `host.docker.internal` resolves even on Linux hosts.

**No secret is ever committed.** `.env` is in `.gitignore`. `.env.example` contains placeholder values only.

---

## Development Workflow

### First-time setup

```bash
cp .env.example .env
# Edit .env if needed (defaults work for Mode B out of the box)

docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

What happens:

1. `postgres:17-alpine` starts, applies the `auth` compatibility schema via migration 1 (idempotent).
2. `rabbitmq:4.1-management-alpine` starts, management UI on `:15672`.
3. `api` builds the `build` stage of the Dockerfile, mounts the source, runs `pnpm dev` (nodemon).

### Why `up`, not `run` (workflow tip)

`docker compose up` starts the full stack: dependencies (postgres, rabbitmq) → api. Ports defined in `docker-compose.dev.yml` are published (`:3000`, `:15672`).

`docker compose run --rm api` starts a **one-off** container from the service definition, but:

- It does **NOT** publish ports by default (use `--service-ports` if you need them).
- It runs `command:` and exits when the command exits (with `--rm`, the container is removed).
- It's useful for one-shot commands like `docker compose run --rm api npx sequelize-cli db:migrate`.

**Rule of thumb:** use `up` for the long-running dev stack; use `run --rm` for one-off commands that should NOT interfere with the running stack.

### Daily development

```bash
# Start the stack
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# In a second terminal, follow the API logs
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f api

# Add pgAdmin (DB inspection)
docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.dev-tools.yml up -d pgadmin
# → http://localhost:8080 (admin@qatu.com / admin123)
```

pgAdmin already has the `postgres` server pre-registered (no manual 'Add server' needed). If you change `POSTGRES_PASSWORD`, update `docker/pgadmin/pgpass` too.

Hot reload works: edit `src/**/*.js` and nodemon restarts the container automatically. Migrations do not re-run on restart by default — if you add a migration, restart the api service (which re-runs entrypoint.sh):

```bash
# Restart the api so entrypoint.sh re-runs migrations on startup
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart api

# OR run migrations once without restarting the stack
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api \
  npx sequelize-cli db:migrate
```

### Database Seeding (`RUN_SEEDS`)

The container entrypoint (`docker/entrypoint.sh`) supports database seeding via the `RUN_SEEDS` environment variable:

- **Recommended usage:** Set `RUN_SEEDS=true` for the first production deploy on a fresh database so initial data (roles, categories, admin user) is seeded. Keep it set to `false` (default) for subsequent restarts. docker-compose.dev.yml sets RUN_SEEDS=true automatically, so development environments always have the base seed data without manual intervention.
- **Manual seeding:** Seeds can also be run on-demand inside the running container:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api \
  npx sequelize-cli db:seed:all
```

### Stop and clean

```bash
# Stop containers (keep volumes)
docker compose -f docker-compose.yml -f docker-compose.dev.yml down

# Stop and remove volumes (fresh DB next start)
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
```

### Ports exposed in dev

| Port    | Service  | Purpose                                      |
| ------- | -------- | -------------------------------------------- |
| `3000`  | api      | HTTP API for frontend dev                    |
| `15672` | rabbitmq | Management UI                                |
| `8080`  | pgAdmin  | DB inspection (only with dev-tools override) |

**`postgres:5432` is intentionally NOT exposed to the host.** Use pgAdmin (port 8080) to query it. This satisfies the US-36 acceptance criterion "postgres is reachable only via pgAdmin".

---

## Production Workflow

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

What happens:

1. `api` builds the `runtime` stage of the Dockerfile (multi-stage, no dev deps).
2. `api` runs as the `node` user (UID 1001, non-root).
3. Migrations run automatically via `entrypoint.sh` before the API accepts traffic.
4. No host ports are opened on this host. A separate `docker-compose.prod.yml` in the **client** repo runs nginx that proxies `/v1/` → `api:3000` over the shared `qatu-net` external network.

Production compose differences:

- `restart: unless-stopped` on all services.
- Healthcheck on `/health` every 30s.
- No pgAdmin.
- No source bind mounts.
- `NODE_ENV=production`.

**Before deploying:** ensure `.env` points to **Mode C** (Supabase Cloud). The dev modes assume a local Supabase CLI that will not exist on the production host.

**Logs:**

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f api
```

**Rollback:**

```bash
# Tag the last known-good image locally before deploying
docker tag qatu-api:current qatu-api:rollback

# On failure, restart with the rollback tag (edit docker-compose.prod.yml temporarily)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

_(Phase 3: implement a proper rollback strategy using GHCR image tags and `docker compose` with `${API_VERSION}`.)_

---

## How to Add a New Service

Example: adding Redis for caching alongside the existing services.

### 1. Add the service to `docker-compose.yml`

```yaml
services:
  redis:
    image: redis:7.4-alpine
    volumes:
      - redis_data:/data
    networks:
      - qatu-net
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    expose:
      - '6379'
```

### 2. Declare the volume (at the bottom of the same file)

```yaml
volumes:
  redis_data:
    driver: local
```

### 3. Wire it to `api` (env var + dependency)

In `docker-compose.yml`, under `api`:

```yaml
services:
  api:
    environment:
      REDIS_URL: ${REDIS_URL:-redis://redis:6379}
    depends_on:
      redis:
        condition: service_healthy
```

### 4. Open the port in `docker-compose.dev.yml` (only if you need host access for debugging)

```yaml
services:
  redis:
    ports:
      - '6379:6379'
```

**Do NOT open it in `docker-compose.prod.yml`.** Production services stay on `expose` unless they are the public entry point (nginx in the client repo).

### 5. Add the env var to `.env.example` (with a default)

```bash
REDIS_URL=redis://redis:6379
```

### 6. Update this document

Add the new service to the "Ports exposed in dev" table and to the "Environment variable reference" table below.

### Checklist when adding a service

- [ ] Pinned image tag (no `:latest`).
- [ ] `security_opt: ["no-new-privileges:true"]`.
- [ ] `cap_drop: ["ALL"]` (add back only what the service strictly needs).
- [ ] `healthcheck` + `depends_on: condition: service_healthy` on the consumer.
- [ ] `expose` in base, `ports` only in dev overrides.
- [ ] Volume declared under `volumes:`.
- [ ] Env var added to `.env.example` with a default.
- [ ] This document updated.

---

## Debugging

### View logs

```bash
# All services
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs

# One service, follow mode
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f api

# Last 100 lines only
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs --tail=100 api
```

### Execute a shell inside a container

```bash
# API container — node user (non-root)
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api sh

# Postgres
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec postgres \
  psql -U postgres -d postgres -c "SELECT id, username FROM profiles LIMIT 5;"
```

### Inspect the network

```bash
# List containers on qatu-net and their IPs
docker network inspect qatu-net --format '{{range .Containers}}{{.Name}} {{.IPv4Address}}{{"\n"}}{{end}}'

# Check DNS resolution between containers
docker compose exec api getent hosts postgres
docker compose exec api getent hosts rabbitmq
```

### Verify migrations ran

```bash
docker compose exec api npx sequelize-cli db:migrate:status
# Expect: all migrations marked "up"
```

### Common issues

| Symptom                                                    | Likely cause                                                              | Fix                                                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `api` exits with `postgres did not become ready`           | Postgres container failed to start OR `DATABASE_URL` points to wrong host | `docker compose logs postgres`; verify `DATABASE_URL` host matches the service name (`postgres`, not `localhost`)     |
| `api` returns `ECONNREFUSED` to Supabase                   | `host.docker.internal` not resolving (Linux)                              | Confirm `extra_hosts` is in `docker-compose.dev.yml`; run `docker compose exec api getent hosts host.docker.internal` |
| `docker compose up` fails with `port is already allocated` | Port 3000/8080/15672 in use on the host                                   | `lsof -i :3000` (or `netstat -tulpn \| grep 3000`), kill the process                                                  |
| `docker build` fails with `ERR_PNPM_OUTDATED_LOCKFILE`     | `pnpm-lock.yaml` out of sync with `package.json`                          | Run `pnpm install` locally, commit the updated lockfile                                                               |
| Healthcheck stuck "unhealthy"                              | `start-period=90s` too short on slow disks                                | Increase `--start-period` in the Dockerfile HEALTHCHECK                                                               |
| `permission denied` writing to a mounted folder            | UID mismatch between host and container `node` user                       | `chown -R 1001:1001 <folder>` or use a named volume instead of a bind mount                                           |

---

## Environment Variable Reference

| Variable                       | Default                                                 | Required in prod        | Description                                                                    |
| ------------------------------ | ------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| `NODE_ENV`                     | `development`                                           | yes (`production`)      | Runtime mode. Enables SSL for Postgres and disables verbose logging.           |
| `PORT`                         | `3000`                                                  | no                      | HTTP port the API listens on inside the container.                             |
| `DATABASE_URL`                 | `postgresql://postgres:postgres@postgres:5432/postgres` | yes                     | Postgres connection string. See three modes above.                             |
| `SUPABASE_URL`                 | `http://host.docker.internal:54321`                     | yes                     | Supabase Auth endpoint.                                                        |
| `SUPABASE_ANON_KEY`            | `your-anon-key`                                         | yes                     | Public anon key (used by API to validate JWTs if needed).                      |
| `SUPABASE_SERVICE_ROLE_KEY`    | `your-service-role-key`                                 | yes                     | Privileged key. Server-side only, never logged, never in client bundles.       |
| `JWT_SECRET`                   | `your-jwt-secret`                                       | yes                     | HS256 secret for verifying Supabase-issued JWTs.                               |
| `RABBITMQ_URL`                 | `amqp://qatu:qatu_dev_password@rabbitmq:5672`           | yes (`amqps://...` TLS) | Broker connection string.                                                      |
| `RABBITMQ_ENABLED`             | `false`                                                 | yes (`true`)            | Enables the outbox publisher + notification consumer.                          |
| `RABBITMQ_EXCHANGE`            | `qatu.events`                                           | no                      | Topic exchange for domain events.                                              |
| `RABBITMQ_NOTIFICATIONS_QUEUE` | `qatu.notifications`                                    | no                      | Consumer queue.                                                                |
| `RABBITMQ_DLX`                 | `qatu.dlx`                                              | no                      | Dead letter exchange.                                                          |
| `RABBITMQ_DLQ`                 | `qatu.notifications.dlq`                                | no                      | Dead letter queue.                                                             |
| `OUTBOX_POLL_INTERVAL_MS`      | `2000`                                                  | no                      | Outbox poll interval. Increase to 5000 in prod to reduce DB load.              |
| `OUTBOX_MAX_ATTEMPTS`          | `3`                                                     | no                      | Max publish retries before moving to DLQ.                                      |
| `FRONTEND_URL`                 | `http://localhost:5173`                                 | yes                     | CORS origin.                                                                   |
| `ALLOWED_ORIGINS`              | `http://localhost:5173,http://localhost:3000`           | yes                     | Comma-separated CORS origins.                                                  |
| `POSTGRES_USER`                | `postgres`                                              | no                      | Postgres container superuser (docker-compose only).                            |
| `POSTGRES_PASSWORD`            | `postgres`                                              | no                      | Postgres container password (docker-compose only).                             |
| `POSTGRES_DB`                  | `postgres`                                              | no                      | Postgres container database (docker-compose only).                             |
| `PGADMIN_EMAIL`                | `admin@qatu.com`                                        | n/a (dev only)          | pgAdmin login (dev-tools override only).                                       |
| `PGADMIN_PASSWORD`             | `admin123`                                              | n/a (dev only)          | pgAdmin password (dev-tools override only). pgAdmin v9 requires ≥ 6 chars.     |
| `POSTGRES_WAIT_TRIES`          | `30`                                                    | no                      | Number of `pg_isready` attempts before failing (entrypoint.sh).                |
| `RUN_MIGRATIONS`               | `true`                                                  | no                      | Set to `false` to skip migrations on startup (useful for one-shot containers). |
| `RUN_SEEDS`                    | `false`                                                 | no                      | Set to `true` to run `db:seed:all` on startup (recommended on first deploy).   |

---

## CI/CD: Publishing Images

Two workflows publish the image on every `v*` tag:

### 1. GitHub Actions → GHCR

Workflow: `.github/workflows/publish-image.yml`

- **Triggers:** `push: tags: ['v*']` and `workflow_dispatch` (manual).
- **Image:** `ghcr.io/jalau-capstones/qatu-api`.
- **Tags:** `:${VERSION}` (immutable) and `:latest` (mutable).
- **Platforms:** `linux/amd64`, `linux/arm64` (Mac M1/M2 pull natively).
- **Auth:** `${{ secrets.GITHUB_TOKEN }}` (built-in, no manual secret setup).
- **Pre-requisite:** repo Settings → Actions → General → Workflow permissions = "Read and write permissions".

Pull:

```bash
docker pull ghcr.io/jalau-capstones/qatu-api:v0.1.0
```

### 2. GitLab CI → Container Registry

Job: `publish:image` in `.gitlab-ci.yml`

- **Triggers:** `v*` tags only.
- **Image:** `$CI_REGISTRY_IMAGE` (e.g. `registry.gitlab.com/jala-university1/.../grupo-2/api`).
- **Tags:** `:$CI_COMMIT_TAG` and `:latest`.
- **Platforms:** `linux/amd64` only (native GitLab runners).
- **Auth:** `$CI_REGISTRY_USER` + `$CI_REGISTRY_PASSWORD` (built-in).
- **Pre-requisite:** Settings → General → Visibility, project features, permissions → Container Registry = "Only project members".

Pull:

```bash
docker login registry.gitlab.com
docker pull registry.gitlab.com/jala-university1/cohort-5/es.cssd-245.ga.t2.26.m2/sd/group-b/grupo-2/api:v0.1.0
```

### Releasing

```bash
git tag v0.1.0
git push origin v0.1.0
# → both workflows fire; images are available within ~3 minutes
```

### Manual publish (without a tag)

For GHCR:

```
GitHub repo → Actions → "Publish Container Image" → Run workflow → enter tag (e.g. manual-abc1234)
```

For GitLab: tags only (no manual trigger). Use `git tag manual-$(git rev-parse --short HEAD) && git push origin manual-<short-sha>`.

---

## Test the production image locally (no compose)

This section simulates production locally with three standalone `docker run` containers on `qatu-net`, no `docker-compose`. This exercises the runtime image + migrations + broker connectivity the way a real deployment would.

### 1. Create the shared network (idempotent)

```bash
docker network inspect qatu-net >/dev/null 2>&1 || docker network create qatu-net
```

### 2. Start Postgres (standalone, no host port exposure)

```bash
docker run -d --name qatu-postgres-local \
  --network qatu-net \
  -e POSTGRES_USER=${POSTGRES_USER:-postgres} \
  -e POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres} \
  -e POSTGRES_DB=${POSTGRES_DB:-postgres} \
  -v qatu_postgres_local:/var/lib/postgresql/data \
  postgres:17-alpine
```

### 3. Start RabbitMQ (standalone)

```bash
docker run -d --name qatu-rabbitmq-local \
  --network qatu-net \
  -e RABBITMQ_DEFAULT_USER=${RABBITMQ_DEFAULT_USER:-qatu} \
  -e RABBITMQ_DEFAULT_PASS=${RABBITMQ_DEFAULT_PASS:-qatu_dev_password} \
  rabbitmq:4.1-management-alpine
```

### 4. Build the runtime image

```bash
docker build --target runtime -t qatu-api:local-prod .
```

### 5. Run the API against those two containers

```bash
docker run -d --name qatu-api-local \
  --network qatu-net \
  -p 3000:3000 \
  --env-file .env \
  -e NODE_ENV=production \
  -e RUN_MIGRATIONS=true \
  -e RUN_SEEDS=true \
  -e DATABASE_URL=postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@qatu-postgres-local:5432/${POSTGRES_DB:-postgres} \
  -e RABBITMQ_URL=amqp://${RABBITMQ_DEFAULT_USER:-qatu}:${RABBITMQ_DEFAULT_PASS:-qatu_dev_password}@qatu-rabbitmq-local:5672 \
  qatu-api:local-prod
```

Notes:

- `RUN_MIGRATIONS=true` triggers the entrypoint's migration step, same as prod.
- `RUN_SEEDS=true` seeds roles/categories/admin on a fresh DB. Skip on subsequent runs.
- `--env-file .env` loads Supabase/Storage/JWT/etc.; `-e DATABASE_URL` and `-e RABBITMQ_URL` override to point at the standalone containers, not the compose service names.

### 6. Verify

```bash
# Wait for the entrypoint to run migrations, then:
sleep 15
curl -s http://localhost:3000/health
# → {"status":"ok"}

# Query the DB from another container on the network
docker run --rm --network qatu-net postgres:17-alpine \
  psql "postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@qatu-postgres-local:5432/${POSTGRES_DB:-postgres}" \
  -c "SELECT COUNT(*) FROM profiles;"

# Check the container is healthy
docker ps --filter name=qatu-api-local --format '{{.Status}}'
# → Up X seconds (healthy)
```

### 7. Tear down

```bash
docker stop qatu-api-local qatu-rabbitmq-local qatu-postgres-local
docker rm qatu-api-local qatu-rabbitmq-local qatu-postgres-local
docker volume rm qatu_postgres_local
# Optional: docker rmi qatu-api:local-prod
```

### 8. Why use this flow instead of compose?

- Proves the image is self-contained (no compose magic).
- Exercises the exact same entrypoint a Kubernetes/ECS deployment would use.
- Lets you verify migrations + seeds run cleanly before publishing a v* tag.
- Useful for rollback drills: `docker run` a previous image tag, point it at a fresh volume, verify migrations apply.

---

## Reference

- **Dockerfile:** `./Dockerfile` (four stages: deps → build → development → runtime)
- **Entrypoint:** `./docker/entrypoint.sh` (waits for Postgres, runs migrations, then execs CMD)
- **Compose files:** `./docker-compose.yml`, `./docker-compose.dev.yml`, `./docker-compose.prod.yml`, `./docker-compose.dev-tools.yml`
- **CI workflows:** `.github/workflows/publish-image.yml`, `.gitlab-ci.yml` (`publish:image` job)
- **Design docs (wiki):** SP-16 (strategy), ADR-016 (decision), ADR-014 (message broker)
- **Lab deadline:** DevOps Lab Week 2 — 2026-11-08 23:59 UTC-4
