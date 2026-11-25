import { describe, expect, it } from 'vitest';
import { CreateProductRequestDTO } from '../CreateProductDTO.js';

describe('CreateProductRequestDTO', () => {
  it('normalizes snake_case aliases, strings, currency and nested attributes', () => {
    const dto = new CreateProductRequestDTO({
      sellerId: ' s1 ',
      name: ' Producto ',
      slug: ' producto ',
      description: ' Descripción ',
      price: '19.99',
      currency: ' bob ',
      stock: '3',
      category_id: ' c1 ',
      attributes: { color: 'negro' },
    });

    expect(dto).toMatchObject({
      sellerId: 's1',
      name: 'Producto',
      slug: 'producto',
      description: 'Descripción',
      price: 19.99,
      currency: 'BOB',
      stock: 3,
      categoryId: 'c1',
      attributes: { color: 'negro' },
    });
  });

  it.each([
    [null, ''],
    [42, 42],
  ])('normalizes a non-string sellerId (%j)', (sellerId, expected) => {
    expect(new CreateProductRequestDTO({ sellerId }).sellerId).toBe(expected);
  });

  it.each([
    [null, ''],
    [7, 7],
  ])('normalizes a non-string name (%j)', (name, expected) => {
    expect(new CreateProductRequestDTO({ name }).name).toBe(expected);
  });

  it.each([
    [null, null],
    [123, 123],
  ])('keeps a non-string description (%j) unchanged', (description, expected) => {
    expect(new CreateProductRequestDTO({ description }).description).toBe(expected);
  });

  it.each([
    [undefined, 0],
    [null, 0],
    ['', 0],
  ])('defaults an empty price (%j) to zero', (price, expected) => {
    expect(new CreateProductRequestDTO({ price }).price).toBe(expected);
  });

  it('defaults an empty currency to USD', () => {
    expect(new CreateProductRequestDTO({ currency: '   ' }).currency).toBe('USD');
  });

  it.each([
    [null, 0],
    ['', 0],
  ])('defaults an empty stock (%j) to zero', (stock, expected) => {
    expect(new CreateProductRequestDTO({ stock }).stock).toBe(expected);
  });

  it.each([
    [123, 123],
    [null, ''],
  ])('normalizes a non-string categoryId (%j)', (categoryId, expected) => {
    expect(new CreateProductRequestDTO({ categoryId }).categoryId).toBe(expected);
    expect(new CreateProductRequestDTO({ category_id: categoryId }).categoryId).toBe(expected);
  });

  it.each([
    [null, {}],
    [[], {}],
    ['attributes', {}],
  ])('rejects a non-object attributes value (%j)', (attributes, expected) => {
    expect(new CreateProductRequestDTO({ attributes }).attributes).toEqual(expected);
  });
});
