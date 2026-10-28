import { describe, it, expect } from 'vitest';
import { OrderItem } from '../entities/OrderItem.js';

describe('OrderItem Domain Entity', () => {
  const validData = {
    id: '11111111-1111-4111-8111-111111111111',
    orderId: '22222222-2222-4222-8222-222222222222',
    productId: '33333333-3333-4333-8333-333333333333',
    productName: 'Handcrafted Wool Poncho',
    productImagePath: 'https://example.com/poncho.jpg',
    quantity: 2,
    unitPrice: 50.0,
    createdAt: new Date('2026-10-14T10:00:00.000Z'),
  };

  it('creates a valid OrderItem entity', () => {
    const item = new OrderItem(validData);
    expect(item.id).toBe(validData.id);
    expect(item.orderId).toBe(validData.orderId);
    expect(item.productId).toBe(validData.productId);
    expect(item.productName).toBe(validData.productName);
    expect(item.productImagePath).toBe(validData.productImagePath);
    expect(item.quantity).toBe(2);
    expect(item.unitPrice).toBe(50.0);
    expect(item.subtotal).toBe(100.0);
    expect(item.createdAt).toEqual(new Date('2026-10-14T10:00:00.000Z'));
  });

  it('supports snake_case parameters in constructor', () => {
    const item = new OrderItem({
      id: validData.id,
      order_id: validData.orderId,
      product_id: validData.productId,
      product_name: validData.productName,
      product_image_path: validData.productImagePath,
      quantity: 3,
      unit_price: 30.0,
      subtotal: 90.0,
    });
    expect(item.orderId).toBe(validData.orderId);
    expect(item.productName).toBe(validData.productName);
    expect(item.quantity).toBe(3);
    expect(item.unitPrice).toBe(30.0);
    expect(item.subtotal).toBe(90.0);
  });

  it('throws TypeError when orderId is missing', () => {
    expect(() => new OrderItem({ ...validData, orderId: '' })).toThrow(TypeError);
  });

  it('throws TypeError when productName is missing', () => {
    expect(() => new OrderItem({ ...validData, productName: '' })).toThrow(TypeError);
  });

  it('throws RangeError when quantity is less than 1 or not integer', () => {
    expect(() => new OrderItem({ ...validData, quantity: 0 })).toThrow(RangeError);
    expect(() => new OrderItem({ ...validData, quantity: -2 })).toThrow(RangeError);
    expect(() => new OrderItem({ ...validData, quantity: 1.5 })).toThrow(RangeError);
  });

  it('throws RangeError when unitPrice is negative', () => {
    expect(() => new OrderItem({ ...validData, unitPrice: -10 })).toThrow(RangeError);
  });

  it('converts to JSON matching schema', () => {
    const item = new OrderItem(validData);
    const json = item.toJSON();
    expect(json).toEqual({
      id: validData.id,
      order_id: validData.orderId,
      product_id: validData.productId,
      product_name: validData.productName,
      product_image_path: validData.productImagePath,
      quantity: 2,
      unit_price: 50.0,
      subtotal: 100.0,
      created_at: '2026-10-14T10:00:00.000Z',
    });
  });
});
