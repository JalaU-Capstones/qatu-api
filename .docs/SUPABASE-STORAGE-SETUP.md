# Supabase Storage Setup — Avatar Management (ADR-010 / SP-10)

This guide explains how to configure Supabase Storage for user profile avatars (`US-04: Profile Management`).

## Architecture Overview

In accordance with **ADR-010** and **SP-10**, Q'atu stores user profile avatar images in **Supabase Storage** and persists the **full public URL** in `profiles.avatar_path` (Option A — Direct Public URL):

```text
https://<project-ref>.supabase.co/storage/v1/object/public/avatars/{userId}/{uuid}.{ext}
```

Storing the complete public URL ensures that browsers can render `<img src={profile.avatar_path}>` directly from the Supabase CDN without requiring a custom reverse proxy on the frontend origin.

---

## 1. Step-by-Step Bucket Creation

> [!NOTE]
> **As of Sprint 5**, the `avatars` bucket and its RLS policies are created **automatically** by:
>
> - `supabase/config.toml` → `[storage.buckets.avatars]` (bucket)
> - `supabase/migrations/20261108120000_avatars_bucket_policies.sql` (RLS policies)
>
> Both are applied by `npx supabase start` and `npx supabase db reset` against the **Supabase DB** (`supabase_db_api`, port 54322) — not the App DB. The manual steps below are kept for reference (e.g. Supabase Cloud without running local migrations, or Dashboard recreation).

### Using the Supabase Dashboard (Cloud or Studio at `http://localhost:54323`)

1. Open **Storage** in the left sidebar and click **New bucket**.
2. Set the bucket configuration:
   - **Name:** `avatars`
   - **Public bucket:** **Enabled (`true`)** — allows public `GET` reads via `/storage/v1/object/public/avatars/...` while uploads remain restricted to authenticated users/backend service role.
   - **Restrict file size:** `2 MB` (`2097152` bytes)
   - **Allowed MIME types:** `image/jpeg, image/png, image/webp`
3. Click **Save**.

### Object Path Pattern

Uploaded files are stored under a deterministic user-scoped prefix with a generated UUID v4 filename to prevent collisions and cache-staleness:

```text
{userId}/{uuid}.{ext}
```

Example:

```text
a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/550e8400-e29b-41d4-a716-446655440000.webp
```

---

## 2. Row Level Security (RLS) Policies for `storage.objects`

Run the following SQL in the Supabase **SQL Editor** to enforce ownership at the storage layer:

```sql
-- 1. Public read access for avatars
CREATE POLICY "Public read access for avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 2. Authenticated users can upload their own avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid() = owner
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Authenticated users can update their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid() = owner
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Authenticated users can delete their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid() = owner
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## 3. CORS Configuration

Ensure the following origins are allowed for both the API (`ALLOWED_ORIGINS`) and Supabase Storage:

- **Local Development:** `http://localhost:5173`, `http://localhost:3000`
- **Production:** `https://qatu.pe`, `https://cdn.qatu.pe`

---

## 4. Service Role & Anon Key Permissions

- **`SUPABASE_SERVICE_ROLE_KEY` (Server-side only):** Used by the backend [`SupabaseStorageService`](../src/infrastructure/storage/SupabaseStorageService.js) after the application layer (`authMiddleware` + `UploadAvatarUseCase`) verifies user authentication (`req.user.id`), double-submit CSRF token (`X-CSRF-Token`), ownership (`requestingUserId === targetUserId`), file size ($\le 2\text{ MB}$), and MIME type (`image/jpeg`, `image/png`, `image/webp`). **Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend client or logs.**
- **`SUPABASE_ANON_KEY`:** Safe for standard public/client operations where RLS policies apply.

---

## 5. Environment Variables (`.env.example`)

Configure the following variables in `api/.env`:

```dotenv
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_PUBLIC_URL=http://localhost:54321/storage/v1/object/public
SUPABASE_STORAGE_BUCKET=avatars
```

If `SUPABASE_STORAGE_PUBLIC_URL` is left empty, the backend automatically derives `${SUPABASE_URL}/storage/v1/object/public`.

## Product Images Bucket (US-16)

The `product-images` bucket was added alongside `avatars` (see `supabase/config.toml` and `supabase/migrations/20261113130000_product_images_bucket_policies.sql`). Configuration:

| Property           | Value                                                             |
| ------------------ | ----------------------------------------------------------------- |
| Bucket             | `product-images`                                                  |
| Visibility         | public (read), authenticated (write)                              |
| Max file size      | 5 MB                                                              |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/webp`                           |
| Path convention    | `product-images/{product_id}/{uuid}.{ext}`                        |
| Upload policy      | Server-mediated via `SupabaseStorageService.uploadProductImage()` |

**`SupabaseStorageService.uploadProductImage()`** returns:

```js
{
  bucket: 'product-images',
  path: 'product-images/{product_id}/{uuid}.{ext}',  // relative, per ADR-010
  publicUrl: '<computed>'                              // per ADR-019 (see below)
}
```

Callers (e.g. `UploadProductImageUseCase`, prompt 2D.2) must store `path` in the DB and use `publicUrl` in the API response.

**`SupabaseStorageService.getPublicUrl(bucket, objectKey)`** builds the public URL for any stored object. It respects the `PUBLIC_APP_URL` env var (ADR-019):

- **Empty `PUBLIC_APP_URL` (default):** returns the Supabase direct URL
  `http://localhost:54321/storage/v1/object/public/{bucket}/{objectKey}`.
- **Set `PUBLIC_APP_URL` (e.g. `http://localhost:5173` or `https://qatu.com`):** returns the SPA-origin URL `{PUBLIC_APP_URL}/{bucket}/{objectKey}`. Requires the client nginx proxy to forward `/avatars/*` and `/product-images/*` (frontend branch).

> [!NOTE]
> **Legacy inconsistency:** `uploadAvatar()` still returns `{ path: <fullSupabaseUrl> }` (not relative). `profiles.avatar_path` therefore contains full URLs today. Migration to relative paths (storing `avatar_path = 'avatars/{uuid}/xxx.webp'` and computing the URL via `getPublicUrl('avatars', avatar_path)`) is deferred to a future cleanup. New code paths (`uploadProductImage`) use the relative-path convention from day one.

### Testing the bucket locally

After `npx supabase start` (which applies the new migration), the bucket exists and is writable by authenticated users. Verify:

```bash
# List buckets (auth required)
curl -s http://localhost:54321/storage/v1/bucket \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | jq '.[].id'
# Expected output includes: "avatars" and "product-images"
```

Uploads via the API (server-mediated) use `SERVICE_ROLE_KEY` and are not blocked by RLS. Direct uploads from a browser require a logged-in session; the simplified bucket-level policy (`bucket_id = 'product-images'`) allows any authenticated user — application-layer ownership validation (in `UploadProductImageUseCase`, prompt 2D.2) enforces that a seller can only upload to their own products.
