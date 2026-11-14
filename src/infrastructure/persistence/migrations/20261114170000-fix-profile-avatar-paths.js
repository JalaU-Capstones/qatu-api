'use strict';

/**
 * One-time data migration: converts any `profiles.avatar_path` that is a
 * full Supabase URL into a relative storage path.
 *
 * Before: `http://localhost:54321/storage/v1/object/public/avatars/{u}/{f}.webp`
 * After:  `avatars/{u}/{f}.webp`
 *
 * After this migration, `resolveImageUrl()` in `src/application/utils/`
 * computes the URL at read time (ADR-019 Phase 1). This makes the
 * `PUBLIC_APP_URL` toggle effective and reversible.
 *
 * Idempotent: only affects rows whose `avatar_path` matches `^https?://`.
 * Running twice is safe (second run matches 0 rows).
 *
 * Reversible: NO. The original URL values are derived from the path + env,
 * not independent data. The `down` intentionally does NOTHING — reverting
 * to URLs would be re-broken behavior. Roll forward only.
 */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        update public.profiles
        set avatar_path = regexp_replace(
          avatar_path,
          '^https?://[^/]+/storage/v1/object/public/',
          ''
        )
        where avatar_path like 'http%';
        `,
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down() {
    // Intentional no-op: the previous URLs were derived, not authoritative.
    // See migration JSDoc.
  },
};
