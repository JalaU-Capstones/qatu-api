# Troubleshooting

- **Docker:** If ports conflict, ensure no other Postgres or RabbitMQ is running.
- **pnpm:** Clear cache with `pnpm store prune`.
- **Node.js:** Ensure Node v26+ is used.
- **Environment:** Run `make docker-down -v` to reset data volumes.

## Migrations

- **`pgcrypto` extension not found:** Ensure the `enable-pgcrypto` migration ran first. Supabase enables it by default; local PostgreSQL may not.
- **Migration order errors:** Check the timestamp prefix. Migrations run in ascending filename order.
- **RLS blocking access:** Verify the current user context. In the SQL editor, `auth.uid()` returns null unless you impersonate a user.
- **Trigger creation fails:** Ensure the source and target tables exist before creating the trigger.
- **Generated column not supported:** `search_vector` requires PostgreSQL 12+. Supabase uses PostgreSQL 17. Local Docker must use the same major version.
- **Rollback fails:** Ensure `down` uses `IF EXISTS` for all `DROP` statements.
- **Seeder runs in production:** The admin user seeder checks `NODE_ENV`. Verify the environment variable is set to `production` in the deployment.
- **`module is not defined in ES module scope`:** Do not remove `src/infrastructure/persistence/migrations/package.json` which sets `"type": "commonjs"`.
