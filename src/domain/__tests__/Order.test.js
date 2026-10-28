import { describe, it, expect } from 'vitest';
import { Order } from '../entities/Order.js';

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
});

