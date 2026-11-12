import { QueryTypes } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { ListOrdersRequestDTO } from '../../dtos/OrderDTO.js';
import { CreateOrderUseCase } from '../CreateOrderUseCase.js';
import { GetOrderByIdUseCase } from '../GetOrderByIdUseCase.js';
import { ListOrdersUseCase } from '../ListOrdersUseCase.js';

/**
 * US-10 checkout against a REAL PostgreSQL with the REAL migrations:
 * transaction, rollback, row-level concurrency and the transactional outbox.
 */

const BUYER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BUYER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SELLER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

// Ascending ids: the inventory service reserves in this order.
const P1 = '10000000-0000-4000-8000-000000000001';
const P2 = '10000000-0000-4000-8000-000000000002';
const P3 = '10000000-0000-4000-8000-000000000003';

const ADDRESS = {
  full_name: 'Aaron Florez',
  phone: '71234567',
  street: '123 Main St',
  city: 'La Paz',
  state: 'La Paz',
  country: 'BO',
};

// Real PostgreSQL + real migrations: transaction, rollback, concurrency and the outbox.
describe('CreateOrderUseCase (integration, real PostgreSQL)', { timeout: 30_000 }, () => {
  let database;
  let sequelize;
  let paymentRepository;
  let useCase;

  const q = (sql, replacements = {}) =>
    sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
  const count = async (table, where = 'true', replacements = {}) =>
    Number((await q(`select count(*) as n from ${table} where ${where}`, replacements))[0].n);
  const stockOf = async (productId) =>
    Number(
      (await q('select stock from public.products where id = :productId', { productId }))[0].stock
    );

  const request = (buyerId = BUYER_A, notes = null, paymentMethod = 'simulated') =>
    new CreateOrderRequestDTO({ buyerId, shippingAddress: ADDRESS, notes, paymentMethod });

  const addProduct = (id, { name, price, stock, state = 'published' }) =>
    sequelize.query(
      `insert into public.products
         (id, seller_id, name, slug, price, currency, stock, state, published_at)
       values
         (:id, :seller, :name, :slug, :price, 'USD', :stock, :state,
          case when :state = 'published' then now() else null end)`,
      { replacements: { id, seller: SELLER, name, slug: `slug-${id}`, price, stock, state } }
    );

  const addToCart = (buyerId, productId, quantity) =>
    sequelize.query(
      'insert into public.cart_items (user_id, product_id, quantity) values (:buyerId, :productId, :quantity)',
      { replacements: { buyerId, productId, quantity } }
    );

  const buildUseCase = () => {
    paymentRepository = new PaymentRepository({ db: sequelize });
    return new CreateOrderUseCase({
      transactionManager: new SequelizeTransactionManager({ db: sequelize }),
      cartRepository: new CartRepository({ db: sequelize }),
      inventoryService: new InventoryService({
        productRepository: new ProductRepository({ db: sequelize }),
      }),
      pricingService: new OrderPricingService(),
      orderRepository: new OrderRepository({ db: sequelize }),
      paymentRepository,
      outboxRepository: new OutboxRepository({ db: sequelize }),
    });
  };

  beforeAll(async () => {
    database = await createMigratedTestDatabase('checkout');
    ({ sequelize } = database);
  }, 120_000);

  afterAll(async () => {
    await database?.close();
  });

  beforeEach(async () => {
    await sequelize.query(`
      delete from public.outbox_events;
      delete from public.payments;
      delete from public.order_items;
      delete from public.orders;
      delete from public.cart_items;
      delete from public.products;
      delete from auth.users;
    `);
    // The on_auth_user_created trigger creates the matching profile (+ buyer role).
    await sequelize.query(`
      insert into auth.users (id, email, raw_user_meta_data) values
        ('${BUYER_A}', 'a@example.com', '{"username":"buyer_a"}'),
        ('${BUYER_B}', 'b@example.com', '{"username":"buyer_b"}'),
        ('${SELLER}', 's@example.com', '{"username":"seller_x"}');
    `);
    useCase = buildUseCase();
  });

  describe('Scenario: successful checkout', () => {
    it('creates order + items, decrements stock, creates a pending payment, enqueues OrderPlaced and clears the cart', async () => {
      await addProduct(P1, { name: 'Clean Code', price: 20, stock: 5 });
      await addProduct(P2, { name: 'DDD', price: 15.5, stock: 3 });
      await addToCart(BUYER_A, P1, 2);
      await addToCart(BUYER_A, P2, 1);

      const { data, meta } = await useCase.execute(request(BUYER_A, 'Leave at reception'));

      expect(meta.timestamp).toEqual(expect.any(String));
      expect(data).toMatchObject({
        status: 'pending',
        buyer_id: BUYER_A,
        currency: 'USD',
        subtotal: 55.5,
        shipping_cost: 0, // >= 50 → free shipping
        tax: 0,
        total: 55.5,
        notes: 'Leave at reception',
      });
      expect(data.order_number).toMatch(/^ORD-\d{8}$/);
      expect(data.items).toHaveLength(2);

      const orders = await q('select * from public.orders where buyer_id = :id', { id: BUYER_A });
      expect(orders).toHaveLength(1);
      expect(orders[0].shipping_address).toMatchObject({
        full_name: 'Aaron Florez',
        phone: '71234567',
        street: '123 Main St',
        country: 'BO',
      });
      const items = await q(
        'select product_name, quantity, unit_price, subtotal from public.order_items order by product_name'
      );
      expect(
        items.map((i) => [i.product_name, i.quantity, Number(i.unit_price), Number(i.subtotal)])
      ).toEqual([
        ['Clean Code', 2, 20, 40],
        ['DDD', 1, 15.5, 15.5],
      ]);

      expect(await stockOf(P1)).toBe(3);
      expect(await stockOf(P2)).toBe(2);

      const payments = await q('select * from public.payments');
      expect(payments).toHaveLength(1);
      expect(payments[0]).toMatchObject({
        status: 'pending',
        method: 'simulated',
        currency: 'USD',
      });
      expect(Number(payments[0].amount)).toBe(55.5);
      expect(payments[0].order_id).toBe(orders[0].id);

      // OrderPlaced waiting in the outbox (NOT published by the request)
      const events = await q('select * from public.outbox_events');
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        event_type: 'OrderPlaced',
        routing_key: 'order.placed',
        aggregate_type: 'order',
        aggregate_id: orders[0].id,
        status: 'pending',
        attempts: 0,
      });
      expect(events[0].payload).toEqual({
        order_id: orders[0].id,
        order_number: orders[0].order_number,
        buyer_id: BUYER_A,
        total: 55.5,
        currency: 'USD',
        item_count: 2,
        seller_ids: [SELLER],
      });

      expect(await count('public.cart_items', 'user_id = :id', { id: BUYER_A })).toBe(0);
    });

    it('charges the flat shipping fee below US$ 50 and satisfies the total consistency constraint', async () => {
      await addProduct(P1, { name: 'Jump Rope', price: 16.99, stock: 10 });
      await addToCart(BUYER_A, P1, 1);

      const { data } = await useCase.execute(request());

      expect(data.subtotal).toBe(16.99);
      expect(data.shipping_cost).toBe(4.99);
      expect(data.total).toBe(21.98);
    });

    it('stores the payment method chosen by the buyer', async () => {
      await addProduct(P1, { name: 'Clean Code', price: 20, stock: 5 });
      await addToCart(BUYER_A, P1, 1);

      await useCase.execute(request(BUYER_A, null, 'cash_on_delivery'));

      const [payment] = await q('select method, status from public.payments');
      expect(payment).toEqual({ method: 'cash_on_delivery', status: 'pending' });
    });

    it('returns the same Order shape as GET /v1/orders and GET /v1/orders/:id', async () => {
      await addProduct(P1, { name: 'Clean Code', price: 20, stock: 5 });
      await addProduct(P2, { name: 'DDD', price: 15.5, stock: 3 });
      await addToCart(BUYER_A, P1, 2);
      await addToCart(BUYER_A, P2, 1);
      const orderRepository = new OrderRepository({ db: sequelize });

      const { data: created } = await useCase.execute(request(BUYER_A, 'Leave at reception'));
      const { data: listed } = await new ListOrdersUseCase({ orderRepository }).execute(
        new ListOrdersRequestDTO({ buyerId: BUYER_A })
      );
      const { data: detail } = await new GetOrderByIdUseCase({ orderRepository }).execute({
        orderId: created.id,
        userId: BUYER_A,
      });

      // Items share created_at (same transaction), so their read order is not guaranteed.
      const byItemId = (order) => ({
        ...order,
        items: [...order.items].sort((a, b) => a.id.localeCompare(b.id)),
      });
      expect(listed).toHaveLength(1);
      expect(byItemId(listed[0])).toEqual(byItemId(created));
      expect(byItemId(detail)).toEqual(byItemId(created));
    });

    it("does not touch another buyer's cart", async () => {
      await addProduct(P1, { name: 'Clean Code', price: 20, stock: 10 });
      await addToCart(BUYER_A, P1, 1);
      await addToCart(BUYER_B, P1, 2);

      await useCase.execute(request(BUYER_A));

      expect(await count('public.cart_items', 'user_id = :id', { id: BUYER_B })).toBe(1);
      expect(await stockOf(P1)).toBe(9);
    });
  });

  describe('Scenario: empty cart', () => {
    it('rejects with EMPTY_CART and writes nothing', async () => {
      await expect(useCase.execute(request())).rejects.toMatchObject({
        statusCode: 422,
        code: 'EMPTY_CART',
        message: 'Your cart is empty',
      });

      expect(await count('public.orders')).toBe(0);
      expect(await count('public.outbox_events')).toBe(0);
    });
  });

  describe('Scenario: insufficient stock during checkout', () => {
    it('rolls EVERYTHING back (earlier stock decrements included) and keeps the cart', async () => {
      await addProduct(P1, { name: 'Plenty', price: 10, stock: 5 });
      await addProduct(P2, { name: 'Scarce Item', price: 10, stock: 2 });
      await addToCart(BUYER_A, P1, 1); // reserved first (lower id) …
      await addToCart(BUYER_A, P2, 3); // … then this one fails

      await expect(useCase.execute(request())).rejects.toMatchObject({
        statusCode: 422,
        code: 'INSUFFICIENT_STOCK',
        message: 'Insufficient stock for Scarce Item',
        details: [{ field: `items.${P2}`, message: 'Insufficient stock for Scarce Item' }],
      });

      expect(await stockOf(P1)).toBe(5); // the earlier decrement was undone
      expect(await stockOf(P2)).toBe(2);
      expect(await count('public.orders')).toBe(0);
      expect(await count('public.order_items')).toBe(0);
      expect(await count('public.payments')).toBe(0);
      expect(await count('public.outbox_events')).toBe(0);
      expect(await count('public.cart_items', 'user_id = :id', { id: BUYER_A })).toBe(2);
    });

    it('rejects a product that was unpublished after being added to the cart', async () => {
      await addProduct(P1, { name: 'Gone Soon', price: 10, stock: 5 });
      await addToCart(BUYER_A, P1, 1);
      await sequelize.query("update public.products set state = 'unpublished' where id = :id", {
        replacements: { id: P1 },
      });

      await expect(useCase.execute(request())).rejects.toMatchObject({
        statusCode: 422,
        code: 'PRODUCT_UNAVAILABLE',
      });
      expect(await stockOf(P1)).toBe(5);
      expect(await count('public.cart_items')).toBe(1);
    });
  });

  describe('Scenario: concurrent checkout', () => {
    it('only ONE of two buyers gets the last unit; the other receives a stock error', async () => {
      // Repeated rounds make an accidental pass by luck practically impossible.
      for (let round = 0; round < 10; round += 1) {
        await sequelize.query(`
          delete from public.outbox_events;
          delete from public.payments;
          delete from public.order_items;
          delete from public.orders;
          delete from public.cart_items;
          delete from public.products;
        `);
        await addProduct(P1, { name: 'Last Unit', price: 30, stock: 1 });
        await addToCart(BUYER_A, P1, 1);
        await addToCart(BUYER_B, P1, 1);

        const results = await Promise.allSettled([
          useCase.execute(request(BUYER_A)),
          useCase.execute(request(BUYER_B)),
        ]);

        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');
        expect(fulfilled, `round ${round}`).toHaveLength(1);
        expect(rejected, `round ${round}`).toHaveLength(1);
        expect(rejected[0].reason).toMatchObject({
          statusCode: 422,
          code: 'INSUFFICIENT_STOCK',
          message: 'Insufficient stock for Last Unit',
        });

        expect(await stockOf(P1)).toBe(0); // never negative
        expect(await count('public.orders')).toBe(1);
        expect(await count('public.payments')).toBe(1);
        expect(await count('public.outbox_events')).toBe(1);

        // The winner's cart is cleared, the loser's cart is untouched.
        const winner = fulfilled[0].value.data.buyer_id;
        const loser = winner === BUYER_A ? BUYER_B : BUYER_A;
        expect(await count('public.cart_items', 'user_id = :id', { id: winner })).toBe(0);
        expect(await count('public.cart_items', 'user_id = :id', { id: loser })).toBe(1);
      }
    }, 60_000);

    it('buyers racing over several products in opposite cart order do not deadlock', async () => {
      await addProduct(P1, { name: 'One', price: 10, stock: 1 });
      await addProduct(P2, { name: 'Two', price: 10, stock: 1 });
      await addProduct(P3, { name: 'Three', price: 10, stock: 1 });
      for (const p of [P1, P2, P3]) {
        await addToCart(BUYER_A, p, 1);
        await addToCart(BUYER_B, p, 1);
      }

      const results = await Promise.allSettled([
        useCase.execute(request(BUYER_A)),
        useCase.execute(request(BUYER_B)),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const [failure] = results.filter((r) => r.status === 'rejected');
      expect(failure.reason.code).toBe('INSUFFICIENT_STOCK'); // not a deadlock (40P01) error
    }, 30_000);

    it('a double-submit by the SAME buyer creates a single order (cart rows are locked)', async () => {
      await addProduct(P1, { name: 'Plenty', price: 10, stock: 10 });
      await addToCart(BUYER_A, P1, 1);

      const results = await Promise.allSettled([
        useCase.execute(request(BUYER_A)),
        useCase.execute(request(BUYER_A)),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const [failure] = results.filter((r) => r.status === 'rejected');
      expect(failure.reason.code).toBe('EMPTY_CART');
      expect(await count('public.orders')).toBe(1);
      expect(await stockOf(P1)).toBe(9);
    }, 30_000);
  });

  describe('Scenario: transaction failure', () => {
    it('rolls back the order, stock and outbox when the payment insert fails', async () => {
      await addProduct(P1, { name: 'Clean Code', price: 20, stock: 5 });
      await addToCart(BUYER_A, P1, 2);
      vi.spyOn(paymentRepository, 'createPending').mockRejectedValue(
        new Error('simulated database failure')
      );

      await expect(useCase.execute(request())).rejects.toThrow('simulated database failure');

      // The order row WAS inserted before the failure — it must be gone now.
      expect(await count('public.orders')).toBe(0);
      expect(await count('public.order_items')).toBe(0);
      expect(await count('public.outbox_events')).toBe(0);
      expect(await stockOf(P1)).toBe(5);
      expect(await count('public.cart_items', 'user_id = :id', { id: BUYER_A })).toBe(1);
    });

    it('rolls back when the outbox insert violates a constraint', async () => {
      await addProduct(P1, { name: 'Clean Code', price: 20, stock: 5 });
      await addToCart(BUYER_A, P1, 1);
      const outbox = new OutboxRepository({ db: sequelize });
      vi.spyOn(outbox, 'enqueue').mockImplementation((event, options) =>
        // Invalid routing key type → NOT NULL violation inside the same transaction.
        new OutboxRepository({ db: sequelize }).enqueue({ ...event, routingKey: null }, options)
      );
      useCase = new CreateOrderUseCase({
        transactionManager: new SequelizeTransactionManager({ db: sequelize }),
        cartRepository: new CartRepository({ db: sequelize }),
        inventoryService: new InventoryService({
          productRepository: new ProductRepository({ db: sequelize }),
        }),
        pricingService: new OrderPricingService(),
        orderRepository: new OrderRepository({ db: sequelize }),
        paymentRepository,
        outboxRepository: outbox,
      });

      await expect(useCase.execute(request())).rejects.toThrow();

      expect(await count('public.orders')).toBe(0);
      expect(await count('public.payments')).toBe(0);
      expect(await stockOf(P1)).toBe(5);
      expect(await count('public.cart_items')).toBe(1);
    });
  });
});
