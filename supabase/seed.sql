-- ─────────────────────────────────────────────────────────────────────────────
-- Qatu Marketplace — Supabase Auth seed (ADR-020 / SP-19)
--
-- This file seeds the auth.users rows required by the Sequelize seeders
-- (20261010000025-seed-admin-user.js and 20261010000026-seed-sample-products.js).
-- It runs during `npx supabase db reset` (via config.toml [db.seed].sql_paths).
--
-- These are DEVELOPMENT fixtures. Passwords are documented in
-- .docs/TEST-SELLER-SETUP.md. Do not use these credentials in any environment
-- where data is not disposable.
--
-- Idempotent: uses ON CONFLICT (id) DO UPDATE so re-running is safe.
--
-- The public.profiles and public.user_roles rows for these users are created
-- by the Sequelize seeders AFTER `pnpm db:migrate` creates public.profiles.
-- The handle_new_user trigger is a no-op here because public.profiles does
-- not exist yet when this file runs (defensive guard in the trigger).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Admin user (id ...0001) ──────────────────────────────────────────────────
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'authenticated',
  'authenticated',
  'admin@example.qatu.pe',
  crypt('Admin123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"admin","full_name":"Admin User"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
)
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

-- ── Seller user (id ...0002) ─────────────────────────────────────────────────
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'authenticated',
  'authenticated',
  'seller@example.qatu.pe',
  crypt('Seller123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"sample_seller","full_name":"Sample Seller"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
)
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();
