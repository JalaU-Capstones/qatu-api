-- ─────────────────────────────────────────────────────────────────────────────
-- RLS policies on storage.objects for the avatars bucket (US-36 / ADR-010).
--
-- Runs against supabase_db_api via `npx supabase start` and `npx supabase db reset`.
-- The bucket itself is declared in supabase/config.toml ([storage.buckets.avatars]).
-- Idempotent: each CREATE POLICY is wrapped in a pg_policies existence check.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='Public read access for avatars'
  ) THEN
    CREATE POLICY "Public read access for avatars"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'avatars');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can upload their own avatar'
  ) THEN
    CREATE POLICY "Users can upload their own avatar"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'avatars'
      AND auth.uid() = owner
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can update their own avatar'
  ) THEN
    CREATE POLICY "Users can update their own avatar"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'avatars'
      AND auth.uid() = owner
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can delete their own avatar'
  ) THEN
    CREATE POLICY "Users can delete their own avatar"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'avatars'
      AND auth.uid() = owner
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;
