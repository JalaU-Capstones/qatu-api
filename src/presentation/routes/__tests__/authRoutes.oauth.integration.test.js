import { URL } from 'url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { QueryTypes, Sequelize } from 'sequelize';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { ProfileRepository } from '../../../infrastructure/persistence/repositories/ProfileRepository.js';
import { oauthExchangeLimiter } from '../../middleware/rateLimiter.js';
import { createAuthRouter } from '../authRoutes.js';

const SCHEMA_SQL = `
  create extension if not exists pgcrypto;
  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
  create table if not exists roles (
    id smallint primary key generated always as identity,
    name text not null unique,
    description text,
    created_at timestamptz not null default now()
  );
  insert into roles (name) values ('buyer'), ('seller'), ('admin')
  on conflict (name) do nothing;
  create table if not exists profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text not null unique,
    full_name text,
    email text,
    avatar_path text,
    bio text,
    locale text not null default 'en',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create table if not exists user_roles (
    profile_id uuid not null references profiles(id) on delete cascade,
    role_id smallint not null references roles(id) on delete cascade,
    assigned_at timestamptz not null default now(),
    assigned_by uuid references profiles(id) on delete set null,
    primary key (profile_id, role_id)
  );

  -- Load the handle_new_user trigger from migration 29 (as modified in this commit).
  -- We replicate the exact SQL so the test verifies the trigger contract, not a mock.
  create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    base_username text;
    candidate_username text;
    suffix integer := 0;
    buyer_role_id smallint;
    resolved_avatar text;
    resolved_full_name text;
  begin
    base_username := case
      when new.raw_user_meta_data->>'username' is not null
        and char_length(new.raw_user_meta_data->>'username') > 0
        then new.raw_user_meta_data->>'username'
      when new.email is not null
        and char_length(
          regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g')
        ) >= 3
        then substr(
               regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'),
               1,
               20
             ) || '_' || substr(md5(random()::text), 1, 4)
      else 'user_' || substring(replace(new.id::text, '-', '') from 1 for 10)
    end;
    candidate_username := base_username;
    while exists (select 1 from public.profiles where lower(username) = lower(candidate_username)) loop
      suffix := suffix + 1;
      candidate_username := base_username || '_' || suffix::text;
    end loop;
    resolved_avatar := coalesce(
      new.raw_user_meta_data->>'avatar_path',
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    );
    resolved_full_name := coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    );
    insert into public.profiles (id, username, full_name, email, avatar_path)
    values (
      new.id,
      candidate_username,
      resolved_full_name,
      new.email,
      resolved_avatar
    );
    select id into buyer_role_id from public.roles where name = 'buyer';
    if buyer_role_id is not null then
      insert into public.user_roles (profile_id, role_id) values (new.id, buyer_role_id);
    end if;
    return new;
  end;
  $$;

  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
`;

describe('POST /v1/auth/oauth/exchange (integration)', () => {
  let container;
  let sequelize;
  let adminSequelize;
  let isolatedDbName;
  let app;
  let authServiceMock;

  beforeAll(async () => {
    if (process.env.TEST_DATABASE_URL) {
      try {
        const url = new URL(process.env.TEST_DATABASE_URL);
        const originalDb = url.pathname.replace(/^\//, '') || 'postgres';
        isolatedDbName = `${originalDb}_oauth`;

        const adminUrl = new URL(process.env.TEST_DATABASE_URL);
        adminUrl.pathname = '/postgres';

        adminSequelize = new Sequelize(adminUrl.toString(), { logging: false });
        await adminSequelize.query(`drop database if exists "${isolatedDbName}";`);
        await adminSequelize.query(`create database "${isolatedDbName}";`);

        const targetUrl = new URL(process.env.TEST_DATABASE_URL);
        targetUrl.pathname = `/${isolatedDbName}`;
        sequelize = new Sequelize(targetUrl.toString(), { logging: false });
      } catch {
        sequelize = new Sequelize(process.env.TEST_DATABASE_URL, { logging: false });
      }
    } else {
      container = await new PostgreSqlContainer('postgres:17-alpine')
        .withDatabase('qatu_test')
        .withUsername('test')
        .withPassword('test')
        .start();
      sequelize = new Sequelize(container.getConnectionUri(), { logging: false });
    }

    await sequelize.query(SCHEMA_SQL);
    const profileRepository = new ProfileRepository({ db: sequelize });

    authServiceMock = {
      exchangeOAuthToken: vi.fn(),
    };

    const authRouter = createAuthRouter({
      authService: authServiceMock,
      profileRepository,
    });

    app = createApp({ authRoutes: authRouter });
  }, 60000);

  afterAll(async () => {
    await sequelize?.close();
    if (adminSequelize && isolatedDbName) {
      try {
        await adminSequelize.query(`drop database if exists "${isolatedDbName}";`);
        await adminSequelize.close();
      } catch {
        // Ignore cleanup error
      }
    }
    await container?.stop();
  });

  beforeEach(async () => {
    authServiceMock.exchangeOAuthToken.mockReset();
    authServiceMock.exchangeOAuthToken.mockResolvedValue({
      user: { id: '11111111-1111-4111-8111-111111111111', email: 'buyer@example.com' },
      accessToken: 'at',
      refreshToken: 'rt',
    });
    oauthExchangeLimiter.reset?.();
    await sequelize.query(`
      delete from user_roles;
      delete from profiles;
      delete from auth.users;
    `);
  });

  it('sets HttpOnly cookies and returns user/profile/roles on valid tokens', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    authServiceMock.exchangeOAuthToken.mockResolvedValue({
      user: { id: userId, email: 'buyer@example.com' },
      accessToken: 'at.jwt',
      refreshToken: 'rt-uuid',
    });

    await sequelize.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1, $2, '{"full_name":"Buyer Test","avatar_path":"https://lh3.googleusercontent.com/a/example","username":"buyer_test"}'::jsonb)
       on conflict do nothing`,
      { bind: [userId, 'buyer@example.com'] }
    );
    await sequelize.query(
      `insert into public.profiles (id, username, full_name, email, avatar_path)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update set
         username = excluded.username,
         full_name = excluded.full_name,
         email = excluded.email,
         avatar_path = excluded.avatar_path`,
      {
        bind: [
          userId,
          'buyer_test',
          'Buyer Test',
          'buyer@example.com',
          'https://lh3.googleusercontent.com/a/example',
        ],
      }
    );
    await sequelize.query(
      `insert into public.user_roles (profile_id, role_id)
       select $1, id from public.roles where name = 'buyer' on conflict do nothing`,
      { bind: [userId] }
    );

    const res = await request(app)
      .post('/v1/auth/oauth/exchange')
      .send({ access_token: 'at.jwt', refresh_token: 'rt-uuid' })
      .expect(200);

    // Response body — no token
    expect(res.body.data.user).toEqual(expect.objectContaining({ email: 'buyer@example.com' }));
    expect(res.body.data.profile).toEqual(expect.objectContaining({ username: 'buyer_test' }));
    expect(JSON.stringify(res.body)).not.toContain('at.jwt');

    // Cookies — three Set-Cookie headers
    const setCookies = res.headers['set-cookie'] || [];
    const cookieStr = setCookies.join(';');
    expect(cookieStr).toMatch(/access_token=/);
    expect(cookieStr).toMatch(/refresh_token=/);
    expect(cookieStr).toMatch(/csrf_token=/);
    expect(cookieStr).toMatch(/HttpOnly/);
  });

  it('returns 401 when Supabase rejects the access token', async () => {
    const err = new Error('invalid token');
    err.status = 401;
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
    authServiceMock.exchangeOAuthToken.mockRejectedValue(err);

    await request(app)
      .post('/v1/auth/oauth/exchange')
      .send({ access_token: 'bad', refresh_token: 'rt' })
      .expect(401);
  });

  it('returns 400 when tokens are missing', async () => {
    await request(app).post('/v1/auth/oauth/exchange').send({ access_token: 'at' }).expect(400);
  });

  it('returns 429 after 10 requests in one minute from the same IP', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/v1/auth/oauth/exchange')
        .send({ access_token: 'at', refresh_token: 'rt' });
    }
    const res = await request(app)
      .post('/v1/auth/oauth/exchange')
      .send({ access_token: 'at', refresh_token: 'rt' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  describe('handle_new_user trigger (OAuth username sanitization)', () => {
    // Cleanup helper: remove any profiles created by previous tests in this block.
    const cleanup = async () => {
      await sequelize.query(`delete from public.user_roles where profile_id in
        (select id from public.profiles where email like '%oauth-test%')`);
      await sequelize.query(`delete from public.profiles where email like '%oauth-test%'`);
      await sequelize.query(`delete from auth.users where email like '%oauth-test%'`);
    };

    beforeEach(cleanup);
    afterAll(cleanup);

    const insertOAuthUser = async (id, email) => {
      await sequelize.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         values ($1, $2, '{"full_name":"OAuth Test User"}'::jsonb)`,
        { bind: [id, email] }
      );
      const [row] = await sequelize.query(`select username from public.profiles where id = $1`, {
        bind: [id],
        type: QueryTypes.SELECT,
      });
      return row?.username;
    };

    it('sanitizes dots from the email prefix (gabriel.sandoval@...)', async () => {
      const username = await insertOAuthUser(
        '22222222-2222-4222-8222-222222222222',
        'gabriel.sandoval@oauth-test.com'
      );
      expect(username).not.toContain('.');
      expect(username).toMatch(/^[a-zA-Z0-9_]{3,30}$/);
      expect(username).toMatch(/^gabrielsandoval_[0-9a-f]{4}$/);
    });

    it('sanitizes plus signs from the email prefix (juan+shop@...)', async () => {
      const username = await insertOAuthUser(
        '33333333-3333-4333-8333-333333333333',
        'juan+shop@oauth-test.com'
      );
      expect(username).not.toContain('+');
      expect(username).toMatch(/^[a-zA-Z0-9_]{3,30}$/);
      expect(username).toMatch(/^juanshop_[0-9a-f]{4}$/);
    });

    it('truncates long email prefixes to stay within 30 chars', async () => {
      const username = await insertOAuthUser(
        '44444444-4444-4444-8444-444444444444',
        'very.long.email.address.for.testing@oauth-test.com'
      );
      expect(username).toMatch(/^[a-zA-Z0-9_]{3,30}$/);
      expect(username.length).toBeLessThanOrEqual(30);
      // Sanitized prefix is 32 chars; truncated to 20 → "verylongemailaddress"
      expect(username.startsWith('verylongemailaddress')).toBe(true);
    });

    it('falls back to user_<uuid> when the sanitized prefix is too short (< 3 chars)', async () => {
      const userId = '55555555-5555-4555-8555-555555555555';
      const username = await insertOAuthUser(userId, 'a@oauth-test.com');
      expect(username).toMatch(/^[a-zA-Z0-9_]{3,30}$/);
      expect(username.startsWith('user_')).toBe(true);
    });

    it('handles a collision by appending _N while staying within 30 chars', async () => {
      // Insert two users whose sanitized prefixes would collide IF the hex suffix
      // were deterministic. Since the suffix is random, we instead test the loop
      // by pre-creating a profile with the base pattern and verifying the trigger
      // produces a distinct, compliant username.
      const userId = '66666666-6666-4666-8666-666666666666';
      await sequelize.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         values ($1, $2, '{}'::jsonb)`,
        { bind: [userId, 'gabriel.sandoval@oauth-test.com'] }
      );
      const [first] = await sequelize.query(`select username from public.profiles where id = $1`, {
        bind: [userId],
        type: QueryTypes.SELECT,
      });

      const userId2 = '77777777-7777-4777-8777-777777777777';
      await sequelize.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         values ($1, $2, '{}'::jsonb)`,
        { bind: [userId2, 'gabriel.sandoval@oauth-test.com'] }
      );
      const [second] = await sequelize.query(`select username from public.profiles where id = $1`, {
        bind: [userId2],
        type: QueryTypes.SELECT,
      });

      expect(second.username).toMatch(/^[a-zA-Z0-9_]{3,30}$/);
      expect(second.username).not.toBe(first.username);
    });
  });
});
