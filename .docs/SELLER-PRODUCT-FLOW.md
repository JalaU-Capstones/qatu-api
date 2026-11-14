# Seller Product Flow (US-16)

## Overview

A seller can create a draft product, upload up to 5 images, and publish it.
Publishing requires at least one image (enforced by the
`IMAGE_REQUIRED` check).

## Endpoints

| Step            | Method  | Path                       | Auth          |
| --------------- | ------- | -------------------------- | ------------- |
| 1. Create draft | `POST`  | `/v1/products`             | seller + CSRF |
| 2. Upload image | `POST`  | `/v1/products/:id/images`  | seller + CSRF |
| 3. List images  | `GET`   | `/v1/products/:id/images`  | public        |
| 4. Publish      | `PATCH` | `/v1/products/:id/publish` | seller + CSRF |
| 5. Read public  | `GET`   | `/v1/products/:id`         | public        |

## State transitions

- `draft → published` (via `PATCH /publish`): requires ≥1 image.
- Any other source state → `409 INVALID_STATE_TRANSITION`.
- Ownership: only the owning seller can upload / publish. Cross-seller
  attempts return `403 FORBIDDEN`.

## Constraints

- Max 5 images per product → `422 IMAGE_LIMIT_REACHED` on the 6th.
- Max 5 MiB per image → `422 FILE_TOO_LARGE`.
- Allowed formats: JPEG, PNG, WebP → `422 INVALID_FILE_FORMAT` otherwise.
- Slug uniqueness per seller → `409 SLUG_ALREADY_EXISTS` on `POST /products`.

## Image URLs

Images are stored as relative paths in the DB and resolved to full URLs
at read time by the DTOs (`resolveImageUrl()`). The `PUBLIC_APP_URL`
toggle controls the origin. See `STORAGE.md` for details.

## E2E test

`src/application/use-cases/__tests__/SellerProductFlow.integration.test.js`
runs the full flow against a live API + Supabase. It SKIPS when either
is unreachable (CI safe). To run it locally:

```
npx supabase start
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d api
pnpm vitest run src/application/use-cases/__tests__/SellerProductFlow.integration.test.js
```
