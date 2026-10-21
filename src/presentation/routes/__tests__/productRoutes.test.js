import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../../../app.js';
import { createProductRouter } from '../productRoutes.js';

describe('Product Routes Integration - GET /v1/products', () => {
  let app;
  let mockListProductsUseCase;

  const sampleProduct = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    seller_id: '660e8400-e29b-41d4-a716-446655440001',
    category_id: '770e8400-e29b-41d4-a716-446655440002',
    name: 'Test Product',
    slug: 'test-product',
    description: 'A test product',
    price: 29.99,
    currency: 'USD',
    stock: 100,
    attributes: { color: 'blue' },
    primary_image_path: '/images/test.jpg',
    state: 'published',
    average_rating: 4.5,
    ratings_count: 10,
    published_at: '2026-10-15T10:00:00.000Z',
    created_at: '2026-10-14T08:00:00.000Z',
    updated_at: '2026-10-15T10:00:00.000Z',
  };

  beforeEach(() => {
    mockListProductsUseCase = {
      execute: vi.fn().mockResolvedValue({
        data: [sampleProduct],
        meta: { page: 1, per_page: 20, total: 1, total_pages: 1 },
      }),
    };

    const customRouter = createProductRouter({
      listProductsUseCase: mockListProductsUseCase,
    });

    app = createApp({ productRoutes: customRouter });
  });

  describe('Successful requests', () => {
    it('should return 200 with default pagination', async () => {
      const response = await request(app).get('/v1/products');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta).toEqual({
        page: 1,
        per_page: 20,
        total: 1,
        total_pages: 1,
      });
      expect(mockListProductsUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('should pass validated query params to the use case', async () => {
      const response = await request(app).get('/v1/products').query({
        page: 2,
        limit: 10,
        search: 'phone',
        sort_by: 'price',
        sort_order: 'asc',
      });

      expect(response.status).toBe(200);
      const dto = mockListProductsUseCase.execute.mock.calls[0][0];
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(10);
      expect(dto.search).toBe('phone');
      expect(dto.sort_by).toBe('price');
      expect(dto.sort_order).toBe('asc');
    });

    it('should pass filter params to the use case', async () => {
      const categoryId = '550e8400-e29b-41d4-a716-446655440000';
      const sellerId = '660e8400-e29b-41d4-a716-446655440001';

      const response = await request(app).get('/v1/products').query({
        category_id: categoryId,
        seller_id: sellerId,
        min_price: 10,
        max_price: 100,
      });

      expect(response.status).toBe(200);
      const dto = mockListProductsUseCase.execute.mock.calls[0][0];
      expect(dto.category_id).toBe(categoryId);
      expect(dto.seller_id).toBe(sellerId);
      expect(dto.min_price).toBe(10);
      expect(dto.max_price).toBe(100);
    });

    it('should combine search, category and price range in a single request (US-06)', async () => {
      const categoryId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app).get('/v1/products').query({
        search: ' phone ',
        category_id: categoryId,
        min_price: 100,
        max_price: 500,
      });

      expect(response.status).toBe(200);
      const dto = mockListProductsUseCase.execute.mock.calls[0][0];
      expect(dto.toRepositoryParams().filters).toEqual({
        search: 'phone',
        categoryId,
        minPrice: 100,
        maxPrice: 500,
        sellerId: undefined,
      });
    });

    it('should return empty data array with meta when no products', async () => {
      mockListProductsUseCase.execute.mockResolvedValue({
        data: [],
        meta: { page: 1, per_page: 20, total: 0, total_pages: 0 },
      });

      const response = await request(app).get('/v1/products');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });

    it('should strip unknown query params', async () => {
      const response = await request(app).get('/v1/products').query({
        unknown_field: 'should_be_stripped',
      });

      expect(response.status).toBe(200);
      const dto = mockListProductsUseCase.execute.mock.calls[0][0];
      expect(dto.unknown_field).toBeUndefined();
    });
  });

  describe('Validation errors (400)', () => {
    it('should return 400 for invalid page', async () => {
      const response = await request(app).get('/v1/products').query({ page: 'abc' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'page',
            message: 'page must be a number',
          }),
        ])
      );
    });

    it('should return 400 for page < 1', async () => {
      const response = await request(app).get('/v1/products').query({ page: 0 });

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'page',
            message: 'page must be at least 1',
          }),
        ])
      );
    });

    it('should return 400 for limit > 100', async () => {
      const response = await request(app).get('/v1/products').query({ limit: 200 });

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'limit',
            message: 'limit must be at most 100',
          }),
        ])
      );
    });

    it('should return 400 for invalid category_id', async () => {
      const response = await request(app).get('/v1/products').query({ category_id: 'not-a-uuid' });

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'category_id',
            message: 'category_id must be a valid UUID',
          }),
        ])
      );
    });

    it('should return 400 for invalid seller_id', async () => {
      const response = await request(app).get('/v1/products').query({ seller_id: 'bad-id' });

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'seller_id',
            message: 'seller_id must be a valid UUID',
          }),
        ])
      );
    });

    it('should return 400 for negative min_price', async () => {
      const response = await request(app).get('/v1/products').query({ min_price: -1 });

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'min_price',
            message: 'min_price must be at least 0',
          }),
        ])
      );
    });

    it('should return 400 when max_price is lower than min_price', async () => {
      const response = await request(app)
        .get('/v1/products')
        .query({ min_price: 500, max_price: 100 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'max_price',
            message: 'max_price must be greater than or equal to min_price',
          }),
        ])
      );
      expect(mockListProductsUseCase.execute).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid sort_by', async () => {
      const response = await request(app).get('/v1/products').query({ sort_by: 'invalid_column' });

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'sort_by',
          }),
        ])
      );
    });

    it('should return 400 for invalid sort_order', async () => {
      const response = await request(app).get('/v1/products').query({ sort_order: 'random' });

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'sort_order',
          }),
        ])
      );
    });

    it('should report multiple validation errors at once', async () => {
      const response = await request(app).get('/v1/products').query({
        page: 'abc',
        limit: -5,
        category_id: 'bad',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Error handling', () => {
    it('should return 500 when use case throws an unexpected error', async () => {
      mockListProductsUseCase.execute.mockRejectedValue(new Error('DB down'));

      const response = await request(app).get('/v1/products');

      expect(response.status).toBe(500);
    });
  });

  describe('Rate limit headers', () => {
    it('should include RateLimit-* headers in the response', async () => {
      const response = await request(app).get('/v1/products');

      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Health endpoint still works', () => {
    it('should respond with 200 ok', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });
});
