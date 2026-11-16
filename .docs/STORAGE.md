# Storage Architecture & Operations

## Overview

Qatu Marketplace uses Supabase Storage via the local Supabase stack (`npx supabase start`) in development and Supabase Cloud in production. Storage operations are divided across two primary buckets:

1. `avatars` — Public read, authenticated user write. Stores user profile pictures.
2. `product-images` — Public read, authenticated seller write. Stores product catalog imagery.

---

## Architecture: User-Scoped JWT vs. Service Role

### The Problem with Service-Role Uploads

In early implementations, the backend used the global Supabase client singleton (`src/infrastructure/config/supabase.js`) initialized with `SUPABASE_SERVICE_ROLE_KEY`.

When uploading files with a service-role key to Supabase Storage:

- The JWT role claim is `service_role`.
- No `sub` (subject/user UUID) claim exists in the service-role JWT.
- Supabase Storage sets `storage.objects.owner = NULL`.
- The `avatars` Row-Level Security (RLS) policy requires:
  ```sql
  CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() = owner
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
  ```
- Because `auth.uid()` is `NULL` and `owner` is `NULL`, `NULL = NULL` yields `UNKNOWN`/`FALSE` in SQL.
- Furthermore, the policy is restricted `TO authenticated`, but the session role is `service_role`.
- Result: RLS rejects the write with: `new row violates row-level security policy for table "objects"`.

### The Solution: User-Scoped Storage Client

Storage uploads execute using a user-scoped Supabase client instantiated with the authenticated user's access token (JWT).

```
[Incoming Request]
       │
       ▼ (HttpOnly cookie: access_token)
[Express Controller]
       │
       ▼ (accessToken extracted from cookie / Bearer fallback)
[Use Case]
       │
       ▼ (passes accessToken)
[SupabaseStorageService]
       │
       ▼ createUserScopedSupabaseClient(accessToken)
[Supabase Storage API]
       │
       ▼ Authorization: Bearer <user_jwt>
[Postgres RLS on storage.objects]
       ├── auth.uid() = user UUID (from JWT sub)
       ├── owner = user UUID
       └── Policy PASSES
```

### HttpOnly Cookie Security Preserved

- The access token is read exclusively on the server from `req.cookies.access_token` (parsed by `cookie-parser`).
- The JWT is **never** transmitted to the client in JSON response bodies or exposed to client-side scripts.
- For backward compatibility with legacy API clients, the controller also accepts `Authorization: Bearer <token>` as a fallback.

---

## Code Pattern & References

### 1. Client Helper

File: [`src/infrastructure/config/supabase.js`](file:///home/Botina/development-environment/JalaU-Capstones/Qatu Marketplace/api/src/infrastructure/config/supabase.js)

```javascript
export function createUserScopedSupabaseClient(accessToken) {
  if (!accessToken) {
    throw new Error('accessToken is required to create a user-scoped Supabase client');
  }
  return createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
```

### 2. Storage Service

File: [`src/infrastructure/storage/SupabaseStorageService.js`](file:///home/Botina/development-environment/JalaU-Capstones/Qatu Marketplace/api/src/infrastructure/storage/SupabaseStorageService.js)

Both `uploadAvatar` and `uploadProductImage` require `accessToken`:

```javascript
const client = createUserScopedSupabaseClient(accessToken);
await this._uploadToStorage({
  client,
  bucket: this.bucket,
  objectKey,
  buffer,
  contentType: normalizedMime,
  upsert: true,
  uploadType: 'avatar',
});
```

### 3. Controller Token Extraction

Files:

- [`src/presentation/controllers/ProfileController.js`](file:///home/Botina/development-environment/JalaU-Capstones/Qatu Marketplace/api/src/presentation/controllers/ProfileController.js)
- [`src/presentation/controllers/ProductController.js`](file:///home/Botina/development-environment/JalaU-Capstones/Qatu Marketplace/api/src/presentation/controllers/ProductController.js)

```javascript
const accessToken = req.cookies?.access_token || extractBearer(req);
if (!accessToken) {
  const err = new Error('Session token not available for storage upload');
  err.code = 'UNAUTHORIZED';
  err.statusCode = 401;
  throw err;
}
```

---

## When to Use Service Role

The service-role key (`SUPABASE_SERVICE_ROLE_KEY`) is reserved strictly for administrative tasks:

- Administrative bucket provisioning and teardown (`storage.createBucket`, `storage.deleteBucket`).
- Scheduled cleanup jobs or migration scripts running outside an interactive user session.
- System-level queries inspecting storage metadata directly.
  User-initiated file operations must **always** use the user-scoped client pattern.

---

## Path vs URL in DB (ADR-019 Phase 1)

### Storage Convention

The database stores relative storage paths rather than absolute URLs:

- User avatars: `avatars/{userId}/{file}.webp`
- Product images: `product-images/{productId}/{file}.webp`

### Read-Time Resolution

URL resolution happens strictly at read time in the Data Transfer Objects (DTOs) via `resolveImageUrl()` (`src/application/utils/imageUrl.js`), never in repositories or use cases. Repositories and use cases operate solely on the raw relative storage path to maintain clear separation of concerns.

The affected DTOs include:

- `ProfileDTO` (`ProfileResponseDTO`)
- `ProductDetailDTO` (resolves `primary_image_path`, nested `images[].path`, and `seller.avatar_path`)
- `ProductListDTO` (`ProductListItemDTO` resolves `primary_image_path`)
- `LoginDTO` (`LoginResponseDTO`)
- `RegisterDTO` (`RegisterResponseDTO`)

### URL Origin Toggle

`resolveImageUrl()` dynamically computes the fully-qualified public URL depending on the `PUBLIC_APP_URL` environment configuration:

- `PUBLIC_APP_URL` empty / unset → Uses `SUPABASE_STORAGE_PUBLIC_URL` (direct Supabase Storage URL: `http://localhost:54321/storage/v1/object/public/...`).
- `PUBLIC_APP_URL` set (e.g., `http://localhost:5173`) → Uses the SPA origin `${PUBLIC_APP_URL}/...` which proxies storage requests through the frontend nginx proxy (ADR-019 Phase 2).

> [!NOTE]
> Do NOT pass `avatar_path` to `PATCH /profiles/me`; use `POST /profiles/me/avatar` instead to upload and update user avatars.

### Data Migration

Existing rows that stored legacy full URLs were normalized to relative storage paths using migration [`20261114170000-fix-profile-avatar-paths.js`](file:///home/Botina/development-environment/JalaU-Capstones/Qatu Marketplace/api/src/infrastructure/persistence/migrations/20261114170000-fix-profile-avatar-paths.js). This one-time migration strips the Supabase storage prefix, ensuring all rows conform to the relative path convention.

### GET /products/:id/images

Public endpoint that returns all uploaded images for a product in the
order they were stored (`position ASC, created_at ASC`). Each entry
follows `ProductImage.yaml`:

- `id`, `product_id`, `path` (resolved URL), `alt_text`, `position`, `created_at`

The `path` field is resolved at read time by `ProductImageDTO` (never by
the repository or the use case). The same `resolveImageUrl()` toggle
applies: `PUBLIC_APP_URL` empty → Supabase URL; set → SPA-origin URL.

Empty product (no images uploaded yet): returns `{ data: [], meta: { timestamp } }`.
Unknown product: 404 `PRODUCT_NOT_FOUND`. Invalid UUID: 400 `VALIDATION_ERROR`.
