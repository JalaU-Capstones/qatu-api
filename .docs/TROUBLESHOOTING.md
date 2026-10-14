# Troubleshooting

- **Docker:** If ports conflict, ensure no other Postgres or RabbitMQ is running.
- **pnpm:** Clear cache with `pnpm store prune`.
- **Node.js:** Ensure Node v26+ is used.
- **Environment:** Run `make docker:down -v` to reset data volumes.

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
