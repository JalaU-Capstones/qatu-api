import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Sequelize } from 'sequelize';

const require = createRequire(import.meta.url);
const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../migrations'
);

/**
 * Recreates the minimal `auth` schema that Supabase owns in production but that a bare
 * PostgreSQL test container lacks. Runs BEFORE migrations because migration 003
 * (`create-profiles`) references `auth.users(id)` and later RLS migrations call `auth.uid()`.
 * See ADR-020 for the ownership rationale.
 */
async function ensureAuthSchema(sequelize) {
  await sequelize.query('create schema if not exists auth;');
  await sequelize.query(`
    create table if not exists auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb default '{}'::jsonb,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
  `);

  // Supabase-defined roles referenced by RLS policies (`to authenticated`,
  // `to anon`, `to service_role`). Recreating them lets migrations 002+ run
  // against a bare postgres image without a live Supabase CLI.
  await sequelize.query(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role nologin bypassrls;
      end if;
    end $$;
  `);

  // Supabase helper functions referenced by RLS policies. They return NULL /
  // empty values when the JWT claims are not set, which is fine because tests
  // connect as a superuser that bypasses RLS.
  await sequelize.query(`
    create or replace function auth.uid() returns uuid
    language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `);
  await sequelize.query(`
    create or replace function auth.role() returns text
    language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  `);
  await sequelize.query(`
    create or replace function auth.jwt() returns jsonb
    language sql stable
    as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
  `);
}

/**
 * Installs the `handle_new_user` trigger that Supabase owns in production (see
 * supabase/migrations/20261113120000_handle_new_user_trigger.sql). Runs AFTER migrations
 * because it writes to public.profiles and public.user_roles, which migration 003 and the
 * roles seeder create.
 *
 * Several integration tests (CreateOrderUseCase, OutboxToNotification) rely on this trigger
 * to auto-create a profile when they insert into auth.users.
 */
async function ensureHandleNewUserTrigger(sequelize) {
  await sequelize.query(`
    create or replace function public.handle_new_user()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $$
    begin
      insert into public.profiles (id, username, full_name, email)
      values (
        new.id,
        coalesce(
          new.raw_user_meta_data->>'username',
          'user_' || substr(new.id::text, 1, 8)
        ),
        new.raw_user_meta_data->>'full_name',
        new.email
      )
      on conflict (id) do nothing;

      insert into public.user_roles (profile_id, role_id)
      select new.id, r.id from public.roles r where r.name = 'buyer'
      on conflict (profile_id, role_id) do nothing;

      return new;
    end;
    $$;
  `);
  await sequelize.query(`
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  `);
}

/** Runs every real migration in order, so tests use the exact production schema. */
export async function runMigrations(sequelize) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+.*\.js$/.test(file))
    .sort();

  for (const file of files) {
    // eslint-disable-next-line security/detect-non-literal-require
    const migration = require(path.join(MIGRATIONS_DIR, file));
    try {
      await migration.up(sequelize.getQueryInterface(), Sequelize);
    } catch (err) {
      // Sequelize 6 misclassifies some PostgreSQL errors (e.g. 42704
      // "role does not exist") as UnknownConstraintError. Surface the real
      // code + message so future schema-shim gaps are diagnosable.
      console.error(
        `[migration ${file}] failed: code=${err.parent?.code ?? 'n/a'} message=${err.parent?.message ?? err.message}`
      );
      throw err;
    }
  }
}

/**
 * Throw-away migrated PostgreSQL for one test file: `<TEST_DATABASE_URL db>_<suffix>` when that
 * variable is set (CI), otherwise a Testcontainer.
 * Installs a minimal `auth` schema before migrations and the `handle_new_user`
 * trigger after — mirroring Supabase's ownership boundary (ADR-020).
 */
export async function createMigratedTestDatabase(suffix) {
  let container = null;
  let adminSequelize = null;
  let isolatedDbName = null;
  let sequelize;

  if (process.env.TEST_DATABASE_URL) {
    const baseUrl = new URL(process.env.TEST_DATABASE_URL);
    const originalDb = baseUrl.pathname.replace(/^\//, '') || 'postgres';
    isolatedDbName = `${originalDb}_${suffix}`;

    const adminUrl = new URL(process.env.TEST_DATABASE_URL);
    adminUrl.pathname = '/postgres';
    adminSequelize = new Sequelize(adminUrl.toString(), { logging: false });
    await adminSequelize.query(`drop database if exists "${isolatedDbName}" with (force);`);
    await adminSequelize.query(`create database "${isolatedDbName}";`);

    const targetUrl = new URL(process.env.TEST_DATABASE_URL);
    targetUrl.pathname = `/${isolatedDbName}`;
    sequelize = new Sequelize(targetUrl.toString(), { logging: false });
  } else {
    container = await new PostgreSqlContainer('postgres:17-alpine')
      .withDatabase('qatu_test')
      .withUsername('test')
      .withPassword('test')
      .start();
    sequelize = new Sequelize(container.getConnectionUri(), { logging: false });
  }

  await ensureAuthSchema(sequelize);
  await runMigrations(sequelize);
  await ensureHandleNewUserTrigger(sequelize);

  return {
    sequelize,
    async close() {
      await sequelize.close();
      if (adminSequelize) {
        try {
          await adminSequelize.query(`drop database if exists "${isolatedDbName}" with (force);`);
        } finally {
          await adminSequelize.close();
        }
      }
      await container?.stop();
    },
  };
}
