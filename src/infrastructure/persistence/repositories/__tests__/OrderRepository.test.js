import { describe, it, expect, vi } from 'vitest';
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
