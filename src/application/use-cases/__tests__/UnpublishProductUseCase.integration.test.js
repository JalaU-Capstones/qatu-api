import { QueryTypes } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMigratedTestDatabase } from '../../../infrastructure/persistence/__tests__/helpers/migratedTestDatabase.js';
import { ProductRepository } from '../../../infrastructure/persistence/repositories/ProductRepository.js';
import { UnpublishProductUseCase } from '../UnpublishProductUseCase.js';

const SELLER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER_SELLER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_DRAFT = '20000000-0000-4000-8000-000000000001';
const PRODUCT_PUBLISHED = '20000000-0000-4000-8000-000000000002';
const PRODUCT_ARCHIVED = '20000000-0000-4000-8000-000000000003';
const PRODUCT_OTHER_SELLER = '20000000-0000-4000-8000-000000000004';
const PRODUCT_SOFT_DELETED = '20000000-0000-4000-8000-000000000005';
const KNOWN_PUBLISHED_AT = new Date('2026-10-10T12:00:00.000Z');

describe('UnpublishProductUseCase (integration, real PostgreSQL)', { timeout: 30_000 }, () => {
  let database;
  let sequelize;

  const runQuery = (sql, replacements = {}) =>
    sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

  const buildUseCase = () =>
    new UnpublishProductUseCase({
      productRepository: new ProductRepository({ db: sequelize }),
    });

  const insertProduct = async ({
    id,
    sellerId,
    name,
    slug,
    state,
    publishedAt = null,
    deletedAt = null,
  }) => {
    await sequelize.query(
      `insert into public.products (
         id, seller_id, category_id, name, slug, description, price,
         currency, stock, attributes, state, published_at, deleted_at, primary_image_path
       ) values (
         :id, :sellerId, :categoryId, :name, :slug, :description, :price,
         :currency, :stock, :attributes::jsonb, :state, :publishedAt, :deletedAt, 'product-images/test.webp'
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
          stock: 5,
          attributes: JSON.stringify({}),
          state,
          publishedAt,
          deletedAt,
        },
      }
    );
  };

  const getProductRow = async (productId) => {
    const [row] = await runQuery(
      `select id, state, seller_id, published_at, updated_at, deleted_at
       from public.products where id = :productId`,
      { productId }
    );
    return row;
  };

  beforeAll(async () => {
    database = await createMigratedTestDatabase('unpublish_product');
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
          sellerMetadata: JSON.stringify({ username: 'unpublish_seller' }),
          otherSellerMetadata: JSON.stringify({ username: 'unpublish_other_seller' }),
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
      publishedAt: KNOWN_PUBLISHED_AT,
    });
    await insertProduct({
      id: PRODUCT_ARCHIVED,
      sellerId: SELLER,
      name: 'Archived Product',
      slug: 'archived-product',
      state: 'archived',
    });
    await insertProduct({
      id: PRODUCT_OTHER_SELLER,
      sellerId: OTHER_SELLER,
      name: 'Other Seller Published',
      slug: 'other-seller-published',
      state: 'published',
      publishedAt: KNOWN_PUBLISHED_AT,
    });
    await insertProduct({
      id: PRODUCT_SOFT_DELETED,
      sellerId: SELLER,
      name: 'Soft Deleted Product',
      slug: 'soft-deleted-product',
      state: 'published',
      publishedAt: KNOWN_PUBLISHED_AT,
      deletedAt: new Date(),
    });
  });

  it('1. unpublishes a published product, preserves published_at, updates updated_at', async () => {
    const before = await getProductRow(PRODUCT_PUBLISHED);
    const result = await buildUseCase().execute({ productId: PRODUCT_PUBLISHED, sellerId: SELLER });

    const after = await getProductRow(PRODUCT_PUBLISHED);
    expect(result.data.state).toBe('unpublished');
    expect(new Date(result.data.published_at).getTime()).toBe(KNOWN_PUBLISHED_AT.getTime());
    expect(after.state).toBe('unpublished');
    expect(new Date(after.published_at).getTime()).toBe(KNOWN_PUBLISHED_AT.getTime());
    expect(new Date(after.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before.updated_at).getTime()
    );
  });

  it('2. returns INVALID_STATE_TRANSITION for a draft product', async () => {
    await expect(
      buildUseCase().execute({ productId: PRODUCT_DRAFT, sellerId: SELLER })
    ).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      statusCode: 409,
      message: "Cannot unpublish a product in state 'draft'",
    });

    expect(await getProductRow(PRODUCT_DRAFT)).toMatchObject({ state: 'draft' });
  });

  it('3. returns INVALID_STATE_TRANSITION for an archived product', async () => {
    await expect(
      buildUseCase().execute({ productId: PRODUCT_ARCHIVED, sellerId: SELLER })
    ).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      statusCode: 409,
      message: "Cannot unpublish a product in state 'archived'",
    });

    expect(await getProductRow(PRODUCT_ARCHIVED)).toMatchObject({ state: 'archived' });
  });

  it('4. returns FORBIDDEN when accessed by another seller and leaves DB unchanged', async () => {
    await expect(
      buildUseCase().execute({ productId: PRODUCT_OTHER_SELLER, sellerId: SELLER })
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });

    expect(await getProductRow(PRODUCT_OTHER_SELLER)).toMatchObject({ state: 'published' });
  });

  it('5. returns PRODUCT_NOT_FOUND for an unknown UUID', async () => {
    await expect(
      buildUseCase().execute({
        productId: '99999999-9999-4999-8999-999999999999',
        sellerId: SELLER,
      })
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND', statusCode: 404 });
  });

  it('6. returns PRODUCT_NOT_FOUND for a soft-deleted product', async () => {
    await expect(
      buildUseCase().execute({ productId: PRODUCT_SOFT_DELETED, sellerId: SELLER })
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND', statusCode: 404 });
  });

  it('7. excludes the unpublished product from public findAll listing', async () => {
    const repo = new ProductRepository({ db: sequelize });
    const beforeList = await repo.findAll({ page: 1, limit: 20 });
    expect(beforeList.items.map((i) => i.id)).toContain(PRODUCT_PUBLISHED);

    await buildUseCase().execute({ productId: PRODUCT_PUBLISHED, sellerId: SELLER });

    const afterList = await repo.findAll({ page: 1, limit: 20 });
    expect(afterList.items.map((i) => i.id)).not.toContain(PRODUCT_PUBLISHED);
  });

  it('8. returns the row with state=unpublished when queried via findById', async () => {
    const repo = new ProductRepository({ db: sequelize });
    await buildUseCase().execute({ productId: PRODUCT_PUBLISHED, sellerId: SELLER });

    const found = await repo.findById(PRODUCT_PUBLISHED);
    expect(found).not.toBeNull();
    expect(found.state).toBe('unpublished');
  });

  it('9. allows only one concurrent unpublish to succeed', async () => {
    const useCase = buildUseCase();
    const results = await Promise.allSettled([
      useCase.execute({ productId: PRODUCT_PUBLISHED, sellerId: SELLER }),
      useCase.execute({ productId: PRODUCT_PUBLISHED, sellerId: SELLER }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected');
    expect(rejected.reason).toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      statusCode: 409,
    });
    expect(await getProductRow(PRODUCT_PUBLISHED)).toMatchObject({
      state: 'unpublished',
    });
  });
});
