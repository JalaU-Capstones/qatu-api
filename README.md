# Qatu Marketplace Backend API

![CI Status](https://github.com/JalaU-Capstones/qatu-api/actions/workflows/ci.yml/badge.svg)

Qatu (Quechua word for "store") is an online digital marketplace where sellers can offer products to buyers.

## Tech Stack

- **Language:** JavaScript (Node.js)
- **Framework:** Express.js
- **Architecture:** Onion Architecture
- **Database:** PostgreSQL (Sequelize ORM)
- **Authentication:** Supabase Auth
- **Messaging:** RabbitMQ
- **Testing:** Vitest, Supertest, Testcontainers

## Prerequisites

- Node.js v26.x
- pnpm v11.x
- Docker and Docker Compose

## Getting Started

1. **Clone the repository:**

   ```bash
   git clone git@github.com:JalaU-Capstones/qatu-api.git
   cd qatu-api
   ```

2. **Install dependencies:**

   ```bash
   make install
   ```

3. **Environment Setup:**

   ```bash
   cp .env.example .env
   ```

   For Supabase configuration, follow the [Supabase Setup Guide](.docs/supabase/SETUP.md). Update `.env` with appropriate values.

4. **Start Infrastructure:**

   ```bash
   make docker:up
   ```

5. **Run Migrations:**

   ```bash
   make db-migrate
   make db-seed
   ```

6. **Start Development Server:**
   ```bash
   make dev
   ```

### Verify the catalog endpoint

After `make db:migrate && make db-seed && make dev`, run:

```bash
curl -s 'http://localhost:3000/v1/products?page=1&limit=20' | jq
```

Expected: `200` with `meta.total = 25` (from the sample seeder) and `meta.total_pages = 2`.

### Verify search and filters

With the same seeded data you can try the US-06 scenarios:

```bash
# Keyword search (partial words work: "phone" finds "Headphones")
curl -s 'http://localhost:3000/v1/products?search=phone' | jq '{total: .meta.total, names: [.data[].name]}'

# Filter by category (take the id from GET /v1/categories)
curl -s 'http://localhost:3000/v1/categories' | jq '.data[] | {id, name}'
curl -s "http://localhost:3000/v1/products?category_id=<CATEGORY_ID>" | jq '.meta'

# Price range and combined filters
curl -s 'http://localhost:3000/v1/products?min_price=100&max_price=500' | jq '.meta'
curl -s "http://localhost:3000/v1/products?search=phone&category_id=<CATEGORY_ID>&min_price=100&max_price=500" | jq '.meta'

# No results: 200 with an empty list
curl -s 'http://localhost:3000/v1/products?search=zzzzzz' | jq '{data, meta}'
```

An inverted range (`min_price=500&max_price=100`) returns `400 VALIDATION_ERROR`.

### Verify input validation

```bash
# Malformed query: 400 and the field name
curl -s 'http://localhost:3000/v1/products?page=abc' | jq '.error'

# SQL text in search is data: 200, the statement is not executed
curl -sG 'http://localhost:3000/v1/products' --data-urlencode "search='; DROP TABLE products;--" | jq '.meta'

# sort_by outside the allow-list: 400
curl -s 'http://localhost:3000/v1/products?sort_by=price;DROP' | jq '.error.details'
```

## Available Scripts

Check the `Makefile` for available commands by running:

```bash
make help
```

### Authentication

Session uses **HttpOnly cookies** (see `ADR-012`). The client stores no token in `localStorage`/`sessionStorage`.

Register/Login responses set `access_token`, `refresh_token`, `csrf_token` cookies automatically. Subsequent authenticated requests must use `credentials: 'include'` (or `same-origin` in the browser default).

**CSRF:** all state-changing requests (`POST`, `PATCH`, `DELETE`) MUST include `X-CSRF-Token` header matching the `csrf_token` cookie. Auth endpoints (`/v1/auth/*`) are exempt.

**Refresh:** on `401` with `error.code === 'REFRESH_REQUIRED'`, call `POST /v1/auth/refresh` (no CSRF header required) and retry the original request.

## Database Migrations

Migrations are managed with Sequelize CLI. The configuration is in `.sequelizerc` and `src/infrastructure/config/sequelize.config.js`.

### Commands

| Command                    | Description                  |
| -------------------------- | ---------------------------- |
| `pnpm db:migrate`          | Apply all pending migrations |
| `pnpm db:migrate:undo`     | Rollback the last migration  |
| `pnpm db:migrate:undo:all` | Rollback all migrations      |
| `pnpm db:migrate:status`   | Show migration status        |
| `pnpm db:seed`             | Apply all seeders            |
| `pnpm db:seed:undo`        | Rollback all seeders         |

The same commands are available via the `Makefile`:

```bash
make db-migrate
make db-migrate-undo
make db-migrate-undo-all
make db-migrate-status
make db-seed
make db-seed-undo
```

### Workflow

1. Ensure PostgreSQL is running (`make docker-up`).
2. Configure `DATABASE_URL` in `.env`.
3. Run `make db-migrate` to apply all migrations.
4. Run `make db-seed` to populate roles, categories, and the admin user.
5. To reset the database, run `make db-migrate-undo-all && make db-migrate && make db-seed`.

See `.docs/MIGRATIONS.md` for detailed guidance.

## API Documentation

The REST API contract is defined using **OpenAPI 3.1.0** and served interactively via Swagger UI:

- **Swagger UI:** `http://localhost:3000/api-docs` (when development server is running)
- **OpenAPI JSON:** `http://localhost:3000/api-docs/openapi.json`
- **Developer Guide:** [OpenAPI Developer Guide](src/presentation/docs/README.md) and [Contract Overview](.docs/OPENAPI.md)

### Catalog

| Method | Endpoint         | Auth | Description                                                                                                                                                    |
| ------ | ---------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/products`   | None | Paginated list of published products. Supports filters (`search`, `category_id`, `min_price`, `max_price`, `seller_id`) and sorting (`sort_by`, `sort_order`). |
| GET    | `/v1/categories` | None | Paginated list of active categories, ordered by `position`. Use a category `id` as `category_id` to filter products.                                           |

### OpenAPI Commands

| Command                 | Makefile Target         | Description                                                  |
| ----------------------- | ----------------------- | ------------------------------------------------------------ |
| `pnpm openapi:bundle`   | `make openapi-bundle`   | Bundle modular specification into `dist/openapi.bundle.yaml` |
| `pnpm openapi:lint`     | `make openapi-lint`     | Lint specification with Redocly CLI and Spectral             |
| `pnpm openapi:validate` | `make openapi-validate` | Validate specification against OpenAPI 3.1 schemas           |
| `pnpm openapi:preview`  | `make openapi-preview`  | Live preview specification in browser using Redocly          |

## Documentation

Detailed documentation is available in the `.docs/` directory:

- [Architecture](.docs/ARCHITECTURE.md) — Onion Architecture, layers, dependency rule, folder structure, cross-cutting concerns, and testing strategy.
- [Migrations](.docs/MIGRATIONS.md) — Migration workflow, naming conventions, RLS policies, trigger ordering, and seeder guidelines.
- [OpenAPI Specification](.docs/OPENAPI.md) — OpenAPI 3.1 contract, Swagger UI, Redocly tooling, linting, and guide for adding endpoints.
- [Troubleshooting](.docs/TROUBLESHOOTING.md) — Common issues with Docker, pnpm, Node.js, PostgreSQL, RabbitMQ, Husky, ESLint, Vitest, and Migrations.
- [Git Rules](.docs/GIT_RULES.md) — Branching strategy (GitFlow), commit message convention (Conventional Commits), merge request guidelines, code review checklist, and remote configuration.
- [Supabase Setup](.docs/supabase/SETUP.md) — Step-by-step guide to configure Supabase for development using the free tier (local CLI or remote cloud).
- [Supabase Team Workflow](.docs/supabase/TEAM_WORKFLOW.md) — How to work with Supabase locally as a team, what to commit, and how to capture schema changes.

## License

MIT License
