'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create table if not exists public.roles (
          id smallint primary key generated always as identity,
          name text not null unique,
          description text,
          created_at timestamptz not null default now(),
          constraint roles_name_check check (name in ('buyer', 'seller', 'admin'))
        );

        insert into public.roles (name, description)
        values
          ('buyer', 'Default role for all registered users. Can browse products and make purchases.'),
          ('seller', 'Approved merchant who can list and sell products on the platform.'),
          ('admin', 'Platform administrator with full management and moderation access.')
        on conflict (name) do nothing;

        alter table public.roles enable row level security;

        drop policy if exists "Roles are readable by authenticated users" on public.roles;
        create policy "Roles are readable by authenticated users"
        on public.roles for select
        to authenticated
        using (true);
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
        drop policy if exists "Roles are readable by authenticated users" on public.roles;
        drop table if exists public.roles cascade;
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
