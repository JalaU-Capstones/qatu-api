'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create table if not exists public.user_roles (
          profile_id uuid not null references public.profiles(id) on delete cascade,
          role_id smallint not null references public.roles(id) on delete cascade,
          assigned_at timestamptz not null default now(),
          assigned_by uuid references public.profiles(id) on delete set null,
          primary key (profile_id, role_id)
        );

        create index if not exists idx_user_roles_role_id on public.user_roles (role_id);

        alter table public.user_roles enable row level security;

        drop policy if exists "Users can read own roles" on public.user_roles;
        create policy "Users can read own roles"
        on public.user_roles for select
        to authenticated
        using (profile_id = (select auth.uid()));

        drop policy if exists "Admins can read all user_roles" on public.user_roles;
        create policy "Admins can read all user_roles"
        on public.user_roles for select
        to authenticated
        using (
          exists (
            select 1 from public.user_roles ur
            join public.roles r on r.id = ur.role_id
            where ur.profile_id = (select auth.uid()) and r.name = 'admin'
          )
        );

        drop policy if exists "Admins can manage user_roles" on public.user_roles;
        create policy "Admins can manage user_roles"
        on public.user_roles for all
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

        drop policy if exists "Admins can manage roles" on public.roles;
        create policy "Admins can manage roles"
        on public.roles for all
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
        drop policy if exists "Admins can manage roles" on public.roles;
        drop policy if exists "Admins can manage user_roles" on public.user_roles;
        drop policy if exists "Admins can read all user_roles" on public.user_roles;
        drop policy if exists "Users can read own roles" on public.user_roles;
        drop index if exists public.idx_user_roles_role_id;
        drop table if exists public.user_roles cascade;
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
