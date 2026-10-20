import { URL } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Product } from '../../../../domain/entities/Product.js';
import { ProductRepository } from '../ProductRepository.js';

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
  create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    seller_id uuid not null references public.profiles(id) on delete cascade,
    category_id uuid references public.categories(id) on delete set null,
    name text not null,
    slug text not null,
    description text,
    price numeric(12, 2) not null check (price >= 0),
    currency text not null default 'USD',
    stock integer not null default 0 check (stock >= 0),
    attributes jsonb not null default '{}'::jsonb,
    primary_image_path text,
    state text not null default 'draft'
      check (state in ('draft', 'published', 'unpublished', 'archived')),
    average_rating numeric(3, 2) not null default 0 check (average_rating between 0 and 5),
    ratings_count integer not null default 0 check (ratings_count >= 0),
    published_at timestamptz,
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    search_vector tsvector generated always as (
      setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(description, '')), 'B')
    ) stored,
    constraint products_published_state check (
      (state = 'published' and published_at is not null) or state <> 'published'
    ),
    unique (seller_id, slug)
  );
  create index if not exists idx_products_search on public.products using gin (search_vector);
`;

const CLEAN_SQL = `
  delete from public.products;
  delete from public.categories;
  delete from public.user_roles;
  delete from public.profiles;
  delete from auth.users;
`;

const SELLER_1_ID = '11111111-1111-1111-1111-111111111111';
const SELLER_2_ID = '22222222-2222-2222-2222-222222222222';
const CATEGORY_1_ID = '33333333-3333-3333-3333-333333333331';
const CATEGORY_2_ID = '33333333-3333-3333-3333-333333333332';
const PRODUCT_1_ID = '44444444-4444-4444-4444-444444444441';
const PRODUCT_2_ID = '44444444-4444-4444-4444-444444444442';
const PRODUCT_3_ID = '44444444-4444-4444-4444-444444444443';
const PRODUCT_4_DRAFT_ID = '44444444-4444-4444-4444-444444444444';
const PRODUCT_5_DELETED_ID = '44444444-4444-4444-4444-444444444445';

describe('ProductRepository (integration)', () => {
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
        isolatedDbName = `${originalDb}_products`;

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
    repository = new ProductRepository({ db: sequelize });
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
      insert into auth.users (id, email) values
        ('${SELLER_1_ID}', 'seller1@example.com'),
        ('${SELLER_2_ID}', 'seller2@example.com');

      insert into profiles (id, username, full_name, email) values
        ('${SELLER_1_ID}', 'seller_one', 'Seller One', 'seller1@example.com'),
        ('${SELLER_2_ID}', 'seller_two', 'Seller Two', 'seller2@example.com');

      insert into user_roles (profile_id, role_id)
      select p.id, r.id from profiles p cross join roles r where r.name = 'seller';

      insert into categories (id, name, slug) values
        ('${CATEGORY_1_ID}', 'Electronics', 'electronics'),
        ('${CATEGORY_2_ID}', 'Books', 'books');

      insert into products (
        id, seller_id, category_id, name, slug, description, price, currency,
        stock, attributes, primary_image_path, state, average_rating, ratings_count,
        published_at, deleted_at, created_at, updated_at
      ) values
        (
          '${PRODUCT_1_ID}', '${SELLER_1_ID}', '${CATEGORY_1_ID}',
          'Wireless Bluetooth Headphones', 'wireless-bluetooth-headphones',
          'Noise cancelling over-ear wireless headphones with deep bass',
          99.99, 'USD', 15, '{"color": "black", "bluetooth": "5.3"}'::jsonb,
          'product-images/headphones.webp', 'published', 4.50, 10,
          '2026-10-01T10:00:00.000Z', null, '2026-10-01T10:00:00.000Z', '2026-10-01T10:00:00.000Z'
        ),
        (
          '${PRODUCT_2_ID}', '${SELLER_1_ID}', '${CATEGORY_2_ID}',
          'Node.js Architecture Book', 'nodejs-architecture-book',
          'Mastering clean architecture and enterprise patterns in Node.js',
          49.99, 'USD', 30, '{"format": "paperback", "pages": 350}'::jsonb,
          'product-images/book.webp', 'published', 5.00, 20,
          '2026-10-02T10:00:00.000Z', null, '2026-10-02T10:00:00.000Z', '2026-10-02T10:00:00.000Z'
        ),
        (
          '${PRODUCT_3_ID}', '${SELLER_2_ID}', '${CATEGORY_1_ID}',
          'Mechanical Gaming Keyboard', 'mechanical-gaming-keyboard',
          'RGB backlit mechanical keyboard with tactile blue switches',
          149.99, 'USD', 5, '{"switch": "blue", "rgb": true}'::jsonb,
          'product-images/keyboard.webp', 'published', 4.00, 8,
          '2026-10-03T10:00:00.000Z', null, '2026-10-03T10:00:00.000Z', '2026-10-03T10:00:00.000Z'
        ),
        (
          '${PRODUCT_4_DRAFT_ID}', '${SELLER_1_ID}', '${CATEGORY_1_ID}',
          'Ergonomic Standing Desk Draft', 'ergonomic-standing-desk-draft',
          'Electric motorized height adjustable standing desk frame',
          299.99, 'USD', 2, '{}'::jsonb,
          null, 'draft', 0.00, 0,
          null, null, '2026-10-04T10:00:00.000Z', '2026-10-04T10:00:00.000Z'
        ),
        (
          '${PRODUCT_5_DELETED_ID}', '${SELLER_1_ID}', '${CATEGORY_1_ID}',
          'Old Discontinued Webcam Deleted', 'old-discontinued-webcam-deleted',
          'Standard 720p usb webcam legacy hardware',
          19.99, 'USD', 0, '{}'::jsonb,
          null, 'published', 3.50, 4,
          '2026-09-15T10:00:00.000Z', '2026-10-05T10:00:00.000Z', '2026-09-15T10:00:00.000Z', '2026-10-05T10:00:00.000Z'
        );
    `);
  });

  it('returns only published, non-deleted products', async () => {
    const { items, total } = await repository.findAll({ page: 1, limit: 10 });

    expect(total).toBe(3);
    expect(items).toHaveLength(3);

    const ids = items.map((p) => p.id);
    expect(ids).toContain(PRODUCT_1_ID);
    expect(ids).toContain(PRODUCT_2_ID);
    expect(ids).toContain(PRODUCT_3_ID);
    expect(ids).not.toContain(PRODUCT_4_DRAFT_ID);
    expect(ids).not.toContain(PRODUCT_5_DELETED_ID);

    for (const item of items) {
      expect(item).toBeInstanceOf(Product);
      expect(item.state).toBe('published');
    }
  });

  it('paginates with page=1, limit=2 returning 2 items and accurate total count', async () => {
    const { items, total } = await repository.findAll({ page: 1, limit: 2 });

    expect(items).toHaveLength(2);
    expect(total).toBe(3);
  });

  it('paginates with page=2 returning the next slice', async () => {
    const page1 = await repository.findAll({ page: 1, limit: 2 });
    const page2 = await repository.findAll({ page: 2, limit: 2 });

    expect(page2.items).toHaveLength(1);
    expect(page2.total).toBe(3);

    const page1Ids = page1.items.map((p) => p.id);
    const page2Ids = page2.items.map((p) => p.id);
    expect(page1Ids).not.toContain(page2Ids[0]);
  });

  it('provides accurate total count with COUNT(*) OVER() regardless of page', async () => {
    const resultPage1 = await repository.findAll({ page: 1, limit: 1 });
    const resultPage2 = await repository.findAll({ page: 2, limit: 1 });
    const resultPage3 = await repository.findAll({ page: 3, limit: 1 });

    expect(resultPage1.total).toBe(3);
    expect(resultPage2.total).toBe(3);
    expect(resultPage3.total).toBe(3);
  });

  it('filters by search using plainto_tsquery on name and description', async () => {
    const nameMatch = await repository.findAll({
      filters: { search: 'Headphones' },
    });
    expect(nameMatch.total).toBe(1);
    expect(nameMatch.items[0].id).toBe(PRODUCT_1_ID);

    const descMatch = await repository.findAll({
      filters: { search: 'clean architecture' },
    });
    expect(descMatch.total).toBe(1);
    expect(descMatch.items[0].id).toBe(PRODUCT_2_ID);
  });

  it('filters by category_id', async () => {
    const result = await repository.findAll({
      filters: { categoryId: CATEGORY_1_ID },
    });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    for (const item of result.items) {
      expect(item.category_id).toBe(CATEGORY_1_ID);
    }
  });

  it('filters by price range (min_price and max_price)', async () => {
    const result = await repository.findAll({
      filters: { minPrice: 60, maxPrice: 160 },
    });

    expect(result.total).toBe(2);
    const prices = result.items.map((p) => p.price);
    expect(prices).toContain(99.99);
    expect(prices).toContain(149.99);
    expect(prices).not.toContain(49.99);
  });

  it('filters by seller_id', async () => {
    const result = await repository.findAll({
      filters: { sellerId: SELLER_2_ID },
    });

    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe(PRODUCT_3_ID);
    expect(result.items[0].seller_id).toBe(SELLER_2_ID);
  });

  it('sorts by price ASC and price DESC', async () => {
    const ascResult = await repository.findAll({
      sort: { field: 'price', order: 'asc' },
    });
    expect(ascResult.items.map((p) => p.price)).toEqual([49.99, 99.99, 149.99]);

    const descResult = await repository.findAll({
      sort: { field: 'price', order: 'desc' },
    });
    expect(descResult.items.map((p) => p.price)).toEqual([149.99, 99.99, 49.99]);
  });

  it('falls back to created_at DESC on unsupported sort field', async () => {
    const result = await repository.findAll({
      sort: { field: 'unsupported_field', order: 'asc' },
    });

    // Seed dates: Product 3: 2026-10-03, Product 2: 2026-10-02, Product 1: 2026-10-01
    expect(result.items.map((p) => p.id)).toEqual([PRODUCT_3_ID, PRODUCT_2_ID, PRODUCT_1_ID]);
  });

  it('returns { items: [], total: 0 } for empty catalog or non-matching query', async () => {
    const result = await repository.findAll({
      filters: { search: 'NonExistentProductKeyword123XYZ' },
    });

    expect(result).toEqual({ items: [], total: 0 });
  });
});
