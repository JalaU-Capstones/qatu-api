import { describe, expect, it } from 'vitest';
import { getCartQuerySchema } from '../getCartQuerySchema.js';

describe('getCartQuerySchema', () => {
  it('Scenario 1: include=product -> passes validation', () => {
    const { error, value } = getCartQuerySchema.validate({ include: 'product' });
    expect(error).toBeUndefined();
    expect(value.include).toBe('product');
  });

  it('Scenario 2: No query parameters -> passes validation', () => {
    const { error, value } = getCartQuerySchema.validate({});
    expect(error).toBeUndefined();
    expect(value).toEqual({});
  });

  it('Scenario 3: Invalid include value -> returns validation error', () => {
    const { error } = getCartQuerySchema.validate({ include: 'category' });
    expect(error).toBeDefined();
    expect(error.details[0].message).toContain('"include" must be [product]');
  });

  it('Scenario 4: Unknown query parameter -> returns validation error', () => {
    const { error } = getCartQuerySchema.validate({ extra: 'field' });
    expect(error).toBeDefined();
    expect(error.details[0].message).toContain('"extra" is not allowed');
  });
});
