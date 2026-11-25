import { describe, expect, it } from 'vitest';
import { CartItem } from '../../../domain/entities/CartItem.js';
import { AddToCartRequestDTO, AddToCartResponseDTO } from '../AddToCartDTO.js';

describe('AddToCartRequestDTO', () => {
  it('trims identifiers and defaults the quantity to one', () => {
    const dto = new AddToCartRequestDTO({ userId: '  user-1  ', productId: '  product-1  ' });

    expect(dto.userId).toBe('user-1');
    expect(dto.productId).toBe('product-1');
    expect(dto.quantity).toBe(1);
    expect(Object.isFrozen(dto)).toBe(true);
  });

  it('accepts an explicit positive integer quantity', () => {
    expect(new AddToCartRequestDTO({ userId: 'u', productId: 'p', quantity: 3 }).quantity).toBe(3);
    expect(new AddToCartRequestDTO({ userId: 'u', productId: 'p', quantity: null }).quantity).toBe(
      1
    );
  });

  it.each([
    [{}, 'userId is required'],
    [{ userId: 123, productId: 'p' }, 'userId is required'],
    [{ userId: '   ', productId: 'p' }, 'userId is required'],
    [{ userId: 'u' }, 'productId is required'],
    [{ userId: 'u', productId: 123 }, 'productId is required'],
    [{ userId: 'u', productId: '   ' }, 'productId is required'],
    [
      { userId: 'u', productId: 'p', quantity: 0 },
      'quantity must be an integer greater than or equal to 1',
    ],
    [
      { userId: 'u', productId: 'p', quantity: 1.5 },
      'quantity must be an integer greater than or equal to 1',
    ],
    [
      { userId: 'u', productId: 'p', quantity: '2' },
      'quantity must be an integer greater than or equal to 1',
    ],
  ])('rejects invalid payload %j', (payload, message) => {
    expect(() => new AddToCartRequestDTO(payload)).toThrow(message);
    expect(() => new AddToCartRequestDTO(payload)).toThrow(
      expect.objectContaining({ statusCode: 400, code: 'VALIDATION_ERROR' })
    );
  });
});

describe('AddToCartResponseDTO', () => {
  const item = new CartItem({
    id: 'item-1',
    userId: 'user-1',
    productId: 'product-1',
    quantity: 2,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
  });

  it('requires an item', () => {
    expect(() => new AddToCartResponseDTO()).toThrow('item is required');
  });

  it('serializes the item in the snake_case API shape', () => {
    const dto = new AddToCartResponseDTO({ item });
    expect(Object.isFrozen(dto)).toBe(true);
    expect(dto.toJSON()).toEqual({
      id: 'item-1',
      user_id: 'user-1',
      product_id: 'product-1',
      quantity: 2,
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-02T00:00:00.000Z',
    });
  });

  it('preserves null timestamps when the item has none', () => {
    const plainItem = {
      id: null,
      userId: 'u',
      productId: 'p',
      quantity: 1,
      createdAt: null,
      updatedAt: null,
    };
    expect(new AddToCartResponseDTO({ item: plainItem }).toJSON()).toMatchObject({
      created_at: null,
      updated_at: null,
    });
  });
});
