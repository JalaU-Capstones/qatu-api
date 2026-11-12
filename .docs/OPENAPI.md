# OpenAPI 3.1 API Contract & Documentation

This document describes the OpenAPI 3.1 specification for the Qatu Marketplace backend REST API, its architecture, tooling, and governance.

---

## 1. Overview

The Qatu Marketplace API contract is defined using **OpenAPI 3.1.0** as the single source of truth for all API communication. The specification is modular, schema-driven, and maintained directly within the codebase at `src/presentation/docs/`.

Interactive documentation is served directly from the backend server via **Swagger UI** and can also be viewed via **Redocly**.

- **Swagger UI:** `http://localhost:3000/api-docs`
- **Raw OpenAPI JSON:** `http://localhost:3000/api-docs/openapi.json`
- **Specification Source:** `src/presentation/docs/openapi.yaml`
- **Bundled Output:** `dist/openapi.bundle.yaml`

---

## 2. Tooling and CLI Commands

We use **Redocly CLI** for bundling, validation, and preview, and **Stoplight Spectral** for structural rule and convention enforcement.

| Command                 | Makefile Target         | Purpose                                                                        |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| `pnpm openapi:bundle`   | `make openapi-bundle`   | Bundles modular multi-file spec into `dist/openapi.bundle.yaml`.               |
| `pnpm openapi:lint`     | `make openapi-lint`     | Runs Redocly CLI and Spectral linters to enforce API style rules.              |
| `pnpm openapi:validate` | `make openapi-validate` | Validates compliance with the OpenAPI 3.1.0 specification.                     |
| `pnpm openapi:preview`  | `make openapi-preview`  | Starts Redocly live preview server with hot reload at `http://127.0.0.1:8080`. |

---

## 3. Architecture & Modular Structure

The specification avoids monolithic anti-patterns by modularizing endpoints by resource and reusing component definitions:

```text
src/presentation/docs/
├── openapi.yaml                         # Root entrypoint
├── swagger.js                           # Express middleware mount
├── paths/                               # Resource endpoint files (e.g., auth, products, orders)
├── components/
│   ├── schemas/                         # Entity schemas & response envelopes
│   ├── parameters/                      # Path, query, and pagination parameters
│   ├── responses/                       # Standard error & success responses
│   ├── securitySchemes/                 # Supabase JWT Bearer authentication
│   └── examples/                        # Concrete request/response example payloads
├── README.md                            # Complete developer guide on extending the spec
└── .redocly.yaml                        # Redocly project config
```

For complete instructions on adding new endpoints, naming conventions, and the Definition of Done (DoD), see [OpenAPI Developer Guide](../src/presentation/docs/README.md).

---

## 4. Response Envelopes & Conventions

All endpoints adhere to standardized response envelopes defined in `Architecture/API-Design`:

### Success Single Resource

```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2026-10-14T12:00:00Z",
    "version": "1.0.0"
  }
}
```

### Success Resource Collection

```json
{
  "data": [ { ... } ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

### Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [
      {
        "field": "price",
        "message": "Price must be greater than zero"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-10-14T12:00:00Z",
    "version": "1.0.0"
  }
}
```

---

## 5. Continuous Integration (CI)

OpenAPI linting and bundling are automated in CI pipelines across both GitLab CI and GitHub Actions:

- Ensures all `$ref` pointers resolve without broken references.
- Validates OpenAPI 3.1 schema compliance.
- Enforces camelCase `operationId`, kebab-case path parameters, and required documentation tags.

---

## 6. References

- [Developer Guide for OpenAPI](../src/presentation/docs/README.md)
- [Wiki: Architecture/API-Design](#)
- [Wiki: Architecture/Security](#)
- [Wiki: Architecture/Data-Model](#)
