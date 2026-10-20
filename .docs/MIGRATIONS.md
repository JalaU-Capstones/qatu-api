# Database Migrations Guide

## Overview

Sequelize CLI manages the Qatu Marketplace database schema through versioned, reversible migrations. Every schema change — tables, indexes, RLS policies, constraints, and triggers — is captured in a migration file. Seeders populate reference data (roles, categories, admin user) for development and staging.

Migrations are the single source of truth for the database schema. Running `pnpm db:migrate` on a fresh database produces exactly the same schema as the production database.

## File Locations

| Path                                            | Purpose                                         |
| ----------------------------------------------- | ----------------------------------------------- |
| `.sequelizerc`                                  | Sequelize CLI path configuration                |
| `src/infrastructure/config/sequelize.config.js` | Database connection config per environment      |
| `src/infrastructure/persistence/migrations/`    | Migration files (ordered by timestamp)          |
| `src/infrastructure/persistence/seeders/`       | Seeder files                                    |
| `src/infrastructure/persistence/models/`        | Sequelize model files (used by the application) |

> [!NOTE]
> Both the `migrations/` and `seeders/` directories contain a `package.json` with `"type": "commonjs"` to allow CJS `module.exports` syntax inside an ESM project.

## Naming Convention

Migration and seeder filenames follow this pattern:

```
YYYYMMDDHHMMSS-<kebab-case-description>.js
```

Example: `20261010000007-create-products.js`

Files run in ascending filename order. The timestamp prefix guarantees the correct execution order across branches and developers.

## Migration Structure

Every migration follows this template:

```javascript
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(`<SQL_STATEMENTS>`, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(`<REVERSE_SQL_STATEMENTS>`, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
```

Key rules:

- All SQL is executed via `queryInterface.sequelize.query()` inside a transaction.
- If any statement fails, the entire migration rolls back.
- The `down` function must reverse every change made by `up`.
- Use `DROP ... IF EXISTS` in `down` so it does not fail if objects are missing.
- Use `CREATE ... IF NOT EXISTS` in `up` so re-runs do not fail.

## Creating a New Migration

```bash
npx sequelize-cli migration:generate --name <description>
```

Example:

```bash
npx sequelize-cli migration:generate --name add-featured-flag-to-products
```

This creates a timestamped skeleton file in `src/infrastructure/persistence/migrations/`. Edit the `up` and `down` functions following the template above.

## Rollback Policy

Every migration **must** be reversible. Before opening a merge request:

1. Run `pnpm db:migrate:undo` and verify it succeeds without errors.
2. Run `pnpm db:migrate` to re-apply the migration.
3. Confirm the schema is identical.

Irreversible operations (e.g., `DROP COLUMN`) require explicit approval and must document data-loss risk.

## RLS in Migrations

Every table migration must:

1. Enable Row Level Security (RLS) immediately after `CREATE TABLE`:
   ```sql
   alter table public.my_table enable row level security;
   ```
2. Define all access policies in the same migration. Never leave a table without policies.
3. Drop policies in the `down` function before dropping the table.

Policies use `(select auth.uid())` to ensure the subquery runs at policy-check time:

```sql
create policy "Users can read own data"
on public.my_table for select
to authenticated
using (user_id = (select auth.uid()));
```

> [!IMPORTANT]
> The `auth.uid()` function is provided by Supabase. In the local Docker PostgreSQL (non-Supabase), migration 01 creates a compatible stub that reads from `request.jwt.claim.sub`. RLS policies are not enforced for superusers, so they work correctly during migrations.

## Trigger Ordering

Triggers depend on their source and target tables. The migration order ensures tables exist before triggers reference them:

| Migrations 01–17 | Create all tables |
| Migration 18 | `handle_updated_at` function + triggers on all tables |
| Migration 19 | `handle_new_user` function + trigger on `auth.users` |
| Migration 20 | `handle_new_message` function + trigger on `messages` |
| Migration 21 | `handle_product_rating` function + trigger on `ratings` |
| Migration 22 | `handle_product_published_at` function + trigger on `products` |

> [!WARNING]
> Never create a trigger before the table it fires on. Never create a trigger function that references a table that does not yet exist.

## Search Indexes

Migration 27 (`20261010000027-add-product-search-indexes.js`) supports the catalog keyword search (US-06):

| Object                          | Definition                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `pg_trgm` extension             | `create extension if not exists pg_trgm` (trusted extension, available on Supabase)          |
| `idx_products_name_trgm`        | GIN `gin_trgm_ops` on `products.name`, partial: `state = 'published' and deleted_at is null` |
| `idx_products_description_trgm` | GIN `gin_trgm_ops` on `products.description`, same partial predicate                         |

They serve the `name ILIKE '%term%'` and `description ILIKE '%term%'` conditions of `ProductRepository.findAll`, which find partial words that full-text search cannot (`phone` in "Headphones"). The partial predicate matches the one the repository always applies, so PostgreSQL can use the indexes.

The `down` step drops only the two indexes. The `pg_trgm` extension is kept on purpose because other objects may depend on it.

> [!NOTE]
> Benchmark on 50,000 published products with the exact repository query: about 3 ms with the trigram indexes versus about 100 ms (sequential scan) without them, for an uncommon term.

## Seeder Guidelines

Seeders live in `src/infrastructure/persistence/seeders/` and follow the same timestamp naming convention.

All seeders must be **idempotent** — they can run multiple times without error or duplicate data:

```sql
insert into public.roles (name, description)
values ('buyer', '...')
on conflict (name) do nothing;
```

Seeders are for **development and staging only**. The admin user seeder guards production:

```javascript
if (process.env.NODE_ENV === 'production') {
  console.warn('Skipping seeder in production.');
  return;
}
```

The seeders provided are:

| #   | File                                     | Data                                                          |
| --- | ---------------------------------------- | ------------------------------------------------------------- |
| 23  | `20261010000023-seed-roles.js`           | 3 roles: buyer, seller, admin                                 |
| 24  | `20261010000024-seed-categories.js`      | 5 root categories                                             |
| 25  | `20261010000025-seed-admin-user.js`      | Admin user in `auth.users`, `profiles`, `user_roles`          |
| 26  | `20261010000026-seed-sample-products.js` | 1 sample seller user + 25 published products (5 per category) |

## Production Deployment

In production:

1. **Migrations run automatically** on deployment via `pnpm db:migrate` (or `npx sequelize-cli db:migrate`).
2. **Seeders do NOT run** in production. Reference data (roles, categories) is seeded once during initial setup.
3. The admin user must be created via Supabase Auth dashboard in production — never via the seeder.

## Troubleshooting

### `pgcrypto` extension not found

Ensure the `enable-pgcrypto` migration ran first. Supabase enables it by default; local PostgreSQL may not. Run:

```sql
create extension if not exists pgcrypto;
```

### Migration order errors

Check the timestamp prefix. Migrations run in ascending filename order. Renaming a file changes its execution position.

### RLS blocking access

Verify the current user context. In the SQL editor, `auth.uid()` returns null unless you impersonate a user. The superuser (`postgres`, `qatu`) bypasses RLS by default.

### Trigger creation fails

Ensure the source and target tables exist before creating the trigger. Check migration 18–22 run after 01–17.

### Generated column not supported

`search_vector` requires PostgreSQL 12+. Supabase uses PostgreSQL 17. Your local Docker image must use the same major version. Update `docker-compose.yml` to use `postgres:17-alpine`.

### `extension "pg_trgm" is not available`

Migration 27 needs the PostgreSQL `contrib` modules. The official `postgres` Docker images (including `-alpine`) and Supabase include them. If you use a minimal system install, add the contrib package (for example `postgresql-contrib` on Debian/Ubuntu) and run `pnpm db:migrate` again.

### Rollback fails

Ensure `down` uses `IF EXISTS` for all `DROP` statements. Example:

```sql
drop table if exists public.my_table cascade;
drop index if exists public.idx_my_table_col;
```

### Seeder runs in production

The admin user seeder checks `NODE_ENV`. Verify the environment variable is set to `production` in the deployment environment.

### `module is not defined in ES module scope`

Migrations use CommonJS (`module.exports`). The `src/infrastructure/persistence/migrations/package.json` file sets `"type": "commonjs"` to allow this inside an ESM project. Do not remove that file.

## References

- ADR-002: Database Design (PostgreSQL + Sequelize)
- ADR-003: Authentication Provider (Supabase Auth)
- ADR-009: UUID v4 as Primary Key
- [Architecture/Data-Model](../supabase/SETUP.md) — Wiki page with the full SQL schema
- [Sequelize CLI documentation](https://sequelize.org/docs/v6/other-topics/migrations/)
- [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
