import { describe, it, expect } from 'vitest';
import { Product } from '../../../domain/entities/Product.js';
import { ListProductsRequestDTO, ProductListItemDTO } from '../ProductListDTO.js';

describe('ProductListDTO', () => {
  describe('ListProductsRequestDTO', () => {
    it('should apply defaults for empty params', () => {
      const dto = new ListProductsRequestDTO();

      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
      expect(dto.search).toBeUndefined();
      expect(dto.category_id).toBeUndefined();
      expect(dto.min_price).toBeUndefined();
      expect(dto.max_price).toBeUndefined();
      expect(dto.seller_id).toBeUndefined();
      expect(dto.sort_by).toBe('created_at');
      expect(dto.sort_order).toBe('desc');
    });

    it('should coerce numeric strings to numbers', () => {
      const dto = new ListProductsRequestDTO({
        page: '3',
        limit: '15',
        min_price: '10.50',
        max_price: '99.99',
      });

      expect(dto.page).toBe(3);
      expect(dto.limit).toBe(15);
      expect(dto.min_price).toBe(10.5);
      expect(dto.max_price).toBe(99.99);
    });

    it('should trim search input', () => {
      const dto = new ListProductsRequestDTO({
        search: '   ergonomic keyboard   ',
      });

      expect(dto.search).toBe('ergonomic keyboard');
    });

    it('should normalize sort_order to lowercase', () => {
      const dto = new ListProductsRequestDTO({
        sort_order: 'ASC',
      });

      expect(dto.sort_order).toBe('asc');
    });

    it('should return the correct nested shape in toRepositoryParams()', () => {
      const dto = new ListProductsRequestDTO({
        page: '2',
        limit: '10',
        search: 'chair',
        category_id: 'cat-uuid-1',
        min_price: '50',
        max_price: '200',
        seller_id: 'seller-uuid-1',
        sort_by: 'price',
        sort_order: 'asc',
      });

      const params = dto.toRepositoryParams();

      expect(params).toEqual({
        page: 2,
        limit: 10,
        filters: {
          search: 'chair',
          categoryId: 'cat-uuid-1',
          minPrice: 50,
          maxPrice: 200,
          sellerId: 'seller-uuid-1',
        },
        sort: {
          field: 'price',
          order: 'asc',
        },
      });
    });

    it('should handle camelCase input params correctly', () => {
      const dto = new ListProductsRequestDTO({
        categoryId: 'cat-uuid-2',
        minPrice: 25,
        maxPrice: 150,
        sellerId: 'seller-uuid-2',
        sortBy: 'name',
        sortOrder: 'DESC',
      });

      expect(dto.category_id).toBe('cat-uuid-2');
      expect(dto.min_price).toBe(25);
      expect(dto.max_price).toBe(150);
      expect(dto.seller_id).toBe('seller-uuid-2');
      expect(dto.sort_by).toBe('name');
      expect(dto.sort_order).toBe('desc');

      const params = dto.toRepositoryParams();
      expect(params.filters.categoryId).toBe('cat-uuid-2');
      expect(params.filters.sellerId).toBe('seller-uuid-2');
      expect(params.sort.field).toBe('name');
    });
  });

  describe('ProductListItemDTO', () => {
    it('should throw when constructed without product entity', () => {
      expect(() => new ProductListItemDTO()).toThrow('Product entity is required');
    });

    it('should produce snake_case output matching Product.yaml with attributes: {} default', () => {
      const product = new Product({
        id: 'prod-123',
        seller_id: 'seller-456',
        name: 'Simple Desk',
        slug: 'simple-desk',
        price: 89.99,
        stock: 5,
        attributes: null,
      });

      const dto = new ProductListItemDTO(product);
      const json = dto.toJSON();

      expect(json).toEqual({
        id: 'prod-123',
        seller_id: 'seller-456',
        category_id: null,
        name: 'Simple Desk',
        slug: 'simple-desk',
        description: null,
        price: 89.99,
        currency: 'USD',
        stock: 5,
        attributes: {},
        primary_image_path: null,
        state: 'draft',
        average_rating: 0,
        ratings_count: 0,
        published_at: null,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it('should preserve provided attributes in toJSON()', () => {
      const product = new Product({
        id: 'prod-789',
        seller_id: 'seller-456',
        name: 'Gaming Mouse',
        slug: 'gaming-mouse',
        price: 49.99,
        stock: 12,
        attributes: { dpi: 16000, wireless: true },
      });

      const dto = new ProductListItemDTO(product);
      expect(dto.toJSON().attributes).toEqual({ dpi: 16000, wireless: true });
    });
  });
});
