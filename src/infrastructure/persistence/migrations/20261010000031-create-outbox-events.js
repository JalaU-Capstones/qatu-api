'use strict';

/**
 * Migration 31: transactional outbox (ADR-014).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create table if not exists public.outbox_events (
          id uuid primary key default gen_random_uuid(),
          event_type text not null,
          aggregate_type text not null,
          aggregate_id uuid not null,
          routing_key text not null,
          payload jsonb not null,
          status text not null default 'pending'
            check (status in ('pending', 'published', 'failed')),
          attempts integer not null default 0,
          last_error text,
          next_attempt_at timestamptz not null default now(),
          created_at timestamptz not null default now(),
          published_at timestamptz
        );

        create index if not exists idx_outbox_pending
          on public.outbox_events (next_attempt_at)
          where status = 'pending';

        create index if not exists idx_outbox_aggregate
          on public.outbox_events (aggregate_type, aggregate_id);

        alter table public.outbox_events enable row level security;
      `,
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        drop index if exists public.idx_outbox_aggregate;
        drop index if exists public.idx_outbox_pending;
        drop table if exists public.outbox_events;
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
