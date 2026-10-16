'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create sequence if not exists public.order_number_seq start with 100000;

        create table if not exists public.orders (
          id uuid primary key default gen_random_uuid(),
          order_number text not null unique default 'ORD-' || lpad(nextval('public.order_number_seq')::text, 8, '0'),
          buyer_id uuid not null references public.profiles(id) on delete restrict,
          status text not null default 'pending'
            check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded')),
          currency text not null default 'USD',
          subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
          shipping_cost numeric(12, 2) not null default 0 check (shipping_cost >= 0),
          tax numeric(12, 2) not null default 0 check (tax >= 0),
          total numeric(12, 2) not null default 0 check (total >= 0),
          shipping_address jsonb,
          notes text,
          cancellation_reason text,
          confirmed_at timestamptz,
          shipped_at timestamptz,
          delivered_at timestamptz,
          cancelled_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          constraint orders_currency_check check (currency in ('USD', 'EUR', 'BOB', 'PEN', 'ARS', 'COP', 'MXN', 'BRL')),
          constraint orders_total_consistency check (total = subtotal + shipping_cost + tax)
        );

        create index if not exists idx_orders_buyer_id on public.orders (buyer_id);
        create index if not exists idx_orders_status on public.orders (status);
        create index if not exists idx_orders_created_at on public.orders (created_at desc);
        create index if not exists idx_orders_number on public.orders (order_number);

        alter table public.orders enable row level security;

        drop policy if exists "Buyers can view own orders" on public.orders;
        create policy "Buyers can view own orders"
        on public.orders for select
        to authenticated
        using (buyer_id = (select auth.uid()));

        drop policy if exists "Admins can view all orders" on public.orders;
        create policy "Admins can view all orders"
        on public.orders for select
        to authenticated
        using (
          exists (
            select 1 from public.user_roles ur
            join public.roles r on r.id = ur.role_id
            where ur.profile_id = (select auth.uid()) and r.name = 'admin'
          )
        );

        drop policy if exists "Buyers can create own orders" on public.orders;
        create policy "Buyers can create own orders"
        on public.orders for insert
        to authenticated
        with check (buyer_id = (select auth.uid()));

        drop policy if exists "Buyers can cancel own pending orders" on public.orders;
        create policy "Buyers can cancel own pending orders"
        on public.orders for update
        to authenticated
        using (buyer_id = (select auth.uid()) and status = 'pending')
        with check (buyer_id = (select auth.uid()) and status in ('pending', 'cancelled'));

        drop policy if exists "Admins can manage all orders" on public.orders;
        create policy "Admins can manage all orders"
        on public.orders for all
        to authenticated
        using (
          exists (
            select 1 from public.user_roles ur
            join public.roles r on r.id = ur.role_id
            where ur.profile_id = (select auth.uid()) and r.name = 'admin'
          )
        )
        with check (
          exists (
            select 1 from public.user_roles ur
            join public.roles r on r.id = ur.role_id
            where ur.profile_id = (select auth.uid()) and r.name = 'admin'
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
        drop policy if exists "Admins can manage all orders" on public.orders;
        drop policy if exists "Buyers can cancel own pending orders" on public.orders;
        drop policy if exists "Buyers can create own orders" on public.orders;
        drop policy if exists "Admins can view all orders" on public.orders;
        drop policy if exists "Buyers can view own orders" on public.orders;
        drop index if exists public.idx_orders_number;
        drop index if exists public.idx_orders_created_at;
        drop index if exists public.idx_orders_status;
        drop index if exists public.idx_orders_buyer_id;
        drop table if exists public.orders cascade;
        drop sequence if exists public.order_number_seq;
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
