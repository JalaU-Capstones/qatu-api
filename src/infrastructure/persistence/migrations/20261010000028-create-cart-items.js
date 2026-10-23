'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        drop table if exists public.cart_items cascade;

        create table if not exists public.cart_items (
          id uuid primary key default gen_random_uuid(),
          user_id uuid not null references public.profiles(id) on delete cascade,
          product_id uuid not null references public.products(id) on delete cascade,
          quantity integer not null default 1 check (quantity > 0),
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (user_id, product_id)
        );

        create index if not exists idx_cart_items_user_id on public.cart_items (user_id);
        create index if not exists idx_cart_items_product_id on public.cart_items (product_id);

        alter table public.cart_items enable row level security;

        drop policy if exists "Users can read own cart items" on public.cart_items;
        create policy "Users can read own cart items"
        on public.cart_items for select
        to authenticated
        using (user_id = (select auth.uid()));

        drop policy if exists "Users can insert own cart items" on public.cart_items;
        create policy "Users can insert own cart items"
        on public.cart_items for insert
        to authenticated
        with check (user_id = (select auth.uid()));

        drop policy if exists "Users can update own cart items" on public.cart_items;
        create policy "Users can update own cart items"
        on public.cart_items for update
        to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()));

        drop policy if exists "Users can delete own cart items" on public.cart_items;
        create policy "Users can delete own cart items"
        on public.cart_items for delete
        to authenticated
        using (user_id = (select auth.uid()));

        drop trigger if exists set_updated_at on public.cart_items;
        create trigger set_updated_at
          before update on public.cart_items
          for each row execute function public.handle_updated_at();
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
        drop policy if exists "Users can delete own cart items" on public.cart_items;
        drop policy if exists "Users can update own cart items" on public.cart_items;
        drop policy if exists "Users can insert own cart items" on public.cart_items;
        drop policy if exists "Users can read own cart items" on public.cart_items;
        drop trigger if exists set_updated_at on public.cart_items;
        drop index if exists public.idx_cart_items_product_id;
        drop index if exists public.idx_cart_items_user_id;
        drop table if exists public.cart_items cascade;
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
