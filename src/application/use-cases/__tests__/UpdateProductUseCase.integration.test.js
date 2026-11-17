import { QueryTypes } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMigratedTestDatabase } from '../../../infrastructure/persistence/__tests__/helpers/migratedTestDatabase.js';
import { ProductRepository } from '../../../infrastructure/persistence/repositories/ProductRepository.js';
import { PublishProductUseCase } from '../PublishProductUseCase.js';
import { UnpublishProductUseCase } from '../UnpublishProductUseCase.js';
import { UpdateProductUseCase } from '../UpdateProductUseCase.js';

const SELLER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BUYER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER_SELLER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_DRAFT = '20000000-0000-4000-8000-000000000001';
const PRODUCT_PUBLISHED = '20000000-0000-4000-8000-000000000002';
const PRODUCT_UNPUBLISHED = '20000000-0000-4000-8000-000000000003';
const PRODUCT_ARCHIVED = '20000000-0000-4000-8000-000000000004';
const PRODUCT_OTHER_SELLER = '20000000-0000-4000-8000-000000000005';
const PRODUCT_SOFT_DELETED = '20000000-0000-4000-8000-000000000006';
const KNOWN_PUBLISHED_AT = new Date('2026-10-10T12:00:00.000Z');

describe('UpdateProductUseCase (integration, real PostgreSQL)', { timeout: 30_000 }, () => {
  let database;
  let sequelize;

  const runQuery = (sql, replacements = {}) =>
    sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

  const buildUseCase = () =>
    new UpdateProductUseCase({
      productRepository: new ProductRepository({ db: sequelize }),
    });

  const insertProduct = async ({
    id,
    sellerId,
    name,
    slug,
    description = 'Original Description',
    price = 19.99,
    currency = 'USD',
    stock = 5,
    attributes = {},
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
          description,
          price,
          currency,
          stock,
          attributes: JSON.stringify(attributes),
          state,
          publishedAt,
          deletedAt,
        },
      }
    );
  };

  const getProductRow = async (productId) => {
    const [row] = await runQuery(
      `select id, seller_id, category_id, name, slug, description, price,
              currency, stock, attributes, state, published_at, updated_at, deleted_at
       from public.products where id = :productId`,
      { productId }
    );
    return row;
  };

  beforeAll(async () => {
    database = await createMigratedTestDatabase('update_product');
    ({ sequelize } = database);
  }, 120_000);

  afterAll(async () => {
    await database?.close();
  });

  beforeEach(async () => {
    await sequelize.query('delete from public.order_items;');
    await sequelize.query('delete from public.orders;');
    await sequelize.query('delete from public.cart_items;');
    await sequelize.query('delete from public.product_images;');
    await sequelize.query('delete from public.products;');
    await sequelize.query('delete from public.user_roles;');
    await sequelize.query('delete from public.profiles;');
    await sequelize.query('delete from public.categories;');
    await sequelize.query('delete from auth.users;');

    await sequelize.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values
         (:sellerId, 'seller@example.com', :sellerMetadata::jsonb),
         (:buyerId, 'buyer@example.com', :buyerMetadata::jsonb),
         (:otherSellerId, 'other-seller@example.com', :otherSellerMetadata::jsonb)`,
      {
        replacements: {
          sellerId: SELLER,
          buyerId: BUYER,
          otherSellerId: OTHER_SELLER,
          sellerMetadata: JSON.stringify({ username: 'update_seller' }),
          buyerMetadata: JSON.stringify({ username: 'update_buyer' }),
          otherSellerMetadata: JSON.stringify({ username: 'update_other_seller' }),
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
      attributes: { color: 'red', size: 'M' },
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
      id: PRODUCT_UNPUBLISHED,
      sellerId: SELLER,
      name: 'Unpublished Product',
      slug: 'unpublished-product',
      state: 'unpublished',
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

  it('1. happy path single field (name) on draft: DB updated, updated_at updated, published_at remains null', async () => {
    const before = await getProductRow(PRODUCT_DRAFT);
    const result = await buildUseCase().execute({
      productId: PRODUCT_DRAFT,
      sellerId: SELLER,
      fields: { name: 'Renamed Draft Product' },
    });

    expect(result.data.name).toBe('Renamed Draft Product');
    expect(result.data.published_at).toBeNull();

    const after = await getProductRow(PRODUCT_DRAFT);
    expect(after.name).toBe('Renamed Draft Product');
    expect(after.published_at).toBeNull();
    expect(new Date(after.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before.updated_at).getTime()
    );
  });

  it('2. happy path multiple fields (price + stock) on draft', async () => {
    const result = await buildUseCase().execute({
      productId: PRODUCT_DRAFT,
      sellerId: SELLER,
      fields: { price: 49.99, stock: 25 },
    });

    expect(result.data.price).toBe(49.99);
    expect(result.data.stock).toBe(25);

    const after = await getProductRow(PRODUCT_DRAFT);
    expect(Number(after.price)).toBe(49.99);
    expect(after.stock).toBe(25);
  });

  it('3. updates published product: state remains published, published_at unchanged', async () => {
    const before = await getProductRow(PRODUCT_PUBLISHED);
    const result = await buildUseCase().execute({
      productId: PRODUCT_PUBLISHED,
      sellerId: SELLER,
      fields: { description: 'Updated description for published product' },
    });

    expect(result.data.state).toBe('published');
    expect(new Date(result.data.published_at).getTime()).toBe(KNOWN_PUBLISHED_AT.getTime());

    const after = await getProductRow(PRODUCT_PUBLISHED);
    expect(after.state).toBe('published');
    expect(new Date(after.published_at).getTime()).toBe(KNOWN_PUBLISHED_AT.getTime());
    expect(after.description).toBe('Updated description for published product');
    expect(new Date(after.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before.updated_at).getTime()
    );
  });

  it('4. updates unpublished product: state remains unpublished', async () => {
    const result = await buildUseCase().execute({
      productId: PRODUCT_UNPUBLISHED,
      sellerId: SELLER,
      fields: { name: 'Updated Unpublished Product' },
    });

    expect(result.data.state).toBe('unpublished');

    const after = await getProductRow(PRODUCT_UNPUBLISHED);
    expect(after.state).toBe('unpublished');
    expect(after.name).toBe('Updated Unpublished Product');
  });

  it('5. FK violation: non-existent category_id throws 422 INVALID_CATEGORY and leaves DB unchanged', async () => {
    const nonExistentCategory = '99999999-9999-4999-8999-999999999999';
    const before = await getProductRow(PRODUCT_DRAFT);

    await expect(
      buildUseCase().execute({
        productId: PRODUCT_DRAFT,
        sellerId: SELLER,
        fields: { category_id: nonExistentCategory },
      })
    ).rejects.toMatchObject({
      code: 'INVALID_CATEGORY',
      statusCode: 422,
      message: 'Category does not exist',
    });

    const after = await getProductRow(PRODUCT_DRAFT);
    expect(after.category_id).toBe(before.category_id);
    expect(after.name).toBe(before.name);
  });

  it('6. blocks currency change on published products; allows after unpublish → republish', async () => {
    const repo = new ProductRepository({ db: sequelize });

    // Step 1: seed product with an image so it can be published/republished
    const imagePath = `product-images/${PRODUCT_PUBLISHED}/cover.webp`;
    await repo.addImage({
      productId: PRODUCT_PUBLISHED,
      path: imagePath,
      altText: null,
      position: 0,
    });
    await repo.setPrimaryImageIfNull({ productId: PRODUCT_PUBLISHED, path: imagePath });

    const beforeRow = await getProductRow(PRODUCT_PUBLISHED);
    expect(beforeRow.currency).toBe('USD');

    // Step 2: attempt currency change on published product → 409
    await expect(
      buildUseCase().execute({
        productId: PRODUCT_PUBLISHED,
        sellerId: SELLER,
        fields: { currency: 'EUR' },
      })
    ).rejects.toMatchObject({
      code: 'CANNOT_CHANGE_CURRENCY_ON_PUBLISHED',
      statusCode: 409,
      message: 'Cannot change currency on a published product. Unpublish it first.',
    });
    // DB still has USD
    expect((await getProductRow(PRODUCT_PUBLISHED)).currency).toBe('USD');

    // Step 3: unpublish
    const unpublishUseCase = new UnpublishProductUseCase({ productRepository: repo });
    await unpublishUseCase.execute({ productId: PRODUCT_PUBLISHED, sellerId: SELLER });
    expect((await getProductRow(PRODUCT_PUBLISHED)).state).toBe('unpublished');

    // Step 4: currency change now succeeds on unpublished product
    await buildUseCase().execute({
      productId: PRODUCT_PUBLISHED,
      sellerId: SELLER,
      fields: { currency: 'EUR' },
    });
    const afterCurrencyChange = await getProductRow(PRODUCT_PUBLISHED);
    expect(afterCurrencyChange.currency).toBe('EUR');
    expect(afterCurrencyChange.state).toBe('unpublished');

    // Step 5: republish
    const publishUseCase = new PublishProductUseCase({ productRepository: repo });
    await publishUseCase.execute({ productId: PRODUCT_PUBLISHED, sellerId: SELLER });
    const finalRow = await getProductRow(PRODUCT_PUBLISHED);
    expect(finalRow.currency).toBe('EUR');
    expect(finalRow.state).toBe('published');
    // published_at is preserved from original (handle_product_published_at trigger only
    // sets it on first transition when published_at IS NULL; it was already set)
    expect(new Date(finalRow.published_at).getTime()).toBe(KNOWN_PUBLISHED_AT.getTime());
  });

  it('7. returns 409 INVALID_STATE_TRANSITION for archived product and leaves DB unchanged', async () => {
    const before = await getProductRow(PRODUCT_ARCHIVED);

    await expect(
      buildUseCase().execute({
        productId: PRODUCT_ARCHIVED,
        sellerId: SELLER,
        fields: { name: 'Archived Edit' },
      })
    ).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      statusCode: 409,
      message: "Cannot edit a product in state 'archived'",
    });

    const after = await getProductRow(PRODUCT_ARCHIVED);
    expect(after.name).toBe(before.name);
  });

  it('8. returns 403 FORBIDDEN when accessed by another seller and leaves DB unchanged', async () => {
    const before = await getProductRow(PRODUCT_OTHER_SELLER);

    await expect(
      buildUseCase().execute({
        productId: PRODUCT_OTHER_SELLER,
        sellerId: SELLER,
        fields: { name: 'Hijacked Name' },
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      message: 'You do not own this product',
    });

    const after = await getProductRow(PRODUCT_OTHER_SELLER);
    expect(after.name).toBe(before.name);
  });

  it('9. returns 404 PRODUCT_NOT_FOUND for soft-deleted product', async () => {
    await expect(
      buildUseCase().execute({
        productId: PRODUCT_SOFT_DELETED,
        sellerId: SELLER,
        fields: { name: 'Restored Name' },
      })
    ).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
      message: 'Product not found',
    });
  });

  it('10. returns 404 PRODUCT_NOT_FOUND for an unknown UUID', async () => {
    await expect(
      buildUseCase().execute({
        productId: '99999999-9999-4999-8999-999999999999',
        sellerId: SELLER,
        fields: { name: 'Ghost Product' },
      })
    ).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
      message: 'Product not found',
    });
  });

  it('11. attributes shallow replacement: replaces attributes rather than deep merging', async () => {
    // PRODUCT_DRAFT was seeded with { color: 'red', size: 'M' }
    const before = await getProductRow(PRODUCT_DRAFT);
    expect(before.attributes).toEqual({ color: 'red', size: 'M' });

    const result = await buildUseCase().execute({
      productId: PRODUCT_DRAFT,
      sellerId: SELLER,
      fields: { attributes: { color: 'blue' } },
    });

    expect(result.data.attributes).toEqual({ color: 'blue' });

    const after = await getProductRow(PRODUCT_DRAFT);
    expect(after.attributes).toEqual({ color: 'blue' });
    expect(after.attributes.size).toBeUndefined();
  });

  it('12. no-op safety: updating only name leaves other 6 fields unchanged', async () => {
    const before = await getProductRow(PRODUCT_DRAFT);

    await buildUseCase().execute({
      productId: PRODUCT_DRAFT,
      sellerId: SELLER,
      fields: { name: 'Brand New Draft Name' },
    });

    const after = await getProductRow(PRODUCT_DRAFT);
    expect(after.name).toBe('Brand New Draft Name');
    expect(after.description).toBe(before.description);
    expect(Number(after.price)).toBe(Number(before.price));
    expect(after.currency).toBe(before.currency);
    expect(after.stock).toBe(before.stock);
    expect(after.category_id).toBe(before.category_id);
    expect(after.attributes).toEqual(before.attributes);
  });

  it('13. public visibility: updating published product reflects immediately in findAll; draft does not appear', async () => {
    const repo = new ProductRepository({ db: sequelize });

    // Initial check: published product appears with original name
    const initialList = await repo.findAll({ page: 1, limit: 20 });
    const foundPublishedInitial = initialList.items.find((p) => p.id === PRODUCT_PUBLISHED);
    expect(foundPublishedInitial).toBeDefined();
    expect(foundPublishedInitial.name).toBe('Published Product');

    // Update published product's name
    await buildUseCase().execute({
      productId: PRODUCT_PUBLISHED,
      sellerId: SELLER,
      fields: { name: 'Updated Published Product Name' },
    });

    // Verify findAll immediately reflects the new name without cache lag
    const updatedList = await repo.findAll({ page: 1, limit: 20 });
    const foundPublishedUpdated = updatedList.items.find((p) => p.id === PRODUCT_PUBLISHED);
    expect(foundPublishedUpdated).toBeDefined();
    expect(foundPublishedUpdated.name).toBe('Updated Published Product Name');

    // Update draft product's name
    await buildUseCase().execute({
      productId: PRODUCT_DRAFT,
      sellerId: SELLER,
      fields: { name: 'Updated Draft Name' },
    });

    // Verify draft product does NOT appear in findAll
    const finalList = await repo.findAll({ page: 1, limit: 20 });
    const foundDraft = finalList.items.find((p) => p.id === PRODUCT_DRAFT);
    expect(foundDraft).toBeUndefined();
  });
});
