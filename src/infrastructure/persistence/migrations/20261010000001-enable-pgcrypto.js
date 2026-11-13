'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ADR-020: The auth schema shim (auth.users, auth.uid(), auth.role()) was
    // removed in this migration. Supabase CLI (`npx supabase start`) or Supabase
    // Cloud provides the real auth schema. This migration now only ensures
    // pgcrypto is available for other migrations and RLS policies.
    // See Methodology/Spikes-and-PoC/SP-19-Supabase-Schema-Ownership.
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create extension if not exists pgcrypto;
      `,
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    // ADR-020: The auth shim is no longer created in up(). This down() is a
    // no-op for the retired shim. The pgcrypto extension is intentionally NOT
    // dropped because it may be used by Supabase-managed schemas.
  },
};
