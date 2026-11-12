import { describe, it, expect } from 'vitest';
import { listCategoriesSchema } from '../listCategoriesSchema.js';

describe('listCategoriesSchema', () => {
  it('should apply default values when no params provided', () => {
    const { error, value } = listCategoriesSchema.validate({});
    expect(error).toBeUndefined();
    expect(value).toEqual({ page: 1, limit: 20 });
  });

  it('should coerce valid query strings to numbers', () => {
    const { error, value } = listCategoriesSchema.validate({ page: '2', limit: '10' });
    expect(error).toBeUndefined();
    expect(value).toEqual({ page: 2, limit: 10 });
  });

  it('should reject page < 1', () => {
    const { error } = listCategoriesSchema.validate({ page: 0 });
    expect(error.details[0].message).toBe('page must be at least 1');
  });

  it('should reject limit > 100', () => {
    const { error } = listCategoriesSchema.validate({ limit: 101 });
    expect(error.details[0].message).toBe('limit must be at most 100');
  });

  it('should reject non-numeric limit', () => {
    const { error } = listCategoriesSchema.validate({ limit: 'abc' });
    expect(error.details[0].message).toBe('limit must be a number');
  });

  it('should strip unknown fields when validated with stripUnknown', () => {
    const { error, value } = listCategoriesSchema.validate(
      { page: 1, foo: 'bar' },
      { stripUnknown: true }
    );
    expect(error).toBeUndefined();
    expect(value.foo).toBeUndefined();
  });
});
