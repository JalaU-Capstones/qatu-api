'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create table if not exists public.order_items (
          id uuid primary key default gen_random_uuid(),
          order_id uuid not null references public.orders(id) on delete cascade,
          product_id uuid references public.products(id) on delete set null,
          product_name text not null,
          product_image_path text,
          quantity integer not null check (quantity > 0),
          unit_price numeric(12, 2) not null check (unit_price >= 0),
          subtotal numeric(12, 2) generated always as (quantity * unit_price) stored,
          created_at timestamptz not null default now()
        );

        create index if not exists idx_order_items_order_id on public.order_items (order_id);
        create index if not exists idx_order_items_product_id on public.order_items (product_id);

        alter table public.order_items enable row level security;

        drop policy if exists "Buyers can view own order items" on public.order_items;
        create policy "Buyers can view own order items"
        on public.order_items for select
        to authenticated
        using (
          exists (
            select 1 from public.orders o
            where o.id = order_id and o.buyer_id = (select auth.uid())
          )
        );

        drop policy if exists "Sellers can view order items of own products" on public.order_items;
        create policy "Sellers can view order items of own products"
        on public.order_items for select
        to authenticated
        using (
          exists (
            select 1 from public.products p
            where p.id = product_id and p.seller_id = (select auth.uid())
          )
        );

        drop policy if exists "Admins can view all order items" on public.order_items;
        create policy "Admins can view all order items"
        on public.order_items for select
        to authenticated
        using (
          exists (
            select 1 from public.user_roles ur
            join public.roles r on r.id = ur.role_id
            where ur.profile_id = (select auth.uid()) and r.name = 'admin'
          )
        );

        drop policy if exists "Sellers can view orders containing their products" on public.orders;
        create policy "Sellers can view orders containing their products"
        on public.orders for select
        to authenticated
        using (
          exists (
            select 1
            from public.order_items oi
            join public.products p on p.id = oi.product_id
            where oi.order_id = public.orders.id
              and p.seller_id = (select auth.uid())
          )
        );

        drop policy if exists "Sellers can update status of own product orders" on public.orders;
        create policy "Sellers can update status of own product orders"
        on public.orders for update
        to authenticated
        using (
          exists (
            select 1
            from public.order_items oi
            join public.products p on p.id = oi.product_id
            where oi.order_id = public.orders.id
              and p.seller_id = (select auth.uid())
          )
        )
        with check (
          exists (
            select 1
            from public.order_items oi
            join public.products p on p.id = oi.product_id
            where oi.order_id = public.orders.id
              and p.seller_id = (select auth.uid())
          )
        );
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
        drop policy if exists "Sellers can update status of own product orders" on public.orders;
        drop policy if exists "Sellers can view orders containing their products" on public.orders;
        drop policy if exists "Admins can view all order items" on public.order_items;
        drop policy if exists "Sellers can view order items of own products" on public.order_items;
        drop policy if exists "Buyers can view own order items" on public.order_items;
        drop index if exists public.idx_order_items_product_id;
        drop index if exists public.idx_order_items_order_id;
        drop table if exists public.order_items cascade;
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
