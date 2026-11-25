import { describe, it, expect } from 'vitest';
import { Order } from '../entities/Order.js';
import { OrderItem } from '../entities/OrderItem.js';

describe('Order Domain Entity', () => {
  const validOrderData = {
    id: '9d1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a',
    orderNumber: 'ORD-00100042',
    buyerId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    status: 'pending',
    currency: 'USD',
    subtotal: 100.0,
    shippingCost: 10.0,
    tax: 5.0,
    total: 115.0,
    shippingAddress: {
      street: '123 Main St',
      city: 'La Paz',
      country: 'BO',
    },
    notes: 'Please leave at the door',
    createdAt: new Date('2026-10-14T11:00:00.000Z'),
    updatedAt: new Date('2026-10-14T11:00:00.000Z'),
    items: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        orderId: '9d1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a',
        productName: 'Poncho',
        quantity: 1,
        unitPrice: 100.0,
      },
    ],
  };

  it('creates a valid Order entity', () => {
    const order = new Order(validOrderData);
    expect(order.id).toBe(validOrderData.id);
    expect(order.orderNumber).toBe('ORD-00100042');
    expect(order.buyerId).toBe(validOrderData.buyerId);
    expect(order.status).toBe('pending');
    expect(order.currency).toBe('USD');
    expect(order.subtotal).toBe(100.0);
    expect(order.shippingCost).toBe(10.0);
    expect(order.tax).toBe(5.0);
    expect(order.total).toBe(115.0);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].productName).toBe('Poncho');
  });

  it('supports snake_case parameters in constructor', () => {
    const order = new Order({
      id: validOrderData.id,
      order_number: 'ORD-00100042',
      buyer_id: validOrderData.buyerId,
      status: 'confirmed',
      currency: 'BOB',
      subtotal: 50,
      shipping_cost: 5,
      tax: 0,
      total: 55,
      shipping_address: validOrderData.shippingAddress,
    });
    expect(order.orderNumber).toBe('ORD-00100042');
    expect(order.buyerId).toBe(validOrderData.buyerId);
    expect(order.status).toBe('confirmed');
    expect(order.currency).toBe('BOB');
    expect(order.total).toBe(55);
  });

  it('throws TypeError when orderNumber or buyerId is missing', () => {
    expect(() => new Order({ ...validOrderData, orderNumber: '' })).toThrow(TypeError);
    expect(() => new Order({ ...validOrderData, buyerId: '' })).toThrow(TypeError);
  });

  it('throws RangeError when status or currency is invalid', () => {
    expect(() => new Order({ ...validOrderData, status: 'invalid_status' })).toThrow(RangeError);
    expect(() => new Order({ ...validOrderData, currency: 'XYZ' })).toThrow(RangeError);
  });

  it('throws RangeError when financial values are negative', () => {
    expect(() => new Order({ ...validOrderData, subtotal: -1 })).toThrow(RangeError);
    expect(() => new Order({ ...validOrderData, shippingCost: -5 })).toThrow(RangeError);
  });

  it('converts to JSON matching Order schema', () => {
    const order = new Order(validOrderData);
    const json = order.toJSON();
    expect(json.id).toBe(validOrderData.id);
    expect(json.order_number).toBe('ORD-00100042');
    expect(json.buyer_id).toBe(validOrderData.buyerId);
    expect(json.status).toBe('pending');
    expect(json.total).toBe(115.0);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].product_name).toBe('Poncho');
  });

  it('applies defaults and computes the total when it is omitted', () => {
    const order = new Order({
      orderNumber: 'ORD-2',
      buyerId: 'buyer-1',
      subtotal: '10',
      shippingCost: '2',
      tax: '1',
    });

    expect(order.id).toBeNull();
    expect(order.status).toBe('pending');
    expect(order.currency).toBe('USD');
    expect(order.subtotal).toBe(10);
    expect(order.shippingCost).toBe(2);
    expect(order.tax).toBe(1);
    expect(order.total).toBe(13);
    expect(order.shippingAddress).toBeNull();
    expect(order.notes).toBeNull();
    expect(order.cancellationReason).toBeNull();
    expect(order.items).toEqual([]);
    expect(Object.isFrozen(order)).toBe(true);
  });

  it('requires an object argument and a valid order number', () => {
    expect(() => new Order()).toThrow(TypeError);
    expect(() => new Order({ ...validOrderData, orderNumber: 123 })).toThrow(TypeError);
    expect(() => new Order({ ...validOrderData, buyerId: 123 })).toThrow(TypeError);
  });

  it('rejects negative tax and negative explicit total', () => {
    expect(() => new Order({ ...validOrderData, tax: -1 })).toThrow(RangeError);
    expect(() => new Order({ ...validOrderData, total: -1 })).toThrow(RangeError);
  });

  it('accepts snake_case aliases for every optional field', () => {
    const order = new Order({
      id: null,
      order_number: 'ORD-3',
      buyer_id: 'buyer-2',
      status: 'cancelled',
      currency: 'BOB',
      subtotal: 20,
      shipping_cost: 3,
      tax: 1,
      total: 24,
      shipping_address: { city: 'Cochabamba' },
      cancellation_reason: '  Changed mind  ',
      confirmed_at: '2026-10-15T10:00:00.000Z',
      shipped_at: '2026-10-16T10:00:00.000Z',
      delivered_at: '2026-10-17T10:00:00.000Z',
      cancelled_at: '2026-10-18T10:00:00.000Z',
      created_at: '2026-10-14T10:00:00.000Z',
      updated_at: '2026-10-18T10:00:00.000Z',
      items: undefined,
    });

    expect(order.orderNumber).toBe('ORD-3');
    expect(order.buyerId).toBe('buyer-2');
    expect(order.shippingAddress).toEqual({ city: 'Cochabamba' });
    expect(order.cancellationReason).toBe('Changed mind');
    expect(order.confirmedAt).toEqual(new Date('2026-10-15T10:00:00.000Z'));
    expect(order.shippedAt).toEqual(new Date('2026-10-16T10:00:00.000Z'));
    expect(order.deliveredAt).toEqual(new Date('2026-10-17T10:00:00.000Z'));
    expect(order.cancelledAt).toEqual(new Date('2026-10-18T10:00:00.000Z'));
    expect(order.createdAt).toEqual(new Date('2026-10-14T10:00:00.000Z'));
    expect(order.updatedAt).toEqual(new Date('2026-10-18T10:00:00.000Z'));
    expect(order.items).toEqual([]);
  });

  it('normalizes falsy notes and cancellation reasons to null', () => {
    const order = new Order({
      ...validOrderData,
      notes: 0,
      cancellationReason: '',
      shippingAddress: null,
      confirmedAt: null,
      confirmed_at: null,
      shippedAt: null,
      deliveredAt: null,
      cancelledAt: null,
    });

    expect(order.notes).toBeNull();
    expect(order.cancellationReason).toBeNull();
    expect(order.confirmedAt).toBeNull();
    expect(order.shippedAt).toBeNull();
    expect(order.deliveredAt).toBeNull();
    expect(order.cancelledAt).toBeNull();
    expect(order.toJSON()).toEqual(
      expect.objectContaining({
        notes: null,
        cancellation_reason: null,
        confirmed_at: null,
        shipped_at: null,
        delivered_at: null,
        cancelled_at: null,
      })
    );
  });

  it('returns defensive copies from timestamp getters and items', () => {
    const order = new Order({
      ...validOrderData,
      confirmedAt: new Date('2026-10-15T10:00:00.000Z'),
      shippedAt: new Date('2026-10-16T10:00:00.000Z'),
      deliveredAt: new Date('2026-10-17T10:00:00.000Z'),
      cancelledAt: new Date('2026-10-18T10:00:00.000Z'),
    });

    const getters = [
      () => order.confirmedAt,
      () => order.shippedAt,
      () => order.deliveredAt,
      () => order.cancelledAt,
      () => order.createdAt,
      () => order.updatedAt,
    ];
    for (const getter of getters) {
      expect(getter()).not.toBe(getter());
      expect(getter()).toEqual(getter());
    }

    const items = order.items;
    items.pop();
    expect(order.items).toHaveLength(1);
  });

  it('preserves OrderItem instances and converts plain items', () => {
    const existingItem = new OrderItem({
      orderId: validOrderData.id,
      productName: 'Existing',
      quantity: 1,
      unitPrice: 5,
    });
    const order = new Order({
      ...validOrderData,
      items: [
        existingItem,
        { orderId: validOrderData.id, productName: 'Plain', quantity: 2, unitPrice: 3 },
      ],
    });

    expect(order.items[0]).toBe(existingItem);
    expect(order.items[1]).toBeInstanceOf(OrderItem);
    expect(order.items[1].productName).toBe('Plain');
  });

  it('ignores a non-array items value', () => {
    const order = new Order({ ...validOrderData, items: 'not-an-array' });

    expect(order.items).toEqual([]);
    expect(order.toJSON().items).toEqual([]);
  });

  it('returns null from every timestamp getter when no timestamps are provided', () => {
    const order = new Order({ orderNumber: 'ORD-NO-DATES', buyerId: 'buyer-1' });

    expect(order.confirmedAt).toBeNull();
    expect(order.shippedAt).toBeNull();
    expect(order.deliveredAt).toBeNull();
    expect(order.cancelledAt).toBeNull();
    expect(order.createdAt).toBeNull();
    expect(order.updatedAt).toBeNull();
  });

  it('serializes non-null status timestamps in toJSON', () => {
    const order = new Order({
      ...validOrderData,
      confirmedAt: '2026-10-15T10:00:00.000Z',
      shippedAt: '2026-10-16T10:00:00.000Z',
      deliveredAt: '2026-10-17T10:00:00.000Z',
      cancelledAt: '2026-10-18T10:00:00.000Z',
    });

    expect(order.toJSON()).toEqual(
      expect.objectContaining({
        confirmed_at: '2026-10-15T10:00:00.000Z',
        shipped_at: '2026-10-16T10:00:00.000Z',
        delivered_at: '2026-10-17T10:00:00.000Z',
        cancelled_at: '2026-10-18T10:00:00.000Z',
        created_at: '2026-10-14T11:00:00.000Z',
        updated_at: '2026-10-14T11:00:00.000Z',
      })
    );
  });

  it('serializes null creation and update timestamps when they are omitted', () => {
    const json = new Order({ orderNumber: 'ORD-NO-DATES-2', buyerId: 'buyer-1' }).toJSON();

    expect(json.created_at).toBeNull();
    expect(json.updated_at).toBeNull();
  });
});
