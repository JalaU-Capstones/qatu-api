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
