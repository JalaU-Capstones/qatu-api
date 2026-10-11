'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create table if not exists public.profiles (
          id uuid primary key references auth.users(id) on delete cascade,
          username text not null unique,
          full_name text,
          email text,
          avatar_path text,
          bio text,
          locale text not null default 'en',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          constraint profiles_username_format check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
          constraint profiles_bio_length check (char_length(bio) <= 500)
        );

        create unique index if not exists idx_profiles_username on public.profiles (lower(username));
        create index if not exists idx_profiles_email on public.profiles (lower(email));

        alter table public.profiles enable row level security;

        drop policy if exists "Profiles are publicly readable" on public.profiles;
        create policy "Profiles are publicly readable"
        on public.profiles for select
        using (true);

        drop policy if exists "Users can update own profile" on public.profiles;
        create policy "Users can update own profile"
        on public.profiles for update
        to authenticated
        using ((select auth.uid()) = id)
        with check ((select auth.uid()) = id);
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
        drop policy if exists "Users can update own profile" on public.profiles;
        drop policy if exists "Profiles are publicly readable" on public.profiles;
        drop index if exists public.idx_profiles_email;
        drop index if exists public.idx_profiles_username;
        drop table if exists public.profiles cascade;
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
