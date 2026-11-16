import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../app.js';
import { createProductRouter } from '../productRoutes.js';

describe('Product Routes - GET /v1/products/:id/images', () => {
  let app;
  let mockListProductImagesUseCase;

  const productId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    mockListProductImagesUseCase = {
      execute: vi.fn(),
    };

    const customRouter = createProductRouter({
      listProductImagesUseCase: mockListProductImagesUseCase,
    });

    app = createApp({ productRoutes: customRouter });
  });

  it('returns 200 with an array of images for a valid product', async () => {
    const baseUrl = 'http://localhost:54321/storage/v1/object/public';
    mockListProductImagesUseCase.execute.mockResolvedValue({
      data: [
        {
          id: 'img-1',
          product_id: productId,
          path: `${baseUrl}/product-images/${productId}/cover.webp`,
          alt_text: null,
          position: 0,
          created_at: '2026-10-24T12:00:00.000Z',
        },
        {
          id: 'img-2',
          product_id: productId,
          path: `${baseUrl}/product-images/${productId}/back.webp`,
          alt_text: 'Back view',
          position: 1,
          created_at: '2026-10-24T12:01:00.000Z',
        },
      ],
      meta: { timestamp: '2026-10-24T12:00:00.000Z' },
    });

    const response = await request(app).get(`/v1/products/${productId}/images`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0].id).toBe('img-1');
    expect(response.body.data[1].alt_text).toBe('Back view');
    expect(mockListProductImagesUseCase.execute).toHaveBeenCalledWith({ productId });
  });

  it('returns 404 when the use case throws PRODUCT_NOT_FOUND', async () => {
    mockListProductImagesUseCase.execute.mockRejectedValue(
      Object.assign(new Error('Product not found'), {
        code: 'PRODUCT_NOT_FOUND',
        statusCode: 404,
      })
    );

    const response = await request(app).get(`/v1/products/${productId}/images`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
    expect(mockListProductImagesUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when the product id is not a valid UUID', async () => {
    mockListProductImagesUseCase.execute.mockRejectedValue(
      Object.assign(new Error('productId must be a valid UUID'), {
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );

    const response = await request(app).get('/v1/products/not-a-uuid/images');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
