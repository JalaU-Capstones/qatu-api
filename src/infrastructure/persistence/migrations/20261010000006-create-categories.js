'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create table if not exists public.categories (
          id uuid primary key default gen_random_uuid(),
          name text not null,
          slug text not null unique,
          description text,
          parent_id uuid references public.categories(id) on delete set null,
          position integer not null default 0,
          is_active boolean not null default true,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          constraint categories_name_length check (char_length(name) between 2 and 80),
          constraint categories_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
        );

        create index if not exists idx_categories_parent_id on public.categories (parent_id);
        create index if not exists idx_categories_active on public.categories (is_active) where is_active = true;

        alter table public.categories enable row level security;

        drop policy if exists "Categories are publicly readable" on public.categories;
        create policy "Categories are publicly readable"
        on public.categories for select
        using (true);

        drop policy if exists "Admins can manage categories" on public.categories;
        create policy "Admins can manage categories"
        on public.categories for all
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
        drop policy if exists "Admins can manage categories" on public.categories;
        drop policy if exists "Categories are publicly readable" on public.categories;
        drop index if exists public.idx_categories_active;
        drop index if exists public.idx_categories_parent_id;
        drop table if exists public.categories cascade;
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
