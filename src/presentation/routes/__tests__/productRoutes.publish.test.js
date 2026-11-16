import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../app.js';
import { createProductRouter } from '../productRoutes.js';

vi.mock('../../middleware/authMiddleware.js', () => ({
  authMiddleware: (req, _res, next) => {
    req.user = req.headers['x-test-user-id'] ? { id: req.headers['x-test-user-id'] } : null;
    if (!req.user) {
      const err = new Error('Authentication required');
      err.code = 'UNAUTHORIZED';
      err.statusCode = 401;
      return next(err);
    }
    return next();
  },
}));

vi.mock('../../middleware/requireSellerRole.js', () => ({
  requireSellerRole: () => (req, _res, next) => {
    req.user.roles = ['seller'];
    return next();
  },
}));

describe('Product Routes - PATCH /v1/products/:id/publish', () => {
  let app;
  let mockPublishProductUseCase;

  beforeEach(() => {
    mockPublishProductUseCase = {
      execute: vi.fn(),
    };

    const customRouter = createProductRouter({
      publishProductUseCase: mockPublishProductUseCase,
    });

    app = createApp({ productRoutes: customRouter });
  });

  it('publishes the seller product and returns 200', async () => {
    const productId = '550e8400-e29b-41d4-a716-446655440000';
    const sellerId = '660e8400-e29b-41d4-a716-446655440001';
    mockPublishProductUseCase.execute.mockResolvedValue({
      data: {
        id: productId,
        state: 'published',
        published_at: '2026-10-15T10:00:00.000Z',
      },
      meta: { timestamp: '2026-10-15T10:00:00.000Z' },
    });

    const response = await request(app)
      .patch(`/v1/products/${productId}/publish`)
      .set('x-test-user-id', sellerId);

    expect(response.status).toBe(200);
    expect(response.body.data.state).toBe('published');
    expect(mockPublishProductUseCase.execute).toHaveBeenCalledWith({
      productId,
      sellerId,
    });
  });

  it('returns 403 when the use case rejects a non-owner', async () => {
    mockPublishProductUseCase.execute.mockRejectedValue(
      Object.assign(new Error('You do not own this product'), {
        code: 'FORBIDDEN',
        statusCode: 403,
      })
    );

    const response = await request(app)
      .patch('/v1/products/550e8400-e29b-41d4-a716-446655440000/publish')
      .set('x-test-user-id', '660e8400-e29b-41d4-a716-446655440001');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when the product does not exist', async () => {
    mockPublishProductUseCase.execute.mockRejectedValue(
      Object.assign(new Error('Product not found'), {
        code: 'PRODUCT_NOT_FOUND',
        statusCode: 404,
      })
    );

    const response = await request(app)
      .patch('/v1/products/550e8400-e29b-41d4-a716-446655440000/publish')
      .set('x-test-user-id', '660e8400-e29b-41d4-a716-446655440001');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });
});
