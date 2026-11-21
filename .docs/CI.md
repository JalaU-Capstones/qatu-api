# Continuous Integration (CI)

## Overview

The Qatu Marketplace API uses automated CI pipelines on both **GitLab CI** (primary) and **GitHub Actions** (mirror). The GitLab CI pipeline is structured into 6 sequential stages designed to guarantee quality, enforce architectural standards, generate test coverage artifacts, and publish SemVer-tagged container images to the GitLab Container Registry.

### Pipeline Stages

| #   | Stage         | Purpose                                                                                                                                          | Scope / Trigger          |
| --- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| 1   | `compile`     | Static analysis: ESLint, Prettier, OpenAPI bundling/validation, and npm production dependency security audit                                     | All branches + tags      |
| 2   | `build`       | Source syntax verification (`node --check`) and production dependency resolution (`pnpm install --prod`)                                         | All branches + tags      |
| 3   | `test`        | Automated test suite execution with a PostgreSQL 17 sidecar service container                                                                    | All branches + tags      |
| 4   | `coverage`    | Dedicated test coverage measurement and artifact generation (HTML and JSON reports)                                                              | All branches + tags      |
| 5   | `build-image` | Docker image build targeting the runtime stage and publication of temporary pipeline tag (`pipeline-$CI_PIPELINE_ID`)                            | All branches + tags      |
| 6   | `push-image`  | SemVer resolution, drift verification, and publication of release container image tags (`DEV-MAJOR.MINOR.PATCH`, `vMAJOR.MINOR.PATCH`, `latest`) | Release tags (`v*`) only |

---

## Stage Details

### 1. `compile`

- **What it runs**:
  - `pnpm lint`: ESLint static analysis checking JS rules, modern ES syntax, and code quality.
  - `pnpm format:check`: Prettier check to enforce project styling rules.
  - `pnpm openapi:bundle`: Bundles modular OpenAPI 3.1 definitions into `dist/openapi.bundle.yaml`.
  - `pnpm openapi:validate`: Validates OpenAPI specifications using Redocly CLI and Spectral.
  - `pnpm audit --prod`: Scans production dependencies for known security vulnerabilities (blocking on high/critical).
  - `pnpm audit || true`: Runs informational dependency check across all packages.
- **Why**: Static analysis catches syntax and schema errors, formatting deviations, and known security vulnerabilities early before dedicating runner resources to container builds or test runners. Bundled OpenAPI artifacts are stored for 1 hour.

### 2. `build`

- **What it runs**:
  - `node --check src/server.js`
  - `node --check src/app.js`
  - `node --check src/infrastructure/config/env.js`
  - `pnpm install --prod --frozen-lockfile`
- **Why**: Because the Node.js backend uses native ESM without a TypeScript compilation step, this stage validates that core entrypoint modules have valid syntax without runtime execution (`node --check`) and proves that clean, production-only dependencies can be resolved and installed without devDependencies.

### 3. `test`

- **What it runs**:
  - `pnpm test` (Vitest test suite)
- **Services & Variables**:
  - Sidecar container: `postgres:17-alpine` (alias: `postgres`).
  - `POSTGRES_USER: test`, `POSTGRES_PASSWORD: test`, `POSTGRES_DB: qatu_test`.
  - `TEST_DATABASE_URL: 'postgresql://test:test@postgres:5432/qatu_test'`.
- **Why**: Executes all unit and integration test suites against an isolated PostgreSQL instance without requiring Docker daemon access on shared runners.

### 4. `coverage`

- **What it runs**:
  - `pnpm test:coverage` (Vitest with V8 coverage provider)
- **Artifacts & Reports**:
  - Tracks coverage percentage via regex `^All files\s*\|\s*([\d.]+)`.
  - Collects `coverage/` directory including `coverage-final.json` and interactive HTML reports (stored for 1 week).
  - Cobertura XML format configured for GitLab CI code quality integration.
- **Why**: Kept as a distinct stage per DevOps Lab specifications to separate baseline test pass/fail status from code coverage analysis and artifact ingestion.

### 5. `build-image`

- **What it runs**:
  - `docker build --target runtime --tag "$TEMP_TAG" ... .`
  - `docker push "$TEMP_TAG"`
- **Services**: `docker:27-dind` with `--tls=false`.
- **Why**: Validates that the multi-stage `Dockerfile` builds cleanly on every branch push, pull request, and release tag. Pushes a transient image tag (`$CI_REGISTRY_IMAGE:pipeline-$CI_PIPELINE_ID`) to the registry so downstream release publication does not need to rebuild the image from scratch.

### 6. `push-image`

- **What it runs**:
  - SemVer resolution and drift validation.
  - Re-tags the temporary pipeline image (`$TEMP_TAG`) with final release tags.
  - Pushes all three final tags to the GitLab Container Registry.
- **Rules**: Runs exclusively on `v*` tag pushes (`if: $CI_COMMIT_TAG =~ /^v.*/`).
- **Why**: Splits container image compilation from release artifact publication. Ensures production release tags are only pushed upon verified release events.

---

## SemVer Tagging & Publishing Strategy

Each production release publishes **3 tags** to the container registry (`$CI_REGISTRY_IMAGE`):

| Tag Type            | Format                  | Example     | Description                                      | Mutability |
| ------------------- | ----------------------- | ----------- | ------------------------------------------------ | ---------- |
| **SemVer (Lab 4)**  | `DEV-MAJOR.MINOR.PATCH` | `DEV-2.0.0` | Primary requirement for DevOps Lab Week 4        | Immutable  |
| **Backward Compat** | `vMAJOR.MINOR.PATCH`    | `v2.0.0`    | Preserves existing tags for downstream consumers | Immutable  |
| **Latest Alias**    | `latest`                | `latest`    | Convenient reference for latest stable release   | Mutable    |

### Version Computation and Drift Guard

The version is dynamically resolved at pipeline execution time and is **never hardcoded**:

- On release tag events: `$CI_COMMIT_TAG` is stripped of its leading `v` (e.g. `v2.0.0` → `2.0.0`).
- Fallback on branch runs: Read from `package.json` (`node -p "require('./package.json').version"`).

**Drift Guard**: If a tag push occurs, the pipeline compares `${CI_COMMIT_TAG#v}` against `package.json.version`. If they do not match, the pipeline immediately halts with an error:

```bash
::error::VERSION MISMATCH — git tag v<PKG_VERSION> does not match package.json <PKG_VERSION>
```

This prevents releasing mislabeled or drifted container artifacts.

---

## Release Workflow

To publish a new version of the API:

1. **Create release branch** from latest `develop`:
   ```bash
   git checkout develop && git pull
   git checkout -b release/v2.0.0
   ```
2. **Bump version** in `package.json` (`0.1.0` → `2.0.0`):
   ```bash
   # Update package.json version field
   git add package.json
   git commit -m "chore(release): v2.0.0"
   git push origin release/v2.0.0
   ```
3. **Create and push the git tag**:
   ```bash
   git tag v2.0.0
   git push origin v2.0.0
   ```
4. **Pipeline executes**:
   - `compile`, `build`, `test`, `coverage`, and `build-image` run on the tag.
   - `push-image` resolves `DEV-2.0.0`, `v2.0.0`, and `latest`, pushing all three to the registry.
5. **Merge back to main and develop**:
   ```bash
   git checkout main
   git merge --no-ff release/v2.0.0
   git push origin main
   git checkout develop
   git merge --no-ff release/v2.0.0
   git push origin develop
   ```

---

## Versioning Policy

Qatu adheres to **Semantic Versioning 2.0.0 (SemVer)**:

- **MAJOR (`DEV-MAJOR.0.0`)**: Incompatible API contract changes, schema breaking migrations, or architecture/network topology adjustments.
- **MINOR (`DEV-MAJOR.MINOR.0`)**: Backward-compatible new functionality or endpoints.
- **PATCH (`DEV-MAJOR.MINOR.PATCH`)**: Backward-compatible bug fixes and internal maintenance.

### Release v2.0.0 Transition

The jump from `0.1.0` directly to `2.0.0` represents breaking architectural transitions:

- **ADR-012**: Transition from Bearer tokens in headers to secure `HttpOnly` `SameSite=Strict` session cookies.
- **ADR-018**: Introduction of three-network isolation topology (`frontend-net`, `backend-net`, `qatu-net`).
- **ADR-019**: Dynamic image URL resolution strategy replacing static relative storage paths.
- **ADR-020**: PostgreSQL database topology and dual schema ownership (`auth` owned by Supabase, `public` owned by API).

For the exhaustive policy, refer to the project documentation at `Architecture/DevOps` (wiki).

---

## Test Matrix

| Environment                    | Integration test backend              | Docker required?        |
| ------------------------------ | ------------------------------------- | ----------------------- |
| Local (developer)              | Testcontainers (`postgres:17-alpine`) | Yes                     |
| GitLab CI (SaaS shared runner) | GitLab service container              | No (runner provides it) |
| GitHub Actions                 | Service container                     | No (runner provides it) |

---

## Troubleshooting

- **Pipeline fails at `push-image` with version mismatch**:
  Verify that the git tag matches `package.json` version exactly (e.g., tag `v2.0.0` requires `"version": "2.0.0"` in `package.json`).
- **Coverage stage reports 0%**:
  Check `vitest.config.js` to ensure the coverage provider (`v8`) is installed and configured, and that `test.coverage.include`/`test.coverage.exclude` correctly points to `src/`.
- **`build-image` fails on DinD**:
  Check that the Docker service command includes `['--tls=false']` and that `DOCKER_HOST: tcp://docker:2375` and `DOCKER_TLS_CERTDIR: ""` are defined.
- **`Could not find a working container runtime strategy` locally**:
  Docker daemon is not running or accessible. Start Docker desktop/engine, or provide `TEST_DATABASE_URL` pointing to an existing PostgreSQL database.
- **`connect ECONNREFUSED postgres:5432` in CI**:
  The `services:` block is missing or misconfigured. Verify the `alias` matches the hostname in `TEST_DATABASE_URL` (`postgres`).
- **`relation "user_roles" does not exist`**:
  The schema setup SQL failed. Check the `SCHEMA_SQL` constant in `ProfileRepository.integration.test.js`.
