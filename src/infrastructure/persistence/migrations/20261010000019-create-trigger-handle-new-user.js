'use strict';

// ADR-020: the `auth` schema is owned by Supabase. This migration only
// provisions `pgcrypto`. Testcontainers integration tests install a
// minimal auth shim via __tests__/helpers/testAuthShim.sql AFTER migrations.
// Modo A (Supabase CLI) and production have the real auth schema.

/**
 * DEPRECATED — see ADR-020.
 *
 * The trigger installation moved to supabase/migrations/20261113120000_handle_new_user_trigger.sql.
 * Supabase (via `npx supabase db reset`) now owns auth.users and the trigger.
 *
 * This migration is preserved as a no-op to keep the Sequelize migration
 * history intact for environments that already ran it.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up() {
    // ADR-020: trigger owned by Supabase. See supabase/migrations/20261113120000_handle_new_user_trigger.sql
  },

  async down() {},
};
