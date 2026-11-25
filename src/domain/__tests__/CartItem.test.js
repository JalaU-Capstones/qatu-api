import { describe, expect, it } from 'vitest';
import { CartItem } from '../entities/CartItem.js';

describe('CartItem Domain Entity', () => {
  const base = { userId: 'user-1', productId: 'product-1', quantity: 2 };

  it('creates a cart item with defaults and trims identifiers', () => {
    const item = new CartItem({ ...base, userId: '  user-1  ', productId: ' product-1 ' });

    expect(item.id).toBeNull();
    expect(item.userId).toBe('user-1');
    expect(item.user_id).toBe('user-1');
    expect(item.productId).toBe('product-1');
    expect(item.product_id).toBe('product-1');
    expect(item.quantity).toBe(2);
    expect(item.createdAt).toBeNull();
    expect(item.created_at).toBeNull();
    expect(item.updatedAt).toBeNull();
    expect(item.updated_at).toBeNull();
  });

  it('accepts snake_case aliases and string dates', () => {
    const item = new CartItem({
      id: 'cart-item-1',
      user_id: 'user-2',
      product_id: 'product-2',
      quantity: 3,
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-02T00:00:00.000Z',
    });

    expect(item.id).toBe('cart-item-1');
    expect(item.userId).toBe('user-2');
    expect(item.productId).toBe('product-2');
    expect(item.createdAt).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    expect(item.created_at).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    expect(item.updatedAt).toEqual(new Date('2026-10-02T00:00:00.000Z'));
  });

  it('prefers camelCase over snake_case and Date instances over strings', () => {
    const createdAt = new Date('2026-10-03T00:00:00.000Z');
    const updatedAt = new Date('2026-10-04T00:00:00.000Z');
    const item = new CartItem({
      userId: 'camel-user',
      user_id: 'snake-user',
      productId: 'camel-product',
      product_id: 'snake-product',
      quantity: 1,
      createdAt,
      created_at: '2020-01-01T00:00:00.000Z',
      updatedAt,
      updated_at: '2020-01-01T00:00:00.000Z',
    });

    expect(item.userId).toBe('camel-user');
    expect(item.productId).toBe('camel-product');
    expect(item.createdAt).toEqual(createdAt);
    expect(item.updatedAt).toEqual(updatedAt);
  });

  it('falls back to snake_case timestamps when camelCase values are null', () => {
    const item = new CartItem({
      ...base,
      createdAt: null,
      created_at: '2026-10-05T00:00:00.000Z',
      updatedAt: null,
      updated_at: '2026-10-06T00:00:00.000Z',
    });

    expect(item.createdAt).toEqual(new Date('2026-10-05T00:00:00.000Z'));
    expect(item.updatedAt).toEqual(new Date('2026-10-06T00:00:00.000Z'));
  });

  it('treats empty timestamp strings as null', () => {
    const item = new CartItem({ ...base, createdAt: '', updatedAt: '' });

    expect(item.createdAt).toBeNull();
    expect(item.updatedAt).toBeNull();
    expect(item.toJSON()).toEqual({
      id: null,
      userId: 'user-1',
      productId: 'product-1',
      quantity: 2,
      createdAt: null,
      updatedAt: null,
    });
  });

  it('serializes timestamps as ISO strings', () => {
    const item = new CartItem({
      ...base,
      id: 'cart-item-2',
      createdAt: '2026-10-07T00:00:00.000Z',
      updatedAt: '2026-10-08T00:00:00.000Z',
    });

    expect(item.toJSON()).toEqual({
      id: 'cart-item-2',
      userId: 'user-1',
      productId: 'product-1',
      quantity: 2,
      createdAt: '2026-10-07T00:00:00.000Z',
      updatedAt: '2026-10-08T00:00:00.000Z',
    });
  });

  it('rejects missing, empty or non-string userId', () => {
    expect(() => new CartItem({ productId: 'p', quantity: 1 })).toThrow(TypeError);
    expect(() => new CartItem({ ...base, userId: '' })).toThrow('CartItem userId is required');
    expect(() => new CartItem({ ...base, userId: '   ' })).toThrow(TypeError);
    expect(() => new CartItem({ ...base, userId: 123 })).toThrow(TypeError);
  });

  it('rejects missing, empty or non-string productId', () => {
    expect(() => new CartItem({ userId: 'u', quantity: 1 })).toThrow(TypeError);
    expect(() => new CartItem({ ...base, productId: '' })).toThrow(
      'CartItem productId is required'
    );
    expect(() => new CartItem({ ...base, productId: '  ' })).toThrow(TypeError);
    expect(() => new CartItem({ ...base, productId: 42 })).toThrow(TypeError);
  });

  it('rejects non-integer and non-positive quantities', () => {
    for (const quantity of [0, -1, 1.5, undefined, NaN, '2']) {
      expect(() => new CartItem({ ...base, quantity })).toThrow(RangeError);
    }
  });

  it('withQuantity returns a new frozen instance preserving identity and creation date', () => {
    const original = new CartItem({
      ...base,
      id: 'cart-item-3',
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    });

    const updated = original.withQuantity(7);

    expect(updated).not.toBe(original);
    expect(updated.id).toBe('cart-item-3');
    expect(updated.userId).toBe('user-1');
    expect(updated.productId).toBe('product-1');
    expect(updated.quantity).toBe(7);
    expect(updated.createdAt).toEqual(original.createdAt);
    expect(updated.updatedAt).toBeInstanceOf(Date);
    expect(Object.isFrozen(updated)).toBe(true);
    expect(original.quantity).toBe(2);
  });

  it('withQuantity validates the new quantity with the constructor rules', () => {
    const item = new CartItem(base);

    expect(() => item.withQuantity(0)).toThrow(RangeError);
    expect(() => item.withQuantity(1.2)).toThrow(RangeError);
  });
});
