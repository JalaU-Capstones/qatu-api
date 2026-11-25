import { describe, expect, it } from 'vitest';
import { CartItemDTO, GetCartRequestDTO } from '../GetCartDTO.js';

describe('GetCartRequestDTO', () => {
  it('trims a valid userId', () => {
    expect(new GetCartRequestDTO({ userId: '  u1  ' }).userId).toBe('u1');
  });

  it.each([
    [undefined, 'userId is required'],
    [null, 'userId is required'],
    [123, 'userId is required'],
    ['   ', 'userId is required'],
  ])('rejects an invalid userId (%j)', (userId, message) => {
    expect(() => new GetCartRequestDTO({ userId })).toThrow(message);
    expect(() => new GetCartRequestDTO({ userId })).toThrowError(
      expect.objectContaining({ statusCode: 400, code: 'VALIDATION_ERROR' })
    );
  });
});

describe('CartItemDTO', () => {
  it('serializes Date timestamps and an included product', () => {
    const product = { id: 'p1', name: 'Producto' };
    const dto = new CartItemDTO({
      id: 'i1',
      userId: 'u1',
      productId: 'p1',
      quantity: '2',
      createdAt: new Date('2026-11-23T10:00:00.000Z'),
      updatedAt: new Date('2026-11-23T11:00:00.000Z'),
      product,
    });

    expect(dto.toJSON()).toEqual({
      id: 'i1',
      user_id: 'u1',
      product_id: 'p1',
      quantity: 2,
      created_at: '2026-11-23T10:00:00.000Z',
      updated_at: '2026-11-23T11:00:00.000Z',
      product,
    });
  });

  it('defaults nullable fields and ignores a non-object product', () => {
    const dto = new CartItemDTO({
      id: undefined,
      userId: 'u1',
      productId: 'p1',
      quantity: 1,
      product: 'not-an-object',
    });

    expect(dto.id).toBeNull();
    expect(dto.createdAt).toBeNull();
    expect(dto.updatedAt).toBeNull();
    expect(dto.product).toBeNull();
    expect(dto.toJSON()).toEqual({
      id: null,
      user_id: 'u1',
      product_id: 'p1',
      quantity: 1,
      created_at: null,
      updated_at: null,
    });
    expect(Object.isFrozen(dto)).toBe(true);
  });

  it('keeps pre-formatted timestamp strings', () => {
    const dto = new CartItemDTO({
      userId: 'u1',
      productId: 'p1',
      quantity: 1,
      createdAt: '2026-11-23T10:00:00.000Z',
      updatedAt: '2026-11-23T11:00:00.000Z',
    });

    expect(dto.toJSON()).toMatchObject({
      created_at: '2026-11-23T10:00:00.000Z',
      updated_at: '2026-11-23T11:00:00.000Z',
    });
  });
});
