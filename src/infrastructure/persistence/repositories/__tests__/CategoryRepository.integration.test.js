import { URL } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Sequelize } from 'sequelize';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../../app.js';
import { Category } from '../../../../domain/entities/Category.js';
import { createCategoryRouter } from '../../../../presentation/routes/categoryRoutes.js';
import { CategoryRepository } from '../CategoryRepository.js';

const SCHEMA_SQL = `
  create extension if not exists pgcrypto;
  create table if not exists public.categories (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    description text,
    parent_id uuid references public.categories(id) on delete set null,
    position integer not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
`;

const CLEAN_SQL = 'delete from public.categories;';

describe('CategoryRepository (integration)', () => {
  let container;
  let sequelize;
  let adminSequelize;
  let isolatedDbName;
  let repository;

  beforeAll(async () => {
    if (process.env.TEST_DATABASE_URL) {
      try {
        const url = new URL(process.env.TEST_DATABASE_URL);
        const originalDb = url.pathname.replace(/^\//, '') || 'postgres';
        isolatedDbName = `${originalDb}_categories`;

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
    repository = new CategoryRepository({ db: sequelize });
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
    await sequelize.query(CLEAN_SQL);
    await sequelize.query(`
      insert into public.categories (name, slug, position, is_active) values
        ('Sports', 'sports', 4, true),
        ('Electronics', 'electronics', 1, true),
        ('Books', 'books', 5, true),
        ('Clothing', 'clothing', 2, true),
        ('Legacy', 'legacy', 0, false);
    `);
  });

  it('returns only active categories ordered by position', async () => {
    const { items, total } = await repository.findAll({ page: 1, limit: 20 });

    expect(total).toBe(4);
    expect(items.map((c) => c.slug)).toEqual(['electronics', 'clothing', 'sports', 'books']);
    for (const item of items) {
      expect(item).toBeInstanceOf(Category);
      expect(item.is_active).toBe(true);
    }
  });

  it('breaks position ties by name', async () => {
    await sequelize.query(`
      insert into public.categories (name, slug, position) values
        ('Zebra', 'zebra', 1),
        ('Alpha', 'alpha', 1);
    `);

    const { items } = await repository.findAll({ page: 1, limit: 3 });

    expect(items.map((c) => c.slug)).toEqual(['alpha', 'electronics', 'zebra']);
  });

  it('paginates and keeps the total for every page, including out-of-range ones', async () => {
    const page1 = await repository.findAll({ page: 1, limit: 3 });
    const page2 = await repository.findAll({ page: 2, limit: 3 });
    const page9 = await repository.findAll({ page: 9, limit: 3 });

    expect(page1.items).toHaveLength(3);
    expect(page2.items).toHaveLength(1);
    expect(page9.items).toHaveLength(0);
    expect([page1.total, page2.total, page9.total]).toEqual([4, 4, 4]);
  });

  it('returns an empty result when there are no active categories', async () => {
    await sequelize.query(CLEAN_SQL);

    expect(await repository.findAll()).toEqual({ items: [], total: 0 });
  });

  it('serves GET /v1/categories through the full HTTP stack', async () => {
    const app = createApp({
      categoryRoutes: createCategoryRouter({ categoryRepository: repository }),
    });

    const response = await request(app).get('/v1/categories');

    expect(response.status).toBe(200);
    expect(response.body.data.map((c) => c.name)).toEqual([
      'Electronics',
      'Clothing',
      'Sports',
      'Books',
    ]);
    expect(response.body.data[0]).toEqual(
      expect.objectContaining({
        slug: 'electronics',
        parent_id: null,
        is_active: true,
        created_at: expect.any(String),
      })
    );
    expect(response.body.meta).toEqual({ page: 1, per_page: 20, total: 4, total_pages: 1 });
  });
});
