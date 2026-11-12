'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create or replace function public.handle_new_message()
        returns trigger
        language plpgsql
        as $$
        begin
          update public.conversations
          set last_message_at = new.created_at
          where id = new.conversation_id;
          return new;
        end;
        $$;

        drop trigger if exists on_message_created on public.messages;
        create trigger on_message_created
          after insert on public.messages
          for each row execute function public.handle_new_message();
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
        drop trigger if exists on_message_created on public.messages;
        drop function if exists public.handle_new_message();
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
