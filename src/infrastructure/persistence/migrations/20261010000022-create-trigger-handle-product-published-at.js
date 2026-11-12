'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create or replace function public.handle_product_published_at()
        returns trigger
        language plpgsql
        as $$
        begin
          if new.state = 'published' and (old.state is distinct from 'published' or new.published_at is null) then
            new.published_at := coalesce(new.published_at, now());
          end if;
          return new;
        end;
        $$;

        drop trigger if exists set_product_published_at on public.products;
        create trigger set_product_published_at
          before insert or update on public.products
          for each row execute function public.handle_product_published_at();
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
        drop trigger if exists set_product_published_at on public.products;
        drop function if exists public.handle_product_published_at();
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
