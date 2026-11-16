-- TESTCONTAINERS ONLY. Applied by migratedTestDatabase.js after
-- sequelize-cli db:migrate. Never applied in Modo A (Supabase CLI) or
-- production (both have the real Supabase auth schema).
--
-- ADR-020: the Sequelize migration shim for `auth` was retired. This file
-- provides the minimal surface needed by migrations 003+ and RLS policies
-- when running against a bare postgres container.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create or replace function auth.jwt() returns jsonb
  language sql stable
  as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;

create or replace function auth.role() returns text
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
