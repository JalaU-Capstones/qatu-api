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

## Available Scripts

Check the `Makefile` for available commands by running:

```bash
make help
```

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

## Documentation

Detailed documentation is available in the `.docs/` directory:

- [Architecture](.docs/ARCHITECTURE.md) — Onion Architecture, layers, dependency rule, folder structure, cross-cutting concerns, and testing strategy.
- [Migrations](.docs/MIGRATIONS.md) — Migration workflow, naming conventions, RLS policies, trigger ordering, and seeder guidelines.
- [Troubleshooting](.docs/TROUBLESHOOTING.md) — Common issues with Docker, pnpm, Node.js, PostgreSQL, RabbitMQ, Husky, ESLint, Vitest, and Migrations.
- [Git Rules](.docs/GIT_RULES.md) — Branching strategy (GitFlow), commit message convention (Conventional Commits), merge request guidelines, code review checklist, and remote configuration.
- [Supabase Setup](.docs/supabase/SETUP.md) — Step-by-step guide to configure Supabase for development using the free tier (local CLI or remote cloud).
- [Supabase Team Workflow](.docs/supabase/TEAM_WORKFLOW.md) — How to work with Supabase locally as a team, what to commit, and how to capture schema changes.

## License

MIT License
