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

## OpenAPI & API Documentation

- **Unresolved `$ref` errors during bundle (`pnpm openapi:bundle`):**
  - Check file path in `$ref`. Paths are relative to the file where the `$ref` is written.
  - Remember that in JSON Pointers, `/` inside path keys must be escaped as `~1` (e.g., `#/paths/~1products~1{id}`).
- **OpenAPI 3.1 vs 3.0 syntax errors:**
  - `nullable: true` is deprecated/invalid in OpenAPI 3.1. Use `type: [string, "null"]` (or multi-type array).
  - Use `examples` (plural) instead of singular `example`.
  - Properties with `format: uuid` require valid RFC 4122 UUID strings in their `examples` (e.g. `7e2b9a6c-1f2d-4b6e-8c3a-9d5f1e2a4b7c`), not synthetic strings like `prod-uuid-1234`.
- **Spectral lint failures (`pnpm openapi:lint`):**
  - `operation-operationId-casing`: `operationId` must be `camelCase` (e.g. `createProduct`, not `CreateProduct` or `create-product`).
  - `operation-tags-required`: Each operation must have at least one tag corresponding to registered tags in `openapi.yaml`.
  - `path-keys-kebab-case`: Parameter and path segment naming must be kebab-case.
- **Swagger UI 404 or outdated spec at `/api-docs`:**
  - Make sure `pnpm openapi:bundle` has been run so that `dist/openapi.bundle.yaml` exists.
  - In development mode, `src/server.js` dynamically bundles if the dist file is missing.

## CI

- **`Could not find a working container runtime strategy` (Testcontainers):** GitLab SaaS shared runners do not provide Docker. The integration test detects `TEST_DATABASE_URL` and connects to a service container instead. If you see this locally, ensure Docker Desktop is running.
- **`TEST_DATABASE_URL` set but connection refused:** Verify the `services:` block in `.gitlab-ci.yml` (hostname must match `alias`). For GitHub Actions, ensure `ports: 5432:5432` is present and the health check is enabled.
- **Integration test setup SQL fails:** The test creates a minimal schema in `SCHEMA_SQL`. If a column was added to the real migration, update the test's schema to match — otherwise the test will fail loudly, which is intentional.
