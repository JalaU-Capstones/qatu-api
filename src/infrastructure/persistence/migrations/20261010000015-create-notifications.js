'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create table if not exists public.notifications (
          id uuid primary key default gen_random_uuid(),
          profile_id uuid not null references public.profiles(id) on delete cascade,
          type text not null check (type in (
            'order_placed', 'order_status_changed', 'message_received',
            'seller_approved', 'seller_rejected', 'rating_received'
          )),
          title text not null,
          body text,
          action_url text,
          payload jsonb not null default '{}'::jsonb,
          read_at timestamptz,
          created_at timestamptz not null default now()
        );

        create index if not exists idx_notifications_profile_id on public.notifications (profile_id, created_at desc);
        create index if not exists idx_notifications_unread on public.notifications (profile_id) where read_at is null;

        alter table public.notifications enable row level security;

        drop policy if exists "Users can view own notifications" on public.notifications;
        create policy "Users can view own notifications"
        on public.notifications for select
        to authenticated
        using (profile_id = (select auth.uid()));

        drop policy if exists "Users can mark own notifications as read" on public.notifications;
        create policy "Users can mark own notifications as read"
        on public.notifications for update
        to authenticated
        using (profile_id = (select auth.uid()))
        with check (profile_id = (select auth.uid()));

        drop policy if exists "Users can delete own notifications" on public.notifications;
        create policy "Users can delete own notifications"
        on public.notifications for delete
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
        drop policy if exists "Users can delete own notifications" on public.notifications;
        drop policy if exists "Users can mark own notifications as read" on public.notifications;
        drop policy if exists "Users can view own notifications" on public.notifications;
        drop index if exists public.idx_notifications_unread;
        drop index if exists public.idx_notifications_profile_id;
        drop table if exists public.notifications cascade;
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
