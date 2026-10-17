import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Profile } from '../../../../domain/entities/Profile.js';
import { ProfileRepository } from '../ProfileRepository.js';

const SCHEMA_SQL = `
  create extension if not exists pgcrypto;
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
  create table roles (
    id smallint primary key generated always as identity,
    name text not null unique,
    description text,
    created_at timestamptz not null default now()
  );
  insert into roles (name) values ('buyer'), ('seller'), ('admin')
  on conflict (name) do nothing;
  create table profiles (
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
  create table user_roles (
    profile_id uuid not null references profiles(id) on delete cascade,
    role_id smallint not null references roles(id) on delete cascade,
    assigned_at timestamptz not null default now(),
    assigned_by uuid references profiles(id) on delete set null,
    primary key (profile_id, role_id)
  );
`;

const CLEAN_SQL = `
  delete from user_roles;
  delete from profiles;
  delete from auth.users;
`;

describe('ProfileRepository (integration)', () => {
  let container; // null in CI mode
  let sequelize;
  let repository;

  beforeAll(async () => {
    if (process.env.TEST_DATABASE_URL) {
      // CI mode: external PostgreSQL service container
      sequelize = new Sequelize(process.env.TEST_DATABASE_URL, { logging: false });
    } else {
      // Local mode: Testcontainers
      container = await new PostgreSqlContainer('postgres:17-alpine')
        .withDatabase('qatu_test')
        .withUsername('test')
        .withPassword('test')
        .start();
      sequelize = new Sequelize(container.getConnectionUri(), { logging: false });
    }

    await sequelize.query(SCHEMA_SQL);
    repository = new ProfileRepository({ db: sequelize });
  }, 60000);

  afterAll(async () => {
    await sequelize?.close();
    await container?.stop();
  });

  beforeEach(async () => {
    await sequelize.query(CLEAN_SQL);
  });

  it('findById returns profile with assigned roles using ur.assigned_at', async () => {
    const userId = '00000000-0000-0000-0000-000000000099';

    await sequelize.query(`insert into auth.users (id, email) values (:id, 'it@example.com')`, {
      replacements: { id: userId },
    });

    const profile = new Profile({
      id: userId,
      username: 'it_user',
      fullName: 'IT User',
      email: 'it@example.com',
    });

    await repository.create(profile);

    const found = await repository.findById(userId);

    expect(found).toBeInstanceOf(Profile);
    expect(found.id).toBe(userId);
    expect(found.username).toBe('it_user');
    expect(found.roles).toHaveLength(1);
    expect(found.roles[0].name).toBe('buyer');
    expect(found.roles[0].created_at).toEqual(expect.any(String));
  });
});
