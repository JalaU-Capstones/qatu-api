'use strict';

/**
 * DEPRECATED — see ADR-020.
 *
 * The OAuth-aware trigger function moved to
 * supabase/migrations/20261113120000_handle_new_user_trigger.sql.
 * Supabase (via `npx supabase db reset`) now owns auth.users and the trigger.
 *
 * This migration is preserved as a no-op to keep the Sequelize migration
 * history intact for environments that already ran it. Both up() and down()
 * are intentionally empty: the trigger lifecycle is now owned by the Supabase
 * SQL migration, so rolling back this Sequelize migration must NOT touch the
 * trigger.
 *
 * Do NOT add new functionality here.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up() {},

  async down() {},
};
