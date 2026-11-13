import { QueryTypes } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMigratedTestDatabase } from '../../../infrastructure/persistence/__tests__/helpers/migratedTestDatabase.js';
import { ProductRepository } from '../../../infrastructure/persistence/repositories/ProductRepository.js';
import { CreateProductUseCase } from '../CreateProductUseCase.js';

const SELLER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_CATEGORY_ID = '22222222-2222-4222-8222-222222222222';

describe('CreateProductUseCase (integration, real PostgreSQL)', { timeout: 30_000 }, () => {
  let database;
  let sequelize;
  let useCase;

  const runQuery = (sql, replacements = {}) =>
    sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

  const countProducts = async () =>
    Number((await runQuery('select count(*) as n from public.products'))[0].n);

  const request = (overrides = {}) => ({
    sellerId: SELLER,
    categoryId: CATEGORY_ID,
    name: 'Clean Code',
    description: 'A timeless classic',
    price: 19.99,
    currency: 'USD',
    stock: 10,
    attributes: { color: 'black' },
    ...overrides,
  });

  const buildUseCase = () =>
    new CreateProductUseCase({ productRepository: new ProductRepository({ db: sequelize }) });

  beforeAll(async () => {
    database = await createMigratedTestDatabase('create_product');
    ({ sequelize } = database);
    useCase = buildUseCase();
  }, 120_000);

  afterAll(async () => {
    await database?.close();
  });

  beforeEach(async () => {
    await sequelize.query('delete from public.products;');
    await sequelize.query('delete from public.categories;');
    await sequelize.query('delete from public.user_roles;');
    await sequelize.query('delete from public.profiles;');
    await sequelize.query('delete from auth.users;');

    await sequelize.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values (:id, :email, :metadata)`,
      {
        replacements: {
          id: SELLER,
          email: 'seller@example.com',
          metadata: JSON.stringify({ username: 'seller_one' }),
        },
      }
    );

    await sequelize.query(
      `insert into public.user_roles (profile_id, role_id)
       select :sellerId, r.id from public.roles r where r.name = 'seller'`,
      { replacements: { sellerId: SELLER } }
    );

    await sequelize.query(
      `insert into public.categories (id, name, slug)
       values (:id, :name, :slug)`,
      {
        replacements: {
          id: CATEGORY_ID,
          name: 'Electronics',
          slug: 'electronics',
        },
      }
    );

    useCase = buildUseCase();
  });

  it('creates a draft product with an auto-generated slug', async () => {
    const result = await useCase.execute(request({ name: 'Clean Code' }));

    expect(result.data.slug).toBe('clean-code');
    expect(result.meta.timestamp).toEqual(expect.any(String));

    const rows = await runQuery(
      `select slug, state, seller_id, published_at, primary_image_path
       from public.products where seller_id = :sellerId`,
      { sellerId: SELLER }
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      slug: 'clean-code',
      state: 'draft',
      seller_id: SELLER,
      published_at: null,
      primary_image_path: null,
    });
  });

  it('creates a draft product with a client-provided slug', async () => {
    const result = await useCase.execute(request({ slug: 'my-product' }));

    expect(result.data.slug).toBe('my-product');

    const [row] = await runQuery('select slug from public.products where seller_id = :sellerId', {
      sellerId: SELLER,
    });

    expect(row.slug).toBe('my-product');
  });

  it('throws SLUG_ALREADY_EXISTS when the seller already owns that slug', async () => {
    await sequelize.query(
      `insert into public.products (seller_id, category_id, name, slug, description, price, currency, stock, attributes, state)
       values (:sellerId, :categoryId, :name, :slug, :description, :price, :currency, :stock, :attributes::jsonb, 'draft')`,
      {
        replacements: {
          sellerId: SELLER,
          categoryId: CATEGORY_ID,
          name: 'Existing Product',
          slug: 'my-product',
          description: 'existing',
          price: 10,
          currency: 'USD',
          stock: 1,
          attributes: JSON.stringify({ color: 'blue' }),
        },
      }
    );

    await expect(useCase.execute(request({ slug: 'my-product' }))).rejects.toMatchObject({
      code: 'SLUG_ALREADY_EXISTS',
      statusCode: 409,
      message: 'Slug already exists',
    });

    expect(await countProducts()).toBe(1);
  });

  it('retries with -2 when the auto-generated slug collides', async () => {
    await sequelize.query(
      `insert into public.products (seller_id, category_id, name, slug, description, price, currency, stock, attributes, state)
       values (:sellerId, :categoryId, :name, :slug, :description, :price, :currency, :stock, :attributes::jsonb, 'draft')`,
      {
        replacements: {
          sellerId: SELLER,
          categoryId: CATEGORY_ID,
          name: 'Clean Code',
          slug: 'clean-code',
          description: 'existing',
          price: 9,
          currency: 'USD',
          stock: 1,
          attributes: JSON.stringify({ color: 'red' }),
        },
      }
    );

    const result = await useCase.execute(request({ name: 'Clean Code' }));

    expect(result.data.slug).toBe('clean-code-2');
    expect(await countProducts()).toBe(2);
  });

  it('throws INVALID_CATEGORY when the category does not exist', async () => {
    await expect(useCase.execute(request({ categoryId: OTHER_CATEGORY_ID }))).rejects.toMatchObject(
      {
        code: 'INVALID_CATEGORY',
        statusCode: 422,
        message: 'Category does not exist',
      }
    );

    expect(await countProducts()).toBe(0);
  });

  it('does not expose draft products through the public product listing', async () => {
    const result = await useCase.execute(request({ name: 'Draft Listing' }));
    const repo = new ProductRepository({ db: sequelize });
    const { items } = await repo.findAll({});

    expect(result.data.slug).toBe('draft-listing');
    expect(items.some((item) => item.id === result.data.id)).toBe(false);
  });
});
