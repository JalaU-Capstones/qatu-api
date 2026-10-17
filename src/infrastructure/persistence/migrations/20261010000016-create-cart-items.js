'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create table if not exists public.cart_items (
          id uuid primary key default gen_random_uuid(),
          profile_id uuid not null references public.profiles(id) on delete cascade,
          product_id uuid not null references public.products(id) on delete cascade,
          quantity integer not null check (quantity > 0 and quantity <= 1000),
          saved_for_later boolean not null default false,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (profile_id, product_id)
        );

        create index if not exists idx_cart_items_profile_id on public.cart_items (profile_id) where saved_for_later = false;

        alter table public.cart_items enable row level security;

        drop policy if exists "Users can view own cart items" on public.cart_items;
        create policy "Users can view own cart items"
        on public.cart_items for select
        to authenticated
        using (profile_id = (select auth.uid()));

        drop policy if exists "Users can add items to own cart" on public.cart_items;
        create policy "Users can add items to own cart"
        on public.cart_items for insert
        to authenticated
        with check (profile_id = (select auth.uid()));

        drop policy if exists "Users can update own cart items" on public.cart_items;
        create policy "Users can update own cart items"
        on public.cart_items for update
        to authenticated
        using (profile_id = (select auth.uid()))
        with check (profile_id = (select auth.uid()));

        drop policy if exists "Users can remove own cart items" on public.cart_items;
        create policy "Users can remove own cart items"
        on public.cart_items for delete
        to authenticated
        using (profile_id = (select auth.uid()));
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
        drop policy if exists "Users can remove own cart items" on public.cart_items;
        drop policy if exists "Users can update own cart items" on public.cart_items;
        drop policy if exists "Users can add items to own cart" on public.cart_items;
        drop policy if exists "Users can view own cart items" on public.cart_items;
        drop index if exists public.idx_cart_items_profile_id;
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
