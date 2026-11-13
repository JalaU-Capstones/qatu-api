'use strict';

/**
 * DEPRECATED — see ADR-020.
 *
 * The trigger installation moved to supabase/migrations/20261113120000_handle_new_user_trigger.sql.
 * Supabase (via `npx supabase db reset`) now owns auth.users and the trigger.
 *
 * This migration is preserved as a no-op to keep the Sequelize migration
 * history intact for environments that already ran it. The down() still
 * performs the original drop so rollback of pre-existing environments works.
 *
 * Do NOT add new functionality here.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up() {},

  async down() {},
};
