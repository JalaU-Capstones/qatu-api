'use strict';

// ADR-020: the `auth` schema is owned by Supabase. This migration only
// provisions `pgcrypto`. Testcontainers integration tests install a
// minimal auth shim via __tests__/helpers/testAuthShim.sql AFTER migrations.
// Modo A (Supabase CLI) and production have the real auth schema.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
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
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        drop extension if exists pgcrypto;
      `,
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
