'use strict';

/** One event can notify several people, unique key is event plus profile */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        drop index if exists public.idx_notifications_event_id;

        create unique index if not exists idx_notifications_event_recipient
          on public.notifications (event_id, profile_id)
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
      // If an event already has several recipients, this down fails on purpose
      await queryInterface.sequelize.query(
        `
        drop index if exists public.idx_notifications_event_recipient;

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
};
