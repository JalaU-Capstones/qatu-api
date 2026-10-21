'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create extension if not exists pg_trgm;

        create index if not exists idx_products_name_trgm
          on public.products using gin (name gin_trgm_ops)
          where state = 'published' and deleted_at is null;

        create index if not exists idx_products_description_trgm
          on public.products using gin (description gin_trgm_ops)
          where state = 'published' and deleted_at is null;
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
      // The pg_trgm extension is intentionally kept: other objects may depend on it.
      await queryInterface.sequelize.query(
        `
        drop index if exists public.idx_products_description_trgm;
        drop index if exists public.idx_products_name_trgm;
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
