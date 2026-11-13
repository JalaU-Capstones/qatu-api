-- ─────────────────────────────────────────────────────────────────────────────
-- RLS policies on storage.objects for the product-images bucket (US-16 / ADR-020).
--
-- Runs against supabase_db_api via `npx supabase start` and `npx supabase db reset`.
-- The bucket itself is declared in supabase/config.toml ([storage.buckets.product-images]).
--
-- Idempotent: each CREATE POLICY is wrapped in a pg_policies existence check.
--
-- DESIGN NOTE — simplified ownership policy (Option A, SP-19/ADR-020 future work):
-- Path convention is `product-images/{product_id}/{filename}.{ext}` (see
-- `src/infrastructure/persistence/seeders/20261010000026-seed-sample-products.js`).
-- Strict folder-based ownership (`{seller_id}/{product_id}/...`) would require a
-- seed path restructure; deferred to Sprint 7+. For MVP:
--   - The bucket-level policies below enforce bucket_id only.
--   - Application-layer ownership validation (in a future UploadProductImageUseCase)
--     runs BEFORE the storage call.
--   - Server-mediated uploads use SERVICE_ROLE_KEY and bypass RLS anyway (defense-in-depth).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='Public read access for product images'
  ) THEN
    CREATE POLICY "Public read access for product images"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'product-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='Authenticated users can upload product images'
  ) THEN
    CREATE POLICY "Authenticated users can upload product images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'product-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='Authenticated users can update product images'
  ) THEN
    CREATE POLICY "Authenticated users can update product images"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'product-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='Authenticated users can delete product images'
  ) THEN
    CREATE POLICY "Authenticated users can delete product images"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'product-images');
  END IF;
END $$;
