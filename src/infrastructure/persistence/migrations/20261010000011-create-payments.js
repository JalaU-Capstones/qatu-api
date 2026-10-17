'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create table if not exists public.payments (
          id uuid primary key default gen_random_uuid(),
          order_id uuid not null unique references public.orders(id) on delete cascade,
          amount numeric(12, 2) not null check (amount >= 0),
          currency text not null default 'USD',
          method text not null
            check (method in ('simulated', 'stripe', 'paypal', 'cash_on_delivery')),
          provider text,
          provider_payment_id text,
          status text not null default 'pending'
            check (status in ('pending', 'processing', 'completed', 'failed', 'refunded')),
          metadata jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        create index if not exists idx_payments_order_id on public.payments (order_id);
        create index if not exists idx_payments_status on public.payments (status);

        alter table public.payments enable row level security;

        drop policy if exists "Buyers can view own payments" on public.payments;
        create policy "Buyers can view own payments"
        on public.payments for select
        to authenticated
        using (
          exists (
            select 1 from public.orders o
            where o.id = order_id and o.buyer_id = (select auth.uid())
          )
        );

        drop policy if exists "Admins can view all payments" on public.payments;
        create policy "Admins can view all payments"
        on public.payments for select
        to authenticated
        using (
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
        drop policy if exists "Admins can view all payments" on public.payments;
        drop policy if exists "Buyers can view own payments" on public.payments;
        drop index if exists public.idx_payments_status;
        drop index if exists public.idx_payments_order_id;
        drop table if exists public.payments cascade;
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
