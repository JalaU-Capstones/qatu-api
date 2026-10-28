import { describe, it, expect, vi } from 'vitest';
import { OrderRepository } from '../OrderRepository.js';

describe('OrderRepository', () => {
  const buyerId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const orderId = '9d1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a';

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
