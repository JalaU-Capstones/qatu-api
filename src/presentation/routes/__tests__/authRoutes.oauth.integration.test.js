import { URL } from 'url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Sequelize } from 'sequelize';
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
      `insert into auth.users (id, email) values ($1, $2) on conflict do nothing`,
      { bind: [userId, 'buyer@example.com'] }
    );
    await sequelize.query(
      `insert into public.profiles (id, username, full_name, email, avatar_path)
       values ($1, $2, $3, $4, $5) on conflict do nothing`,
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
});
