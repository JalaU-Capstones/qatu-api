'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create or replace function public.handle_updated_at()
        returns trigger
        language plpgsql
        as $$
        begin
          new.updated_at := now();
          return new;
        end;
        $$;

        do $$
        declare
          t text;
        begin
          foreach t in array array[
            'profiles', 'seller_applications', 'categories', 'products',
            'orders', 'payments', 'ratings', 'conversations', 'cart_items'
          ]
          loop
            execute format(
              'drop trigger if exists set_updated_at on public.%I;
               create trigger set_updated_at before update on public.%I
               for each row execute function public.handle_updated_at();', t, t
            );
          end loop;
        end;
        $$;
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
        do $$
        declare
          t text;
        begin
          foreach t in array array[
            'profiles', 'seller_applications', 'categories', 'products',
            'orders', 'payments', 'ratings', 'conversations', 'cart_items'
          ]
          loop
            execute format('drop trigger if exists set_updated_at on public.%I;', t);
          end loop;
        end;
        $$;

        drop function if exists public.handle_updated_at();
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
