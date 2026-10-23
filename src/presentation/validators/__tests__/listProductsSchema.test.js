import { describe, it, expect } from 'vitest';
import { listProductsSchema } from '../listProductsSchema.js';

describe('listProductsSchema', () => {
  describe('defaults', () => {
    it('should apply default values when no params provided', () => {
      const { error, value } = listProductsSchema.validate({});
      expect(error).toBeUndefined();
      expect(value).toEqual({
        page: 1,
        limit: 20,
        sort_by: 'created_at',
        sort_order: 'desc',
      });
    });
  });

  describe('page', () => {
    it('should accept a valid page number', () => {
      const { error, value } = listProductsSchema.validate({ page: 3 });
      expect(error).toBeUndefined();
      expect(value.page).toBe(3);
    });

    it('should accept page as string and coerce to number', () => {
      const { error, value } = listProductsSchema.validate({ page: '5' });
      expect(error).toBeUndefined();
      expect(value.page).toBe(5);
    });

    it('should reject page < 1', () => {
      const { error } = listProductsSchema.validate({ page: 0 });
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('page must be at least 1');
    });

    it('should reject non-integer page', () => {
      const { error } = listProductsSchema.validate({ page: 1.5 });
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('page must be an integer');
    });

    it('should reject non-numeric page', () => {
      const { error } = listProductsSchema.validate({ page: 'abc' });
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('page must be a number');
    });
  });

  describe('limit', () => {
    it('should accept a valid limit', () => {
      const { error, value } = listProductsSchema.validate({ limit: 50 });
      expect(error).toBeUndefined();
      expect(value.limit).toBe(50);
    });

    it('should reject limit > 100', () => {
      const { error } = listProductsSchema.validate({ limit: 101 });
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('limit must be at most 100');
    });

    it('should reject limit < 1', () => {
      const { error } = listProductsSchema.validate({ limit: 0 });
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('limit must be at least 1');
    });
  });

  describe('search', () => {
    it('should accept a valid search string', () => {
      const { error, value } = listProductsSchema.validate({ search: '  phone  ' });
      expect(error).toBeUndefined();
      expect(value.search).toBe('phone');
    });

    it('should allow empty string', () => {
      const { error } = listProductsSchema.validate({ search: '' });
      expect(error).toBeUndefined();
    });

    it('should allow null', () => {
      const { error } = listProductsSchema.validate({ search: null });
      expect(error).toBeUndefined();
    });

    it('should reject search longer than 200 characters', () => {
      const { error } = listProductsSchema.validate({ search: 'a'.repeat(201) });
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('search must be at most 200 characters');
    });

    it('should keep a SQL-looking search string as data', () => {
      const payload = "'; DROP TABLE products;--";
      const { error, value } = listProductsSchema.validate({ search: payload });
      expect(error).toBeUndefined();
      expect(value.search).toBe(payload);
    });
  });

  describe('category_id', () => {
    it('should accept a valid UUID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const { error, value } = listProductsSchema.validate({ category_id: uuid });
      expect(error).toBeUndefined();
      expect(value.category_id).toBe(uuid);
    });

    it('should reject an invalid UUID', () => {
      const { error } = listProductsSchema.validate({ category_id: 'not-a-uuid' });
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('category_id must be a valid UUID');
    });
  });

  describe('min_price / max_price', () => {
    it('should accept valid prices', () => {
      const { error, value } = listProductsSchema.validate({
        min_price: 10,
        max_price: 100.5,
      });
      expect(error).toBeUndefined();
      expect(value.min_price).toBe(10);
      expect(value.max_price).toBe(100.5);
    });

    it('should reject negative min_price', () => {
      const { error } = listProductsSchema.validate({ min_price: -1 });
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('min_price must be at least 0');
    });

    it('should reject negative max_price', () => {
      const { error } = listProductsSchema.validate({ max_price: -5 });
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('max_price must be at least 0');
    });

    it('should reject non-numeric min_price', () => {
      const { error } = listProductsSchema.validate({ min_price: 'abc' });
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('min_price must be a number');
    });

    it('should accept max_price equal to min_price', () => {
      const { error, value } = listProductsSchema.validate({ min_price: 100, max_price: 100 });
      expect(error).toBeUndefined();
      expect(value.min_price).toBe(100);
      expect(value.max_price).toBe(100);
    });

    it('should accept max_price without min_price', () => {
      const { error, value } = listProductsSchema.validate({ max_price: 500 });
      expect(error).toBeUndefined();
      expect(value.max_price).toBe(500);
    });

    it('should reject max_price lower than min_price', () => {
      const { error } = listProductsSchema.validate({ min_price: 500, max_price: 100 });
      expect(error).toBeDefined();
      expect(error.details[0].path).toEqual(['max_price']);
      expect(error.details[0].message).toBe('max_price must be greater than or equal to min_price');
    });

    it('should compare prices numerically when they arrive as query strings', () => {
      const ok = listProductsSchema.validate({ min_price: '9', max_price: '10' });
      expect(ok.error).toBeUndefined();

      const bad = listProductsSchema.validate({ min_price: '10', max_price: '9' });
      expect(bad.error).toBeDefined();
    });
  });

  describe('seller_id', () => {
    it('should accept a valid UUID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const { error, value } = listProductsSchema.validate({ seller_id: uuid });
      expect(error).toBeUndefined();
      expect(value.seller_id).toBe(uuid);
    });

    it('should reject an invalid UUID', () => {
      const { error } = listProductsSchema.validate({ seller_id: 'bad-id' });
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('seller_id must be a valid UUID');
    });
  });

  describe('sort_by', () => {
    it.each(['created_at', 'price', 'name', 'average_rating'])(
      'should accept sort_by = %s',
      (field) => {
        const { error, value } = listProductsSchema.validate({ sort_by: field });
        expect(error).toBeUndefined();
        expect(value.sort_by).toBe(field);
      }
    );

    it('should reject an invalid sort_by value', () => {
      const { error } = listProductsSchema.validate({ sort_by: 'invalid_field' });
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe(
        'sort_by must be one of created_at, price, name, average_rating'
      );
    });
  });

  describe('sort_order', () => {
    it('should accept asc', () => {
      const { error, value } = listProductsSchema.validate({ sort_order: 'asc' });
      expect(error).toBeUndefined();
      expect(value.sort_order).toBe('asc');
    });

    it('should accept desc', () => {
      const { error, value } = listProductsSchema.validate({ sort_order: 'desc' });
      expect(error).toBeUndefined();
      expect(value.sort_order).toBe('desc');
    });

    it('should normalize uppercase to lowercase', () => {
      const { error, value } = listProductsSchema.validate({ sort_order: 'ASC' });
      expect(error).toBeUndefined();
      expect(value.sort_order).toBe('asc');
    });

    it('should reject invalid sort_order', () => {
      const { error } = listProductsSchema.validate({ sort_order: 'random' });
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('sort_order must be one of asc, desc');
    });
  });

  describe('stripUnknown via schema validation options', () => {
    it('should strip unknown fields when validated with stripUnknown', () => {
      const { error, value } = listProductsSchema.validate(
        { page: 1, unknown_field: 'test' },
        { stripUnknown: true }
      );
      expect(error).toBeUndefined();
      expect(value.unknown_field).toBeUndefined();
    });
  });
});
