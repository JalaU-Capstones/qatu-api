'use strict';

/**
 * Migration 20261108000001: RLS policies on storage.objects for the avatars bucket.
 *
 * This migration is a no-op when the `storage` schema does not exist (e.g. a
 * plain Postgres DB in CI without the Supabase storage schema). It checks for
 * the schema before attempting anything, so it always exits cleanly.
 *
 * Both `up` and `down` are idempotent: `up` checks whether the policy already
 * exists before creating it; `down` uses `DROP POLICY IF EXISTS`.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    // Guard: skip gracefully when the storage schema is absent (CI / plain Postgres).
    const [storageSchema] = await queryInterface.sequelize.query(
      "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage'",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    if (!storageSchema) {
      console.warn(
        '[migration 20261108000001] storage schema not found — skipping RLS policy creation (expected in CI)'
      );
      return;
    }

    // Idempotency guard: skip if the first policy already exists.
    const [existing] = await queryInterface.sequelize.query(
      "SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read access for avatars'",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    if (existing) {
      console.info('[migration 20261108000001] RLS policies already exist — skipping');
      return;
    }

    await queryInterface.sequelize.query(`
      CREATE POLICY "Public read access for avatars"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'avatars');

      CREATE POLICY "Users can upload their own avatar"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'avatars'
        AND auth.uid() = owner
        AND (storage.foldername(name))[1] = auth.uid()::text
      );

      CREATE POLICY "Users can update their own avatar"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'avatars'
        AND auth.uid() = owner
        AND (storage.foldername(name))[1] = auth.uid()::text
      );

      CREATE POLICY "Users can delete their own avatar"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'avatars'
        AND auth.uid() = owner
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
    `);
  },

  async down(queryInterface) {
    // Guard: skip gracefully when the storage schema is absent.
    const [storageSchema] = await queryInterface.sequelize.query(
      "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage'",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    if (!storageSchema) {
      console.warn(
        '[migration 20261108000001] storage schema not found — skipping RLS policy removal'
      );
      return;
    }

    await queryInterface.sequelize.query(`
      DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;
      DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
      DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
      DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
    `);
  },
};
