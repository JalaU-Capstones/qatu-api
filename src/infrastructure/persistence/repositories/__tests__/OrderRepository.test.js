import { describe, expect, it, vi } from 'vitest';
import { Order } from '../../../../domain/entities/Order.js';
import { OrderRepository } from '../OrderRepository.js';

describe('OrderRepository', () => {
  const buyerId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const orderId = '9d1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a';

  describe('createWithItems', () => {
    const orderRow = {
      id: orderId,
      order_number: 'ORD-00100042',
      buyer_id: buyerId,
      status: 'pending',
      currency: 'USD',
      subtotal: '40.00',
      shipping_cost: '4.99',
      tax: '0.00',
      total: '44.99',
      shipping_address: { street: '123 Main St', city: 'La Paz', country: 'BO' },
      notes: null,
      cancellation_reason: null,
      confirmed_at: null,
      shipped_at: null,
      delivered_at: null,
      cancelled_at: null,
      created_at: '2026-11-01T10:00:00.000Z',
      updated_at: '2026-11-01T10:00:00.000Z',
    };
    const itemRow = {
      id: 'oi-1',
      order_id: orderId,
      product_id: 'p-1',
      product_name: 'Clean Code',
      product_image_path: null,
      quantity: 2,
      unit_price: '20.00',
      subtotal: '40.00',
      created_at: '2026-11-01T10:00:00.000Z',
    };
    const params = {
      buyerId,
      currency: 'USD',
      subtotal: 40,
      shippingCost: 4.99,
      tax: 0,
      total: 44.99,
      shippingAddress: { street: '123 Main St', city: 'La Paz', country: 'BO' },
      notes: null,
      items: [
        {
          productId: 'p-1',
          productName: 'Clean Code',
          productImagePath: null,
          quantity: 2,
          unitPrice: 20,
        },
      ],
    };

    it('inserts the order then each item inside the given transaction', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValueOnce([orderRow]).mockResolvedValueOnce([itemRow]),
      };
      const repo = new OrderRepository({ db: mockDb });
      const transaction = { id: 'tx' };

      const order = await repo.createWithItems(params, { transaction });

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      const [orderSql, orderOptions] = mockDb.query.mock.calls[0];
      expect(orderSql).toContain('INSERT INTO public.orders');
      expect(orderSql).toContain("'pending'");
      expect(orderSql).toContain('CAST(:shippingAddress AS jsonb)');
      expect(orderOptions.transaction).toBe(transaction);
      expect(orderOptions.replacements.shippingAddress).toBe(
        JSON.stringify(params.shippingAddress)
      );

      const [itemSql, itemOptions] = mockDb.query.mock.calls[1];
      expect(itemSql).toContain('INSERT INTO public.order_items');
      // `subtotal` is a generated column: it must never be inserted.
      expect(itemSql.split('VALUES')[0]).not.toContain('subtotal');
      expect(itemOptions.transaction).toBe(transaction);
      expect(itemOptions.replacements).toMatchObject({ orderId, productId: 'p-1', quantity: 2 });

      expect(order.id).toBe(orderId);
      expect(order.orderNumber).toBe('ORD-00100042');
      expect(order.total).toBe(44.99);
      expect(order.items).toHaveLength(1);
      expect(order.items[0].subtotal).toBe(40);
    });

    it('recomputes a null generated subtotal from quantity and unit price', async () => {
      const mockDb = {
        query: vi
          .fn()
          .mockResolvedValueOnce([orderRow])
          .mockResolvedValueOnce([{ ...itemRow, subtotal: null }]),
      };
      const repo = new OrderRepository({ db: mockDb });

      const order = await repo.createWithItems(params);

      expect(order.items[0].subtotal).toBe(40);
    });

    it('throws when the database returns no order row', async () => {
      const mockDb = { query: vi.fn().mockResolvedValueOnce([]) };
      const repo = new OrderRepository({ db: mockDb });

      await expect(repo.createWithItems(params)).rejects.toThrow('no row returned');
    });
  });

  it('findByBuyerId returns empty list when total is 0', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValueOnce([{ total: '0' }]),
    };
    const repo = new OrderRepository({ db: mockDb });

    const result = await repo.findByBuyerId({ buyerId, page: 1, limit: 10 });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(mockDb.query).toHaveBeenCalledTimes(1);
  });

  it('findByBuyerId queries orders and items when records exist', async () => {
    const mockDb = {
      query: vi
        .fn()
        .mockResolvedValueOnce([{ total: '1' }]) // COUNT
        .mockResolvedValueOnce([
          {
            id: orderId,
            order_number: 'ORD-00100042',
            buyer_id: buyerId,
            status: 'pending',
            currency: 'USD',
            subtotal: '100.00',
            shipping_cost: '10.00',
            tax: '0.00',
            total: '110.00',
            created_at: new Date('2026-10-14T11:00:00.000Z'),
            updated_at: new Date('2026-10-14T11:00:00.000Z'),
          },
        ]) // ORDERS
        .mockResolvedValueOnce([
          {
            id: 'item-1',
            order_id: orderId,
            product_name: 'Alpaca Scarf',
            quantity: 2,
            unit_price: '50.00',
            subtotal: '100.00',
            created_at: new Date('2026-10-14T11:00:00.000Z'),
          },
        ]), // ITEMS
    };

    const repo = new OrderRepository({ db: mockDb });
    const result = await repo.findByBuyerId({ buyerId, page: 1, limit: 10 });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].orderNumber).toBe('ORD-00100042');
    expect(result.items[0].items).toHaveLength(1);
    expect(result.items[0].items[0].productName).toBe('Alpaca Scarf');
  });

  it('findById returns null when order does not exist', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValueOnce([]),
    };
    const repo = new OrderRepository({ db: mockDb });
    const result = await repo.findById('non-existent');
    expect(result).toBeNull();
  });

  describe('seller visibility (ADR-017: own line items only, full-order totals)', () => {
    const sellerId = 'c2aad099-7c2b-5ef8-bb6d-7bb9bd380c33';
    const sellerOrderRow = {
      id: orderId,
      order_number: 'ORD-00100042',
      buyer_id: buyerId,
      status: 'confirmed',
      currency: 'USD',
      subtotal: '265.00',
      shipping_cost: '10.00',
      tax: '0.00',
      total: '275.00', // FULL order total, even though the seller owns only one line
      created_at: new Date('2026-10-14T11:00:00.000Z'),
      updated_at: new Date('2026-10-14T11:00:00.000Z'),
    };
    const ownItemRow = {
      id: 'item-own',
      order_id: orderId,
      product_id: 'p-own',
      product_name: 'Own product',
      quantity: 1,
      unit_price: '100.00',
      subtotal: '100.00',
      created_at: new Date('2026-10-14T11:00:00.000Z'),
    };

    /**
     * The items query is the one that SELECTs item columns. The orders/count queries also
     * mention `public.order_items` (inside EXISTS), so match on the select list instead.
     */
    const itemsQueryCall = (mockDb) =>
      mockDb.query.mock.calls.find(([sql]) => sql.includes('SELECT oi.id, oi.order_id'));

    it('findBySellerId restricts orders AND returned items to the seller (SQL + params)', async () => {
      const mockDb = {
        query: vi
          .fn()
          .mockResolvedValueOnce([{ total: '1' }]) // COUNT
          .mockResolvedValueOnce([sellerOrderRow]) // ORDERS
          .mockResolvedValueOnce([ownItemRow]), // ITEMS (already filtered by SQL)
      };
      const repo = new OrderRepository({ db: mockDb });

      const result = await repo.findBySellerId({ sellerId, page: 1, limit: 10 });

      // Orders: only those that contain at least one of the seller's products.
      for (const [sql, options] of mockDb.query.mock.calls.slice(0, 2)) {
        expect(sql).toContain('p.seller_id = :sellerId');
        expect(options.replacements.sellerId).toBe(sellerId);
      }

      // Items: joined to products and filtered, so another seller's lines never load.
      const [itemsSql, itemsOptions] = itemsQueryCall(mockDb);
      expect(itemsSql).toContain('INNER JOIN public.products p ON p.id = oi.product_id');
      expect(itemsSql).toContain('p.seller_id = :sellerId');
      expect(itemsOptions.replacements.sellerId).toBe(sellerId);

      expect(result.items[0].items.map((i) => i.productName)).toEqual(['Own product']);
      expect(result.items[0].total).toBe(275); // totals stay full-order
    });

    it('findByBuyerId and findAll do NOT filter items by seller (full order)', async () => {
      const buyerDb = {
        query: vi
          .fn()
          .mockResolvedValueOnce([{ total: '1' }])
          .mockResolvedValueOnce([sellerOrderRow])
          .mockResolvedValueOnce([ownItemRow]),
      };
      await new OrderRepository({ db: buyerDb }).findByBuyerId({ buyerId });
      const [buyerItemsSql, buyerItemsOptions] = itemsQueryCall(buyerDb);
      expect(buyerItemsSql).not.toContain('seller_id');
      expect(buyerItemsOptions.replacements).not.toHaveProperty('sellerId');

      const adminDb = {
        query: vi
          .fn()
          .mockResolvedValueOnce([{ total: '1' }])
          .mockResolvedValueOnce([sellerOrderRow])
          .mockResolvedValueOnce([ownItemRow]),
      };
      await new OrderRepository({ db: adminDb }).findAll({});
      expect(itemsQueryCall(adminDb)[0]).not.toContain('seller_id');
    });

    it('findByIdForSeller returns null without reading the order when the seller owns no item', async () => {
      const mockDb = { query: vi.fn().mockResolvedValueOnce([]) }; // ownership check -> none
      const repo = new OrderRepository({ db: mockDb });

      const result = await repo.findByIdForSeller(orderId, sellerId);

      expect(result).toBeNull();
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockDb.query.mock.calls[0][1].replacements).toEqual({ orderId, sellerId });
    });

    it('findByIdForSeller loads only the seller items of a multi-seller order', async () => {
      const mockDb = {
        query: vi
          .fn()
          .mockResolvedValueOnce([{ ok: 1 }]) // ownership check
          .mockResolvedValueOnce([sellerOrderRow]) // order
          .mockResolvedValueOnce([ownItemRow]), // items filtered by SQL
      };
      const repo = new OrderRepository({ db: mockDb });

      const order = await repo.findByIdForSeller(orderId, sellerId);

      const [itemsSql, itemsOptions] = itemsQueryCall(mockDb);
      expect(itemsSql).toContain('p.seller_id = :sellerId');
      expect(itemsOptions.replacements).toMatchObject({ orderIds: [orderId], sellerId });
      expect(order.items).toHaveLength(1);
      expect(order.items[0].productName).toBe('Own product');
      expect(order.total).toBe(275);
    });

    it('updateStatus scopes the returned items to itemsSellerId, and not otherwise', async () => {
      const updatedRow = { ...sellerOrderRow, status: 'shipped' };

      const scopedDb = {
        query: vi.fn().mockResolvedValueOnce([updatedRow]).mockResolvedValueOnce([ownItemRow]),
      };
      const scoped = await new OrderRepository({ db: scopedDb }).updateStatus({
        orderId,
        status: 'shipped',
        timestampColumn: 'shipped_at',
        itemsSellerId: sellerId,
      });
      const [scopedSql, scopedOptions] = itemsQueryCall(scopedDb);
      expect(scopedSql).toContain('p.seller_id = :sellerId');
      expect(scopedOptions.replacements.sellerId).toBe(sellerId);
      expect(scoped.status).toBe('shipped');
      expect(scoped.items).toHaveLength(1);

      const fullDb = {
        query: vi.fn().mockResolvedValueOnce([updatedRow]).mockResolvedValueOnce([ownItemRow]),
      };
      await new OrderRepository({ db: fullDb }).updateStatus({ orderId, status: 'shipped' });
      expect(itemsQueryCall(fullDb)[0]).not.toContain('seller_id');
    });
  });

  it('findById returns order with items when found', async () => {
    const mockDb = {
      query: vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: orderId,
            order_number: 'ORD-00100042',
            buyer_id: buyerId,
            status: 'confirmed',
            currency: 'USD',
            subtotal: '50.00',
            shipping_cost: '5.00',
            tax: '0.00',
            total: '55.00',
            created_at: new Date('2026-10-14T11:00:00.000Z'),
          },
        ])
        .mockResolvedValueOnce([]),
    };

    const repo = new OrderRepository({ db: mockDb });
    const result = await repo.findById(orderId);
    expect(result).not.toBeNull();
    expect(result.id).toBe(orderId);
    expect(result.status).toBe('confirmed');
  });
});

const BUYER_ID = 'buyer-1';
const SELLER_ID = 'seller-1';
const ORDER_ID = '9d1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a';

const orderRow = (overrides = {}) => ({
  id: ORDER_ID,
  order_number: 'ORD-1',
  buyer_id: BUYER_ID,
  status: 'pending',
  currency: 'USD',
  subtotal: '10',
  shipping_cost: '1',
  tax: '0',
  total: '11',
  created_at: '2026-11-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z',
  ...overrides,
});

const itemRow = (overrides = {}) => ({
  id: 'oi-1',
  order_id: ORDER_ID,
  product_id: 'p-1',
  product_name: 'Chair',
  product_image_path: null,
  quantity: 2,
  unit_price: '5.00',
  subtotal: null,
  created_at: '2026-11-01T00:00:00.000Z',
  ...overrides,
});

describe('OrderRepository — remaining branches', () => {
  it('uses the shared sequelize instance by default', () => {
    expect(new OrderRepository().db).toBeDefined();
  });

  describe('_pagination through findAll', () => {
    it('sanitizes invalid page and limit values', async () => {
      const db = {
        query: vi
          .fn()
          .mockResolvedValueOnce([{ total: '1' }])
          .mockResolvedValueOnce([]),
      };
      const repository = new OrderRepository({ db });

      await repository.findAll({ page: 'bad', limit: 0, status: 'shipped' });

      expect(db.query.mock.calls[0][1].replacements).toEqual({ status: 'shipped' });
      expect(db.query.mock.calls[1][1].replacements).toMatchObject({
        limit: 20,
        offset: 0,
        status: 'shipped',
      });
      expect(db.query.mock.calls[1][0]).toContain('WHERE status = :status');
    });

    it('caps the limit at 100 and returns early for a zero count', async () => {
      const db = { query: vi.fn().mockResolvedValue([{ total: 0 }]) };
      const repository = new OrderRepository({ db });

      await expect(repository.findAll({ limit: 500 })).resolves.toEqual({ items: [], total: 0 });
      expect(db.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('defensive branches', () => {
    it('tolerates a missing count result in every listing', async () => {
      const db = { query: vi.fn().mockResolvedValue(undefined) };
      const repository = new OrderRepository({ db });

      await expect(repository.findAll()).resolves.toEqual({ items: [], total: 0 });
      await expect(repository.findByBuyerId({ buyerId: BUYER_ID })).resolves.toEqual({
        items: [],
        total: 0,
      });
      await expect(repository.findBySellerId({ sellerId: SELLER_ID })).resolves.toEqual({
        items: [],
        total: 0,
      });
    });

    it('maps orders whose items disappeared after the count', async () => {
      const db = {
        query: vi
          .fn()
          .mockResolvedValueOnce([{ total: '1' }])
          .mockResolvedValueOnce([orderRow()])
          .mockResolvedValueOnce([{ total: '1' }])
          .mockResolvedValueOnce([orderRow()])
          .mockResolvedValueOnce([{ total: '1' }])
          .mockResolvedValueOnce([orderRow()]),
      };
      const repository = new OrderRepository({ db });
      vi.spyOn(repository, '_loadItemsByOrderIds').mockResolvedValue(new Map());

      await expect(repository.findAll()).resolves.toMatchObject({ total: 1 });
      await expect(repository.findByBuyerId({ buyerId: BUYER_ID })).resolves.toMatchObject({
        total: 1,
      });
      await expect(repository.findBySellerId({ sellerId: SELLER_ID })).resolves.toMatchObject({
        total: 1,
      });
      expect(db.query).toHaveBeenCalledTimes(6);
    });

    it('uses the stored subtotal when the item row provides one', async () => {
      const db = { query: vi.fn().mockResolvedValue([itemRow({ subtotal: '7.00' })]) };
      const repository = new OrderRepository({ db });

      const grouped = await repository._loadItemsByOrderIds([ORDER_ID]);

      expect(grouped.get(ORDER_ID)[0].subtotal).toBe(7);
    });

    it('maps a seller order whose items disappeared', async () => {
      const db = { query: vi.fn().mockResolvedValueOnce([orderRow()]) };
      const repository = new OrderRepository({ db });
      vi.spyOn(repository, 'sellerHasItemsOnOrder').mockResolvedValue(true);
      vi.spyOn(repository, '_loadItemsByOrderIds').mockResolvedValue(new Map());

      await expect(repository.findByIdForSeller(ORDER_ID, SELLER_ID)).resolves.toBeInstanceOf(
        Order
      );
    });
  });

  describe('_loadItemsByOrderIds', () => {
    it('returns an empty map for an empty id list without querying', async () => {
      const db = { query: vi.fn() };
      const repository = new OrderRepository({ db });

      await expect(repository._loadItemsByOrderIds([])).resolves.toEqual(new Map());
      expect(db.query).not.toHaveBeenCalled();
    });

    it('groups by seller and tolerates undefined rows and null subtotals', async () => {
      const db = { query: vi.fn().mockResolvedValue([itemRow(), itemRow({ id: 'oi-2' })]) };
      const repository = new OrderRepository({ db });

      const grouped = await repository._loadItemsByOrderIds([ORDER_ID], { sellerId: SELLER_ID });

      expect(grouped.get(ORDER_ID)).toHaveLength(2);
      expect(grouped.get(ORDER_ID)[0].subtotal).toBe(10);
      expect(db.query.mock.calls[0][0]).toContain('p.seller_id = :sellerId');

      db.query.mockResolvedValueOnce(undefined);
      await expect(repository._loadItemsByOrderIds([ORDER_ID])).resolves.toEqual(new Map());
    });
  });

  describe('buyer and seller listings', () => {
    it('findByBuyerId filters by status and handles rows disappearing after the count', async () => {
      const db = {
        query: vi
          .fn()
          .mockResolvedValueOnce([{ total: '1' }])
          .mockResolvedValueOnce([]),
      };
      const repository = new OrderRepository({ db });

      await expect(
        repository.findByBuyerId({ buyerId: BUYER_ID, status: 'confirmed', page: 'x', limit: 'y' })
      ).resolves.toEqual({ items: [], total: 1 });
      expect(db.query.mock.calls[0][1].replacements).toEqual({
        buyerId: BUYER_ID,
        status: 'confirmed',
      });
    });

    it('findByBuyerId maps rows with their items', async () => {
      const db = {
        query: vi
          .fn()
          .mockResolvedValueOnce([{ total: '1' }])
          .mockResolvedValueOnce([orderRow()])
          .mockResolvedValueOnce([itemRow()]),
      };
      const repository = new OrderRepository({ db });

      const result = await repository.findByBuyerId({ buyerId: BUYER_ID });
      expect(result.items[0]).toBeInstanceOf(Order);
      expect(result.items[0].items).toHaveLength(1);
    });

    it('findBySellerId filters by status and handles empty rows', async () => {
      const db = {
        query: vi
          .fn()
          .mockResolvedValueOnce([{ total: '1' }])
          .mockResolvedValueOnce([]),
      };
      const repository = new OrderRepository({ db });

      await expect(
        repository.findBySellerId({ sellerId: SELLER_ID, status: 'delivered' })
      ).resolves.toEqual({ items: [], total: 1 });
      expect(db.query.mock.calls[0][1].replacements.status).toBe('delivered');
    });

    it('findBySellerId returns early when no order matches', async () => {
      const db = { query: vi.fn().mockResolvedValue([{ total: 0 }]) };
      const repository = new OrderRepository({ db });

      await expect(repository.findBySellerId({ sellerId: SELLER_ID })).resolves.toEqual({
        items: [],
        total: 0,
      });
      expect(db.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('findByIdForSeller', () => {
    it('returns null when the seller has no items on the order', async () => {
      const db = { query: vi.fn().mockResolvedValue([]) };
      const repository = new OrderRepository({ db });

      await expect(repository.findByIdForSeller(ORDER_ID, SELLER_ID)).resolves.toBeNull();
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('returns null when the order row disappeared', async () => {
      const db = {
        query: vi
          .fn()
          .mockResolvedValueOnce([{ ok: 1 }])
          .mockResolvedValueOnce([]),
      };
      const repository = new OrderRepository({ db });

      await expect(repository.findByIdForSeller(ORDER_ID, SELLER_ID)).resolves.toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('returns null when no row was updated', async () => {
      const db = { query: vi.fn().mockResolvedValue([]) };
      const repository = new OrderRepository({ db });

      await expect(
        repository.updateStatus({ orderId: ORDER_ID, status: 'shipped' })
      ).resolves.toBeNull();
    });

    it('uses an allowed timestamp and forwards the transaction', async () => {
      const db = {
        query: vi.fn().mockResolvedValueOnce([orderRow()]).mockResolvedValueOnce([itemRow()]),
      };
      const repository = new OrderRepository({ db });
      const transaction = { id: 'tx' };

      const result = await repository.updateStatus({
        orderId: ORDER_ID,
        status: 'shipped',
        timestampColumn: 'shipped_at',
        itemsSellerId: SELLER_ID,
        transaction,
      });

      expect(result).toBeInstanceOf(Order);
      expect(db.query.mock.calls[0][0]).toContain('shipped_at = COALESCE(shipped_at, NOW())');
      expect(db.query.mock.calls[0][1]).toMatchObject({ transaction });
      expect(db.query.mock.calls[1][1].replacements.sellerId).toBe(SELLER_ID);
    });

    it('ignores an unsupported timestamp column', async () => {
      const db = {
        query: vi.fn().mockResolvedValueOnce([orderRow()]).mockResolvedValueOnce([]),
      };
      const repository = new OrderRepository({ db });

      await repository.updateStatus({
        orderId: ORDER_ID,
        status: 'confirmed',
        timestampColumn: 'DROP TABLE',
      });

      expect(db.query.mock.calls[0][0]).not.toContain('DROP TABLE');
      expect(db.query.mock.calls[0][0]).not.toContain('COALESCE');
    });
  });

  describe('findSellerIdsByOrderId', () => {
    it('returns the distinct sellers of the order inside the given transaction', async () => {
      const transaction = { id: 'tx' };
      const db = {
        query: vi
          .fn()
          .mockResolvedValueOnce([{ seller_id: SELLER_ID }, { seller_id: 'seller-2' }, {}]),
      };
      const repository = new OrderRepository({ db });

      await expect(repository.findSellerIdsByOrderId(ORDER_ID, { transaction })).resolves.toEqual([
        SELLER_ID,
        'seller-2',
      ]);
      const [sql, options] = db.query.mock.calls[0];
      expect(sql).toContain('SELECT DISTINCT p.seller_id');
      expect(options).toMatchObject({ replacements: { orderId: ORDER_ID }, transaction });
    });

    it('returns an empty list when the query yields nothing', async () => {
      const repository = new OrderRepository({
        db: { query: vi.fn().mockResolvedValueOnce(null) },
      });

      await expect(repository.findSellerIdsByOrderId(ORDER_ID)).resolves.toEqual([]);
    });
  });
});
