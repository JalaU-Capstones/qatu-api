import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../../../app.js';
import { createCategoryRouter } from '../categoryRoutes.js';

describe('Category Routes Integration - GET /v1/categories', () => {
  let app;
  let mockListCategoriesUseCase;

  const sampleCategory = {
    id: 'b2d3c4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    name: 'Electronics',
    slug: 'electronics',
    description: 'Gadgets and electronic devices.',
    parent_id: null,
    position: 1,
    is_active: true,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
  };

  beforeEach(() => {
    mockListCategoriesUseCase = {
      execute: vi.fn().mockResolvedValue({
        data: [sampleCategory],
        meta: { page: 1, per_page: 20, total: 1, total_pages: 1 },
      }),
    };

    app = createApp({
      categoryRoutes: createCategoryRouter({ listCategoriesUseCase: mockListCategoriesUseCase }),
    });
  });

  it('should return 200 with the category list and pagination meta', async () => {
    const response = await request(app).get('/v1/categories');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([sampleCategory]);
    expect(response.body.meta).toEqual({ page: 1, per_page: 20, total: 1, total_pages: 1 });
  });

  it('should be public and not require authentication', async () => {
    const response = await request(app).get('/v1/categories');
    expect(response.status).toBe(200);
  });

  it('should pass validated pagination params to the use case', async () => {
    await request(app).get('/v1/categories').query({ page: 2, limit: 5 });

    const dto = mockListCategoriesUseCase.execute.mock.calls[0][0];
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(5);
  });

  it('should return an empty list with total_pages 0 when there are no categories', async () => {
    mockListCategoriesUseCase.execute.mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 20, total: 0, total_pages: 0 },
    });

    const response = await request(app).get('/v1/categories');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.total_pages).toBe(0);
  });

  it.each([
    ['page=0', { page: 0 }, 'page'],
    ['limit=101', { limit: 101 }, 'limit'],
    ['limit=abc', { limit: 'abc' }, 'limit'],
  ])('should return 400 for invalid %s', async (_label, query, field) => {
    const response = await request(app).get('/v1/categories').query(query);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })])
    );
    expect(mockListCategoriesUseCase.execute).not.toHaveBeenCalled();
  });

  it('should return 400 when page looks like SQL and not call the use case (US-24)', async () => {
    const response = await request(app)
      .get('/v1/categories')
      .query({ page: '1; DROP TABLE categories' });

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
    expect(mockListCategoriesUseCase.execute).not.toHaveBeenCalled();
  });

  it('should return 500 with the standard error envelope when the use case fails', async () => {
    mockListCategoriesUseCase.execute.mockRejectedValue(new Error('db down'));

    const response = await request(app).get('/v1/categories');

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('should expose rate limit headers from the public limiter', async () => {
    const response = await request(app).get('/v1/categories');

    expect(response.headers['ratelimit-limit']).toBe('100');
  });
});
