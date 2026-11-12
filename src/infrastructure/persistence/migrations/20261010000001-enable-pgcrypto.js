'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        create extension if not exists pgcrypto;

        do $$
        begin
          if not exists (select 1 from pg_roles where rolname = 'authenticated') then
            create role authenticated nologin;
          end if;
          if not exists (select 1 from pg_roles where rolname = 'anon') then
            create role anon nologin;
          end if;
        end $$;

        do $$
        begin
          if not exists (select 1 from information_schema.schemata where schema_name = 'auth') then
            execute 'create schema auth';
          end if;
        end $$;

        do $$
        begin
          if not exists (
            select 1 from information_schema.tables 
            where table_schema = 'auth' and table_name = 'users'
          ) then
            execute '
              create table auth.users (
                id uuid primary key default gen_random_uuid(),
                email text,
                raw_user_meta_data jsonb default ''{}''::jsonb,
                created_at timestamptz default now(),
                updated_at timestamptz default now()
              )
            ';
          end if;
        end $$;

        do $$
        begin
          if not exists (
            select 1 from pg_proc p 
            join pg_namespace n on n.oid = p.pronamespace 
            where n.nspname = 'auth' and p.proname = 'uid'
          ) then
            execute '
              create or replace function auth.uid()
              returns uuid
              language sql
              stable
              as $func$
                select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid;
              $func$;
            ';
          end if;
        end $$;
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
        drop function if exists auth.uid();
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
