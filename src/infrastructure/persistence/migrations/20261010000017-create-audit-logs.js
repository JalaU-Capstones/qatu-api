'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create table if not exists public.audit_logs (
          id bigint primary key generated always as identity,
          actor_id uuid references public.profiles(id) on delete set null,
          action text not null,
          entity_type text not null,
          entity_id uuid,
          changes jsonb not null default '{}'::jsonb,
          ip_address inet,
          user_agent text,
          created_at timestamptz not null default now()
        );

        create index if not exists idx_audit_logs_actor_id on public.audit_logs (actor_id, created_at desc);
        create index if not exists idx_audit_logs_entity on public.audit_logs (entity_type, entity_id, created_at desc);
        create index if not exists idx_audit_logs_action on public.audit_logs (action, created_at desc);

        alter table public.audit_logs enable row level security;

        drop policy if exists "Admins can view all audit logs" on public.audit_logs;
        create policy "Admins can view all audit logs"
        on public.audit_logs for select
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
        drop policy if exists "Admins can view all audit logs" on public.audit_logs;
        drop index if exists public.idx_audit_logs_action;
        drop index if exists public.idx_audit_logs_entity;
        drop index if exists public.idx_audit_logs_actor_id;
        drop table if exists public.audit_logs cascade;
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
