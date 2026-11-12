SHELL := /bin/bash

.PHONY: help install dev start lint lint-fix format format-check test test-watch test-coverage test-integration build docker-up docker-down docker-logs db-migrate db-migrate-undo db-migrate-undo-all db-migrate-status db-seed db-seed-undo clean openapi-bundle openapi-lint openapi-validate openapi-preview docker-build docker-build-prod docker-up-dev docker-up-prod docker-up-tools docker-ps docker-shell docker-migrate docker-seed docker-logs-api docker-clean docker-config publish-check tag tag-push supabase-start supabase-stop supabase-stop-no-backup supabase-status

help:
	@echo "Qatu API - Available targets:"
	@echo "  install            Install dependencies with pnpm"
	@echo "  dev                Start development server with nodemon"
	@echo "  start              Start production server"
	@echo "  lint               Run ESLint"
	@echo "  lint-fix           Run ESLint with auto-fix"
	@echo "  format             Run Prettier"
	@echo "  format-check       Check formatting with Prettier"
	@echo "  test               Run unit tests"
	@echo "  test-watch         Run tests in watch mode"
	@echo "  test-coverage      Run tests with coverage"
	@echo "  test-integration   Run integration tests (requires Docker)"
	@echo "  docker-up          Start Docker Compose infrastructure"
	@echo "  docker-down        Stop Docker Compose"
	@echo "  docker-logs        View Docker Compose logs"
	@echo "  db-migrate         Run Sequelize migrations"
	@echo "  db-migrate-undo    Rollback last migration"
	@echo "  db-migrate-undo-all Rollback all migrations"
	@echo "  db-migrate-status  Show migration status"
	@echo "  db-seed            Run seeders"
	@echo "  db-seed-undo       Rollback all seeders"
	@echo "  openapi-bundle     Bundle modular OpenAPI spec into dist/openapi.bundle.yaml"
	@echo "  openapi-lint       Lint OpenAPI spec with Redocly and Spectral"
	@echo "  openapi-validate   Validate OpenAPI spec with Redocly"
	@echo "  openapi-preview    Preview OpenAPI documentation with Redocly"
	@echo "  clean              Remove node_modules and build artifacts"
	@echo ""
	@echo "Docker:"
	@echo "  docker-build       Build the development image"
	@echo "  docker-build-prod  Build the runtime (prod) image"
	@echo "  docker-up-dev      Start the full dev stack (hot reload)"
	@echo "  docker-up-prod     Start the full prod stack"
	@echo "  docker-up-tools    Start the dev stack + pgAdmin"
	@echo "  docker-ps          List containers in the dev stack"
	@echo "  docker-shell       Open a shell inside the running api container"
	@echo "  docker-migrate     Run migrations inside the running api container"
	@echo "  docker-seed        Run seeders inside the running api container"
	@echo "  docker-logs-api    Follow the api logs"
	@echo "  docker-clean       Stop + remove containers + volumes + local images"
	@echo "  docker-config      Validate both compose overrides resolve without errors"
	@echo ""
	@echo "Publish:"
	@echo "  publish-check      Sanity check registry paths before tagging"
	@echo "  tag                Create annotated v0.1.0 tag (do NOT push from here)"
	@echo "  tag-push           Push the most recent v* tag (triggers both registries)"
	@echo ""
	@echo "Supabase:"
	@echo "  supabase-start          Start the local Supabase stack (npx supabase start)"
	@echo "  supabase-stop           Stop local Supabase, keeping data volumes"
	@echo "  supabase-stop-no-backup Stop local Supabase and WIPE volumes (destructive)"
	@echo "  supabase-status         Print local Supabase URLs and keys"

install:
	pnpm install

dev: openapi-bundle
	pnpm dev

start:
	pnpm start

lint:
	pnpm lint

lint-fix:
	pnpm lint:fix

format:
	pnpm format

format-check:
	pnpm format:check

test:
	pnpm test

test-watch:
	pnpm test:watch

test-coverage:
	pnpm test:coverage

test-integration:
	pnpm test:integration

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

db-migrate:
	pnpm db:migrate

db-migrate-undo:
	pnpm db:migrate:undo

db-migrate-undo-all:
	pnpm db:migrate:undo:all

db-migrate-status:
	pnpm db:migrate:status

db-seed:
	pnpm db:seed

db-seed-undo:
	pnpm db:seed:undo

openapi-bundle:
	pnpm openapi:bundle

openapi-lint:
	pnpm openapi:lint

openapi-validate:
	pnpm openapi:validate

openapi-preview:
	pnpm openapi:preview

clean:
	rm -rf node_modules dist coverage

# ── Docker ──

docker-build:                  # Build the development image
	docker compose -f docker-compose.yml -f docker-compose.dev.yml build

docker-build-prod:             # Build the runtime (prod) image
	docker compose -f docker-compose.yml -f docker-compose.prod.yml build

docker-up-dev:                 # Start the full dev stack (hot reload)
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

docker-up-prod:                # Start the full prod stack
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

docker-up-tools:               # Start the dev stack + pgAdmin
	docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.dev-tools.yml up -d

docker-ps:                     # List containers in the dev stack
	docker compose -f docker-compose.yml -f docker-compose.dev.yml ps

docker-shell:                  # Open a shell inside the running api container
	docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api sh

docker-migrate:                # Run migrations inside the running api container
	docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api \
	  npx sequelize-cli db:migrate

docker-seed:                   # Run seeders inside the running api container
	docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api \
	  npx sequelize-cli db:seed:all

docker-logs-api:               # Follow the api logs
	docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f api

docker-clean:                  # Stop + remove containers + volumes + local images
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v
	docker image rm qatu-api:dev qatu-api:prod 2>/dev/null || true

docker-config:                 # Validate both compose overrides resolve without errors
	docker compose -f docker-compose.yml -f docker-compose.dev.yml config > /dev/null
	docker compose -f docker-compose.yml -f docker-compose.prod.yml config > /dev/null
	@echo "compose config: OK"

# ── Publish (post-merge only) ──

publish-check:                 # Sanity check registry paths before tagging
	@echo "GHCR path in workflow:"
	@grep -E 'ghcr\.io/[a-zA-Z0-9-]+/qatu-api' .github/workflows/publish-image.yml | head -3
	@echo ""
	@echo "GitLab CI uses \$$CI_REGISTRY_IMAGE (auto-resolves). Correct path:"
	@echo "  registry.gitlab.com/jala-university1/cohort-5/es.cssd-245.ga.t2.26.m2/sd/group-b/grupo-2/api"
	@grep -n 'CI_REGISTRY_IMAGE' .gitlab-ci.yml | head -3

tag:                           # Create annotated v0.1.0 tag (do NOT push from here)
	@read -p "Version (e.g. v0.1.0): " v && \
	git tag -a "$$v" -m "release: $$v" && \
	echo "Tag created locally: $$v. Push with: git push origin $$v"

tag-push:                      # Push the most recent v* tag (triggers both registries)
	@tag=$$(git describe --tags --abbrev=0) && \
	git push origin "$$tag" && \
	echo "Pushed $$tag — GHCR + GitLab Registry workflows are now running."

# ── Supabase CLI ──

supabase-start:                # Start the local Supabase stack (npx supabase start)
	npx supabase start

supabase-stop:                 # Stop local Supabase, keeping data volumes
	npx supabase stop

supabase-stop-no-backup:       # Stop local Supabase and WIPE volumes (destructive)
	npx supabase stop --no-backup

supabase-status:               # Print local Supabase URLs and keys
	npx supabase status
