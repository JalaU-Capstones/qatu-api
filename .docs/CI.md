# Continuous Integration (CI)

## Overview

The Qatu Marketplace API uses automated CI pipelines on both GitLab CI (primary) and GitHub Actions (mirror). The pipelines run linting, OpenAPI schema validation, test suites (unit and integration tests), and security audits on pull/merge requests and target branches (`main`, `develop`).

To run database integration tests in environments without Docker access (such as GitLab SaaS shared runners), CI pipelines spin up a PostgreSQL service container sidecar and configure `TEST_DATABASE_URL`.

## Test Matrix

| Environment                    | Integration test backend              | Docker required?        |
| ------------------------------ | ------------------------------------- | ----------------------- |
| Local (developer)              | Testcontainers (`postgres:17-alpine`) | Yes                     |
| GitLab CI (SaaS shared runner) | GitLab service container              | No (runner provides it) |
| GitHub Actions                 | Service container                     | No (runner provides it) |

## Workflows

### Local Workflow

Developers run tests using the local environment:

1. Ensure Docker is running.
2. Run `make test` (or `pnpm test`).
3. The test suite automatically uses Testcontainers (`postgres:17-alpine`) when `TEST_DATABASE_URL` is not set. No environment variables are required.

### CI Workflow

In CI environments:

1. The CI runner provisions a PostgreSQL 17 service container.
2. The pipeline injects `TEST_DATABASE_URL`:
   - GitLab CI: `postgresql://test:test@postgres:5432/qatu_test`
   - GitHub Actions: `postgresql://test:test@localhost:5432/qatu_test`
3. The integration test detects `TEST_DATABASE_URL` and directly connects to the database, executing the minimal schema setup and tests without requiring a local Docker daemon.

## Troubleshooting

- **`Could not find a working container runtime strategy`:** Docker daemon is not accessible. Run locally with Docker running, or provide `TEST_DATABASE_URL` pointing to an existing PostgreSQL database.
- **`connect ECONNREFUSED postgres:5432` in CI:** The `services:` block is missing or misconfigured. Verify the `alias` matches the hostname in `TEST_DATABASE_URL` (`postgres`).
- **`relation "user_roles" does not exist`:** The schema setup SQL failed. Check the `SCHEMA_SQL` constant in `ProfileRepository.integration.test.js`.
