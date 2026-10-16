'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create table if not exists public.conversations (
          id uuid primary key default gen_random_uuid(),
          buyer_id uuid not null references public.profiles(id) on delete cascade,
          seller_id uuid not null references public.profiles(id) on delete cascade,
          product_id uuid references public.products(id) on delete set null,
          last_message_at timestamptz not null default now(),
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          constraint conversations_distinct_participants check (buyer_id <> seller_id)
        );

        create unique index if not exists idx_conversations_unique on public.conversations (buyer_id, seller_id, coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid));
        create index if not exists idx_conversations_buyer_id on public.conversations (buyer_id, last_message_at desc);
        create index if not exists idx_conversations_seller_id on public.conversations (seller_id, last_message_at desc);

        alter table public.conversations enable row level security;

        drop policy if exists "Participants can view own conversations" on public.conversations;
        create policy "Participants can view own conversations"
        on public.conversations for select
        to authenticated
        using (
          buyer_id = (select auth.uid()) or seller_id = (select auth.uid())
        );

        drop policy if exists "Authenticated users can create conversations" on public.conversations;
        create policy "Authenticated users can create conversations"
        on public.conversations for insert
        to authenticated
        with check (
          (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()))
          and buyer_id <> seller_id
        );

        drop policy if exists "Participants can update own conversations" on public.conversations;
        create policy "Participants can update own conversations"
        on public.conversations for update
        to authenticated
        using (
          buyer_id = (select auth.uid()) or seller_id = (select auth.uid())
        )
        with check (
          buyer_id = (select auth.uid()) or seller_id = (select auth.uid())
        );

        drop policy if exists "Admins can view all conversations" on public.conversations;
        create policy "Admins can view all conversations"
        on public.conversations for select
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
        drop policy if exists "Admins can view all conversations" on public.conversations;
        drop policy if exists "Participants can update own conversations" on public.conversations;
        drop policy if exists "Authenticated users can create conversations" on public.conversations;
        drop policy if exists "Participants can view own conversations" on public.conversations;
        drop index if exists public.idx_conversations_seller_id;
        drop index if exists public.idx_conversations_buyer_id;
        drop index if exists public.idx_conversations_unique;
        drop table if exists public.conversations cascade;
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
