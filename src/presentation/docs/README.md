# Qatu Marketplace — OpenAPI 3.1 Specification

This directory contains the modular OpenAPI 3.1.0 specification for the Qatu Marketplace backend REST API. It serves as the **single source of truth** for the API contract between backend, frontend, documentation, and external consumers.

---

## Directory Structure

```text
src/presentation/docs/
├── openapi.yaml                         # Root entrypoint aggregating paths and components
├── swagger.js                           # Express middleware serving Swagger UI and OpenAPI JSON
├── paths/                               # Modular path items (one per resource domain)
│   ├── admin.yaml
│   ├── auth.yaml
│   ├── cart.yaml
│   ├── categories.yaml
│   ├── conversations.yaml
│   ├── messages.yaml
│   ├── notifications.yaml
│   ├── orders.yaml
│   ├── payments.yaml
│   ├── product-images.yaml
│   ├── products.yaml
│   ├── profiles.yaml
│   ├── ratings.yaml
│   └── seller-applications.yaml
├── components/                          # Reusable OpenAPI components
│   ├── schemas/                         # Entity and envelope schemas
│   │   ├── CartItem.yaml
│   │   ├── Category.yaml
│   │   ├── Conversation.yaml
│   │   ├── Error.yaml
│   │   ├── Message.yaml
│   │   ├── Notification.yaml
│   │   ├── Order.yaml
│   │   ├── OrderItem.yaml
│   │   ├── Pagination.yaml
│   │   ├── Payment.yaml
│   │   ├── Product.yaml
│   │   ├── ProductImage.yaml
│   │   ├── Profile.yaml
│   │   ├── Rating.yaml
│   │   ├── Role.yaml
│   │   ├── SellerApplication.yaml
│   │   ├── shared.yaml
│   │   └── User.yaml
│   ├── parameters/                      # Query, path, and header parameters
│   │   ├── filtering.yaml
│   │   ├── pagination.yaml
│   │   └── path-ids.yaml
│   ├── responses/                       # Reusable standard HTTP responses
│   │   ├── errors.yaml
│   │   └── success.yaml
│   ├── securitySchemes/                 # Authentication schemes (Bearer JWT)
│   │   └── bearerAuth.yaml
│   └── examples/                        # Reusable realistic payloads
│       ├── auth.yaml
│       ├── orders.yaml
│       └── products.yaml
├── README.md                            # This developer guide
└── .redocly.yaml                        # Local Redocly CLI configuration
```

---

## Tooling & Commands

The repository provides pnpm scripts and Makefile targets for specification validation, bundling, linting, and interactive preview:

| Command                 | Makefile Target         | Description                                                 |
| ----------------------- | ----------------------- | ----------------------------------------------------------- |
| `pnpm openapi:bundle`   | `make openapi-bundle`   | Bundles modular spec into single `dist/openapi.bundle.yaml` |
| `pnpm openapi:lint`     | `make openapi-lint`     | Runs Redocly CLI and Spectral linters across the spec       |
| `pnpm openapi:validate` | `make openapi-validate` | Validates OpenAPI 3.1 syntax and schema constraints         |
| `pnpm openapi:preview`  | `make openapi-preview`  | Starts local Redocly preview server with live reload        |

Interactive documentation is also served natively by the backend Express server:

- **Swagger UI:** `http://localhost:3000/api-docs`
- **Raw OpenAPI JSON:** `http://localhost:3000/api-docs/openapi.json`

---

## Step-by-Step Guide: Adding a New Endpoint

When adding or updating an API endpoint, follow these steps to keep the specification modular, standardized, and clean:

### Step 1: Define or Update Component Schemas

If your endpoint introduces new data structures, add them under `src/presentation/docs/components/schemas/`:

- Create or update the entity file (e.g. `src/presentation/docs/components/schemas/Product.yaml`).
- Use **PascalCase** for schema names (e.g., `ProductCreateRequest`, `ProductResponse`).
- Use OpenAPI 3.1 syntax:
  - For nullable fields, use `type: [string, "null"]` (do **not** use deprecated `nullable: true`).
  - Provide concrete, realistic `examples` (plural keyword, array or map format).
  - All UUID fields (`format: uuid`) must use valid RFC 4122 UUIDs (e.g., `7e2b9a6c-1f2d-4b6e-8c3a-9d5f1e2a4b7c`).
- Ensure all responses adhere to standard envelopes:
  - Single item: `{ data: { ... }, meta: { timestamp, version } }`
  - List: `{ data: [ ... ], meta: { page, per_page, total, total_pages } }`
  - Error: `{ error: { code, message, details }, meta: { timestamp, version } }`

### Step 2: Define the Path Item

In `src/presentation/docs/paths/<resource>.yaml` (or create a new path file if creating a new resource domain):

- File names must be **kebab-case** (e.g., `seller-applications.yaml`).
- Specify HTTP methods (`get`, `post`, `put`, `patch`, `delete`).
- Operation requirements:
  - `operationId`: Required, **camelCase**, verb-first, globally unique across the entire spec (e.g., `createProduct`, `getProductById`).
  - `summary`: Short one-line summary.
  - `description`: Markdown-formatted description detailing permissions, business rules, and behavior.
  - `tags`: Resource tag (must match one of the predefined tags in `openapi.yaml`).
  - `parameters`: Reference existing reusable parameters from `../components/parameters/` or define endpoint-specific parameters.
  - `requestBody`: Defined inline or referenced from components with `application/json`.
  - `responses`: Document all relevant status codes (200/201/204, 400, 401, 403, 404, 409, 422, 500). Reference standard error responses from `../components/responses/errors.yaml`.
  - `security`: Defaults to global Bearer JWT auth. If the endpoint is public, override with `security: []`.

### Step 3: Register Path in `openapi.yaml`

If you created a new path file or new URL path:

- Open `src/presentation/docs/openapi.yaml`.
- Under the `paths:` section, mount the path reference:
  ```yaml
  /products/{id}/reviews:
    $ref: './paths/products.yaml#/paths/~1products~1{id}~1reviews'
  ```
  _(Note: In JSON Pointer, `/` is escaped as `~1`)._

### Step 4: Validate, Bundle, and Lint

Run the following verification suite locally before committing:

```bash
# 1. Bundle the spec to verify all $ref pointers resolve
pnpm openapi:bundle

# 2. Validate OpenAPI 3.1 syntax
pnpm openapi:validate

# 3. Lint with Redocly CLI and Spectral
pnpm openapi:lint
```

### Step 5: Verify in Swagger UI & Redoc

Preview the documentation visually to confirm proper rendering:

- Start the Redoc preview server: `pnpm openapi:preview`
- Or start the Express development server (`make dev`) and open `http://localhost:3000/api-docs` to test Swagger UI.

---

## Conventions & Rules

1. **OpenAPI Version:** `3.1.0`.
2. **Modular Organization:** Never create a monolithic file. Keep paths in `paths/`, schemas in `components/schemas/`, parameters in `components/parameters/`, and responses in `components/responses/`.
3. **Naming Standards:**
   - Path files: `kebab-case.yaml`
   - Schema files / Component schema keys: `PascalCase`
   - Parameter keys: `kebab-case` (e.g., `pagination-limit`) or camelCase for query parameter names (`perPage`)
   - Operation IDs: `camelCase`, unique, verb-first (`listOrders`, `cancelOrder`)
   - Tags: `lowercase` plural (`products`, `orders`, `categories`)
4. **Security Scheme:**
   - Bearer JWT issued by Supabase Auth (`bearerAuth`).
   - Global default is protected. Public endpoints explicitly specify `security: []`.
5. **UUID Validation:**
   - Any property or parameter with `format: uuid` MUST use an RFC 4122 compliant UUID in examples.
6. **No Undefined Properties:**
   - Ensure `PaginationMeta` only contains `page`, `per_page`, `total`, `total_pages`.

---

## Authentication Flow (HttpOnly Cookies)

Per **ADR-012**, the API uses HttpOnly cookies as the primary session mechanism. Bearer tokens are deprecated but supported during the Sprint 4 migration window.

### Login / Register / Refresh

`POST /v1/auth/login`, `POST /v1/auth/register`, and `POST /v1/auth/refresh` respond with three `Set-Cookie` headers:

| Cookie          | Flags                                       | Purpose                                                                     |
| --------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| `access_token`  | `HttpOnly; Secure; SameSite=Strict; Path=/` | Supabase JWT — sent automatically on every authenticated request            |
| `refresh_token` | `HttpOnly; Secure; SameSite=Strict; Path=/` | Long-lived, rotated on each `/refresh`                                      |
| `csrf_token`    | `SameSite=Strict; Path=/` (NOT HttpOnly)    | Double-submit CSRF defense — frontend reads it and echoes in `X-CSRF-Token` |

The response body returns `{ data: { user, profile, roles }, meta }` — **no token**.

### Authenticated Requests

The browser includes the `access_token` cookie automatically (same-origin or `credentials: 'include'` for CORS). Frontend **MUST NOT** read the token from JavaScript (it can't — it's HttpOnly).

### CSRF Protection

All state-changing requests (`POST`, `PATCH`, `DELETE`) MUST include the `X-CSRF-Token` header matching the `csrf_token` cookie value. Backend rejects mismatches with `403 { error: { code: 'INVALID_CSRF_TOKEN' } }`.

**Exempt endpoints** (documented in `components/parameters/csrf-token.yaml`):

- `POST /v1/auth/login`
- `POST /v1/auth/register`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`

### Access Token Refresh

When an authenticated request returns `401` with `error.code: 'REFRESH_REQUIRED'` (access token expired, refresh token still valid), the frontend calls `POST /v1/auth/refresh` once, then retries the original request. If `/refresh` also returns `401`, the frontend clears state and redirects to `/login`.

### Logout

`POST /v1/auth/logout` invalidates the session on Supabase and clears all three cookies with `Set-Cookie: <name>=; Max-Age=0`.

### Migration Note (Sprint 4 → Sprint 5)

During the transition, the backend `authMiddleware` accepts **both** the `access_token` cookie (preferred) and the legacy `Authorization: Bearer <token>` header. The `bearerAuth` scheme in the OpenAPI spec is marked **deprecated**. Clients MUST migrate to cookies. The Bearer fallback will be removed in Sprint 5.

---

## Definition of Done (DoD) for API Contract

A change to the API contract is considered complete when:

- [ ] Matches the Wiki documentation at `Architecture/API-Design`.
- [ ] Conforms to OpenAPI 3.1.0 syntax.
- [ ] All operations include `operationId` (camelCase, verb-first, unique), `summary`, `description`, and `tags`.
- [ ] Standard response envelopes (`data` + `meta` or `error` + `meta`) are strictly applied.
- [ ] Valid RFC 4122 UUIDs are used for all UUID examples.
- [ ] `pnpm openapi:bundle` runs cleanly with 0 errors.
- [ ] `pnpm openapi:validate` passes with 0 errors and 0 warnings.
- [ ] `pnpm openapi:lint` (Redocly + Spectral) passes with 0 errors.
- [ ] Formatted with Prettier (`pnpm format:check`).
- [ ] Both Swagger UI (`/api-docs`) and Redocly preview render without UI errors.
