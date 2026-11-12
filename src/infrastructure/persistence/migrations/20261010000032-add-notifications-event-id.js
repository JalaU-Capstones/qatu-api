'use strict';

/**
 * Migration 32: idempotency key for notifications (ADR-014).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        alter table public.notifications add column if not exists event_id uuid;

        create unique index if not exists idx_notifications_event_id
          on public.notifications (event_id)
          where event_id is not null;
      `,
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        drop index if exists public.idx_notifications_event_id;
        alter table public.notifications drop column if exists event_id;
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
