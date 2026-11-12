'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create table if not exists public.messages (
          id uuid primary key default gen_random_uuid(),
          conversation_id uuid not null references public.conversations(id) on delete cascade,
          sender_id uuid not null references public.profiles(id) on delete cascade,
          content text not null,
          read_at timestamptz,
          edited_at timestamptz,
          deleted_at timestamptz,
          created_at timestamptz not null default now(),
          constraint messages_content_length check (char_length(content) between 1 and 5000)
        );

        create index if not exists idx_messages_conversation_id on public.messages (conversation_id, created_at);
        create index if not exists idx_messages_unread on public.messages (conversation_id, sender_id) where read_at is null and deleted_at is null;

        alter table public.messages enable row level security;

        drop policy if exists "Participants can view messages in own conversations" on public.messages;
        create policy "Participants can view messages in own conversations"
        on public.messages for select
        to authenticated
        using (
          exists (
            select 1 from public.conversations c
            where c.id = conversation_id
              and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))
          )
        );

        drop policy if exists "Participants can send messages in own conversations" on public.messages;
        create policy "Participants can send messages in own conversations"
        on public.messages for insert
        to authenticated
        with check (
          sender_id = (select auth.uid())
          and exists (
            select 1 from public.conversations c
            where c.id = conversation_id
              and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))
          )
        );

        drop policy if exists "Senders can edit own messages within 5 minutes" on public.messages;
        create policy "Senders can edit own messages within 5 minutes"
        on public.messages for update
        to authenticated
        using (
          sender_id = (select auth.uid())
          and created_at > now() - interval '5 minutes'
          and deleted_at is null
        )
        with check (
          sender_id = (select auth.uid())
          and deleted_at is null
        );

        drop policy if exists "Senders can soft-delete own messages" on public.messages;
        create policy "Senders can soft-delete own messages"
        on public.messages for update
        to authenticated
        using (sender_id = (select auth.uid()))
        with check (sender_id = (select auth.uid()));

        drop policy if exists "Admins can manage all messages" on public.messages;
        create policy "Admins can manage all messages"
        on public.messages for all
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
        drop policy if exists "Admins can manage all messages" on public.messages;
        drop policy if exists "Senders can soft-delete own messages" on public.messages;
        drop policy if exists "Senders can edit own messages within 5 minutes" on public.messages;
        drop policy if exists "Participants can send messages in own conversations" on public.messages;
        drop policy if exists "Participants can view messages in own conversations" on public.messages;
        drop index if exists public.idx_messages_unread;
        drop index if exists public.idx_messages_conversation_id;
        drop table if exists public.messages cascade;
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
