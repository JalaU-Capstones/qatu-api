import { QueryTypes } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InventoryService } from '../../../domain/services/InventoryService.js';
import { OrderPricingService } from '../../../domain/services/OrderPricingService.js';
import { SequelizeTransactionManager } from '../../../infrastructure/persistence/SequelizeTransactionManager.js';
import { createMigratedTestDatabase } from '../../../infrastructure/persistence/__tests__/helpers/migratedTestDatabase.js';
import { CartRepository } from '../../../infrastructure/persistence/repositories/CartRepository.js';
import { OrderRepository } from '../../../infrastructure/persistence/repositories/OrderRepository.js';
import { OutboxRepository } from '../../../infrastructure/persistence/repositories/OutboxRepository.js';
import { PaymentRepository } from '../../../infrastructure/persistence/repositories/PaymentRepository.js';
import { ProductRepository } from '../../../infrastructure/persistence/repositories/ProductRepository.js';
import { CreateOrderRequestDTO } from '../../dtos/CreateOrderDTO.js';
import { CreateOrderUseCase } from '../CreateOrderUseCase.js';
import { DeleteProductUseCase } from '../DeleteProductUseCase.js';

const SELLER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BUYER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER_SELLER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';

const PRODUCT_DRAFT = '20000000-0000-4000-8000-000000000001';
const PRODUCT_PUBLISHED = '20000000-0000-4000-8000-000000000002';
const PRODUCT_ARCHIVED = '20000000-0000-4000-8000-000000000003';
const PRODUCT_OTHER_SELLER = '20000000-0000-4000-8000-000000000004';
const PRODUCT_SOFT_DELETED = '20000000-0000-4000-8000-000000000005';
const PRODUCT_CART = '20000000-0000-4000-8000-000000000006';

const KNOWN_PUBLISHED_AT = new Date('2026-10-10T12:00:00.000Z');

const ADDRESS = {
  full_name: 'Test Buyer',
  phone: '71234567',
  street: '123 Test St',
  city: 'La Paz',
  state: 'La Paz',
  country: 'BO',
};

describe('DeleteProductUseCase (integration, real PostgreSQL)', { timeout: 30_000 }, () => {
  let database;
  let sequelize;

  const runQuery = (sql, replacements = {}) =>
    sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

  const buildDeleteUseCase = () =>
    new DeleteProductUseCase({
      productRepository: new ProductRepository({ db: sequelize }),
    });

  const buildCreateOrderUseCase = () =>
    new CreateOrderUseCase({
      transactionManager: new SequelizeTransactionManager({ db: sequelize }),
      cartRepository: new CartRepository({ db: sequelize }),
      inventoryService: new InventoryService({
        productRepository: new ProductRepository({ db: sequelize }),
      }),
      pricingService: new OrderPricingService(),
      orderRepository: new OrderRepository({ db: sequelize }),
      paymentRepository: new PaymentRepository({ db: sequelize }),
      outboxRepository: new OutboxRepository({ db: sequelize }),
    });

  const insertProduct = async ({
    id,
    sellerId,
    name,
    slug,
    state,
    publishedAt = null,
    deletedAt = null,
    stock = 10,
    price = 19.99,
  }) => {
    await sequelize.query(
      `insert into public.products (
         id, seller_id, category_id, name, slug, description, price,
         currency, stock, attributes, state, published_at, deleted_at, primary_image_path
       ) values (
         :id, :sellerId, :categoryId, :name, :slug, 'Integration test product', :price,
         'USD', :stock, '{}'::jsonb, :state, :publishedAt, :deletedAt, 'product-images/test.webp'
       )`,
      {
        replacements: {
          id,
          sellerId,
          categoryId: CATEGORY_ID,
          name,
          slug,
          price,
          stock,
          state,
          publishedAt,
          deletedAt,
        },
      }
    );
  };

  const getProductRow = async (productId) => {
    const [row] = await runQuery(
      `select id, seller_id, state, published_at, deleted_at, updated_at
       from public.products where id = :productId`,
      { productId }
    );
    return row;
  };

  beforeAll(async () => {
    database = await createMigratedTestDatabase('delete_product');
    ({ sequelize } = database);
  }, 120_000);

  afterAll(async () => {
    await database?.close();
  }, 60_000);

  beforeEach(async () => {
    await sequelize.query('delete from public.outbox_events;');
    await sequelize.query('delete from public.payments;');
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
          sellerMetadata: JSON.stringify({ username: 'delete_seller' }),
          buyerMetadata: JSON.stringify({ username: 'delete_buyer' }),
          otherSellerMetadata: JSON.stringify({ username: 'delete_other_seller' }),
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
      name: 'Other Seller Product',
      slug: 'other-seller-product',
      state: 'published',
      publishedAt: KNOWN_PUBLISHED_AT,
    });

    await insertProduct({
      id: PRODUCT_SOFT_DELETED,
      sellerId: SELLER,
      name: 'Already Soft Deleted',
      slug: 'already-soft-deleted',
      state: 'published',
      publishedAt: KNOWN_PUBLISHED_AT,
      deletedAt: new Date(),
    });
  });

  it('1. happy path draft: sets deleted_at IS NOT NULL in database', async () => {
    const before = await getProductRow(PRODUCT_DRAFT);
    expect(before.deleted_at).toBeNull();

    const result = await buildDeleteUseCase().execute({
      productId: PRODUCT_DRAFT,
      sellerId: SELLER,
    });

    expect(result).toEqual({ meta: { timestamp: expect.any(String) } });

    const after = await getProductRow(PRODUCT_DRAFT);
    expect(after.deleted_at).not.toBeNull();
  });

  it('2. happy path published: sets deleted_at, preserves published_at and state', async () => {
    const before = await getProductRow(PRODUCT_PUBLISHED);
    expect(before.deleted_at).toBeNull();

    const result = await buildDeleteUseCase().execute({
      productId: PRODUCT_PUBLISHED,
      sellerId: SELLER,
    });

    expect(result).toEqual({ meta: { timestamp: expect.any(String) } });

    const after = await getProductRow(PRODUCT_PUBLISHED);
    expect(after.deleted_at).not.toBeNull();
    expect(after.state).toBe('published');
    expect(new Date(after.published_at).getTime()).toBe(KNOWN_PUBLISHED_AT.getTime());
    expect(new Date(after.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before.updated_at).getTime()
    );
  });

  it('3. happy path archived: successfully soft-deletes archived product (no archived guard)', async () => {
    const before = await getProductRow(PRODUCT_ARCHIVED);
    expect(before.deleted_at).toBeNull();

    const result = await buildDeleteUseCase().execute({
      productId: PRODUCT_ARCHIVED,
      sellerId: SELLER,
    });

    expect(result).toEqual({ meta: { timestamp: expect.any(String) } });

    const after = await getProductRow(PRODUCT_ARCHIVED);
    expect(after.deleted_at).not.toBeNull();
    expect(after.state).toBe('archived');
  });

  it('4. wrong seller: returns 403 FORBIDDEN and leaves product deleted_at IS NULL', async () => {
    await expect(
      buildDeleteUseCase().execute({
        productId: PRODUCT_OTHER_SELLER,
        sellerId: SELLER,
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      message: 'You do not own this product',
    });

    const after = await getProductRow(PRODUCT_OTHER_SELLER);
    expect(after.deleted_at).toBeNull();
  });

  it('5. already soft-deleted product: returns 404 PRODUCT_NOT_FOUND', async () => {
    await expect(
      buildDeleteUseCase().execute({
        productId: PRODUCT_SOFT_DELETED,
        sellerId: SELLER,
      })
    ).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
      message: 'Product not found',
    });
  });

  it('6. unknown UUID: returns 404 PRODUCT_NOT_FOUND', async () => {
    await expect(
      buildDeleteUseCase().execute({
        productId: '99999999-9999-4999-8999-999999999999',
        sellerId: SELLER,
      })
    ).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
      message: 'Product not found',
    });
  });

  it('7. after soft-delete: findById returns null', async () => {
    const repo = new ProductRepository({ db: sequelize });
    await buildDeleteUseCase().execute({ productId: PRODUCT_DRAFT, sellerId: SELLER });

    const found = await repo.findById(PRODUCT_DRAFT);
    expect(found).toBeNull();
  });

  it('8. after soft-delete: findByIdWithDetails returns null', async () => {
    const repo = new ProductRepository({ db: sequelize });
    await buildDeleteUseCase().execute({ productId: PRODUCT_DRAFT, sellerId: SELLER });

    const foundWithDetails = await repo.findByIdWithDetails(PRODUCT_DRAFT);
    expect(foundWithDetails).toBeNull();
  });

  it('9. after soft-delete: findAll does NOT include the product', async () => {
    const repo = new ProductRepository({ db: sequelize });
    const beforeList = await repo.findAll({ page: 1, limit: 100 });
    expect(beforeList.items.some((p) => p.id === PRODUCT_PUBLISHED)).toBe(true);

    await buildDeleteUseCase().execute({ productId: PRODUCT_PUBLISHED, sellerId: SELLER });

    const afterList = await repo.findAll({ page: 1, limit: 100 });
    expect(afterList.items.some((p) => p.id === PRODUCT_PUBLISHED)).toBe(false);
  });

  it('10. after soft-delete: listBySeller does NOT include the product', async () => {
    const repo = new ProductRepository({ db: sequelize });
    const beforeSellerList = await repo.listBySeller(SELLER, { page: 1, limit: 100 });
    expect(beforeSellerList.items.some((p) => p.id === PRODUCT_DRAFT)).toBe(true);

    await buildDeleteUseCase().execute({ productId: PRODUCT_DRAFT, sellerId: SELLER });

    const afterSellerList = await repo.listBySeller(SELLER, { page: 1, limit: 100 });
    expect(afterSellerList.items.some((p) => p.id === PRODUCT_DRAFT)).toBe(false);
  });

  it('11. CRITICAL cart interaction: soft-deleting a product in buyer cart causes CreateOrderUseCase to fail gracefully', async () => {
    await insertProduct({
      id: PRODUCT_CART,
      sellerId: SELLER,
      name: 'Cart In Flight Product',
      slug: 'cart-in-flight-product',
      state: 'published',
      publishedAt: KNOWN_PUBLISHED_AT,
      stock: 5,
      price: 25.0,
    });

    // Buyer adds product to cart
    await sequelize.query(
      `insert into public.cart_items (user_id, product_id, quantity)
       values (:buyerId, :productId, 2)`,
      { replacements: { buyerId: BUYER, productId: PRODUCT_CART } }
    );

    // Seller soft-deletes the product
    await buildDeleteUseCase().execute({
      productId: PRODUCT_CART,
      sellerId: SELLER,
    });

    // Buyer attempts checkout with the existing cart
    const orderUseCase = buildCreateOrderUseCase();
    const orderRequest = new CreateOrderRequestDTO({
      buyerId: BUYER,
      shippingAddress: ADDRESS,
      paymentMethod: 'simulated',
    });

    await expect(orderUseCase.execute(orderRequest)).rejects.toMatchObject({
      statusCode: 422,
      code: 'PRODUCT_UNAVAILABLE',
    });
  });
});
