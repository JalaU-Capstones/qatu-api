import { QueryTypes } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMigratedTestDatabase } from '../../../infrastructure/persistence/__tests__/helpers/migratedTestDatabase.js';
import { ProductRepository } from '../../../infrastructure/persistence/repositories/ProductRepository.js';
import { PublishProductUseCase } from '../PublishProductUseCase.js';

const SELLER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER_SELLER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_DRAFT = '10000000-0000-4000-8000-000000000001';
const PRODUCT_PUBLISHED = '10000000-0000-4000-8000-000000000002';
const PRODUCT_OTHER_SELLER = '10000000-0000-4000-8000-000000000003';

describe('PublishProductUseCase (integration, real PostgreSQL)', { timeout: 30_000 }, () => {
  let database;
  let sequelize;

  const runQuery = (sql, replacements = {}) =>
    sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

  const buildUseCase = () =>
    new PublishProductUseCase({
      productRepository: new ProductRepository({ db: sequelize }),
    });

  const insertProduct = async ({ id, sellerId, name, slug, state }) => {
    await sequelize.query(
      `insert into public.products (
         id, seller_id, category_id, name, slug, description, price,
         currency, stock, attributes, state
       ) values (
         :id, :sellerId, :categoryId, :name, :slug, :description, :price,
         :currency, :stock, :attributes::jsonb, :state
       )`,
      {
        replacements: {
          id,
          sellerId,
          categoryId: CATEGORY_ID,
          name,
          slug,
          description: 'Integration test product',
          price: 19.99,
          currency: 'USD',
          stock: 0,
          attributes: JSON.stringify({}),
          state,
        },
      }
    );
  };

  const getProductRow = async (productId) => {
    const [row] = await runQuery(
      `select id, state, seller_id, published_at, updated_at
       from public.products where id = :productId`,
      { productId }
    );
    return row;
  };

  beforeAll(async () => {
    database = await createMigratedTestDatabase('publish_product');
    ({ sequelize } = database);
  }, 120_000);

  afterAll(async () => {
    await database?.close();
  });

  beforeEach(async () => {
    await sequelize.query('delete from public.products;');
    await sequelize.query('delete from public.user_roles;');
    await sequelize.query('delete from public.profiles;');
    await sequelize.query('delete from public.categories;');
    await sequelize.query('delete from auth.users;');

    await sequelize.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values
         (:sellerId, 'seller@example.com', :sellerMetadata::jsonb),
         (:otherSellerId, 'other-seller@example.com', :otherSellerMetadata::jsonb)`,
      {
        replacements: {
          sellerId: SELLER,
          otherSellerId: OTHER_SELLER,
          sellerMetadata: JSON.stringify({ username: 'publish_seller' }),
          otherSellerMetadata: JSON.stringify({ username: 'publish_other_seller' }),
        },
      }
    );

    await sequelize.query(
      `insert into public.user_roles (profile_id, role_id)
       select p.id, r.id from public.profiles p, public.roles r
       where r.name = 'seller' and p.id in (:sellerId, :otherSellerId)
       on conflict do nothing`,
      { replacements: { sellerId: SELLER, otherSellerId: OTHER_SELLER } }
    );

    await sequelize.query(
      `insert into public.categories (id, name, slug)
       values (:id, 'Electronics', 'electronics')`,
      { replacements: { id: CATEGORY_ID } }
    );

    await insertProduct({
      id: PRODUCT_DRAFT,
      sellerId: SELLER,
      name: 'Draft Product',
      slug: 'draft-product',
      state: 'draft',
    });
    await insertProduct({
      id: PRODUCT_PUBLISHED,
      sellerId: SELLER,
      name: 'Published Product',
      slug: 'published-product',
      state: 'published',
    });
    await insertProduct({
      id: PRODUCT_OTHER_SELLER,
      sellerId: OTHER_SELLER,
      name: 'Other Seller Draft',
      slug: 'other-seller-draft',
      state: 'draft',
    });
  });

  it('publishes a draft, sets the trigger timestamp, and updates the row', async () => {
    const before = await getProductRow(PRODUCT_DRAFT);
    const startTime = Date.now();

    const result = await buildUseCase().execute({ productId: PRODUCT_DRAFT, sellerId: SELLER });

    const row = await getProductRow(PRODUCT_DRAFT);
    expect(result.data.state).toBe('published');
    expect(result.data.published_at).not.toBeNull();
    expect(result.meta.timestamp).toEqual(expect.any(String));
    expect(row.state).toBe('published');
    expect(row.published_at).not.toBeNull();
    expect(new Date(row.updated_at).getTime()).toBeGreaterThan(
      new Date(before.updated_at).getTime()
    );
    expect(Math.abs(new Date(row.published_at).getTime() - startTime)).toBeLessThan(5_000);
  });

  it('returns PRODUCT_NOT_FOUND for an unknown product', async () => {
    await expect(
      buildUseCase().execute({
        productId: '10000000-0000-4000-8000-000000000099',
        sellerId: SELLER,
      })
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND', statusCode: 404 });
  });

  it('returns FORBIDDEN and leaves another seller product unchanged', async () => {
    await expect(
      buildUseCase().execute({ productId: PRODUCT_OTHER_SELLER, sellerId: SELLER })
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });

    expect(await getProductRow(PRODUCT_OTHER_SELLER)).toMatchObject({ state: 'draft' });
  });

  it('returns INVALID_STATE_TRANSITION for an already published product', async () => {
    await expect(
      buildUseCase().execute({ productId: PRODUCT_PUBLISHED, sellerId: SELLER })
    ).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      statusCode: 409,
      message: expect.stringContaining('published'),
    });

    expect(await getProductRow(PRODUCT_PUBLISHED)).toMatchObject({ state: 'published' });
  });

  it('rejects an invalid UUID without changing the database', async () => {
    await expect(
      buildUseCase().execute({ productId: 'not-a-uuid', sellerId: SELLER })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });

    expect((await getProductRow(PRODUCT_DRAFT)).state).toBe('draft');
  });

  it('allows only one concurrent publish to succeed', async () => {
    const useCase = buildUseCase();
    const results = await Promise.allSettled([
      useCase.execute({ productId: PRODUCT_DRAFT, sellerId: SELLER }),
      useCase.execute({ productId: PRODUCT_DRAFT, sellerId: SELLER }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected.reason).toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      statusCode: 409,
    });
    expect(await getProductRow(PRODUCT_DRAFT)).toMatchObject({
      state: 'published',
    });
    expect((await getProductRow(PRODUCT_DRAFT)).published_at).not.toBeNull();
  });

  it('makes a published draft visible in the public listing', async () => {
    const repository = new ProductRepository({ db: sequelize });
    const before = await repository.findAll({});

    expect(before.items.map((item) => item.id)).toEqual([PRODUCT_PUBLISHED]);

    await buildUseCase().execute({ productId: PRODUCT_DRAFT, sellerId: SELLER });

    const after = await repository.findAll({});
    expect(after.items.map((item) => item.id)).toContain(PRODUCT_DRAFT);
    expect(after.items).toHaveLength(2);
  });
});
