'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create or replace function public.handle_product_rating()
        returns trigger
        language plpgsql
        as $$
        declare
          target_product uuid;
        begin
          target_product := coalesce(new.product_id, old.product_id);
          if target_product is not null then
            update public.products
            set average_rating = coalesce((select round(avg(rating)::numeric, 2) from public.ratings where product_id = target_product), 0),
                ratings_count = (select count(*) from public.ratings where product_id = target_product)
            where id = target_product;
          end if;
          return coalesce(new, old);
        end;
        $$;

        drop trigger if exists on_rating_change on public.ratings;
        create trigger on_rating_change
          after insert or update or delete on public.ratings
          for each row execute function public.handle_product_rating();
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
        drop trigger if exists on_rating_change on public.ratings;
        drop function if exists public.handle_product_rating();
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
