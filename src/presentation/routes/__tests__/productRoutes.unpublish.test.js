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
    if (req.headers['x-test-role'] && req.headers['x-test-role'] !== 'seller') {
      const err = new Error('Seller role required');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      return next(err);
    }
    req.user.roles = ['seller'];
    return next();
  },
}));

describe('Product Routes - PATCH /v1/products/:id/unpublish', () => {
  let app;
  let mockUnpublishProductUseCase;

  const productId = '550e8400-e29b-41d4-a716-446655440000';
  const sellerId = '660e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    mockUnpublishProductUseCase = {
      execute: vi.fn(),
    };

    const customRouter = createProductRouter({
      unpublishProductUseCase: mockUnpublishProductUseCase,
    });

    app = createApp({ productRoutes: customRouter });
  });

  it('unpublishes the product and returns 200 on happy path', async () => {
    mockUnpublishProductUseCase.execute.mockResolvedValue({
      data: {
        id: productId,
        state: 'unpublished',
        published_at: '2026-10-15T10:00:00.000Z',
      },
      meta: { timestamp: '2026-10-15T12:00:00.000Z' },
    });

    const response = await request(app)
      .patch(`/v1/products/${productId}/unpublish`)
      .set('x-test-user-id', sellerId);

    expect(response.status).toBe(200);
    expect(response.body.data.state).toBe('unpublished');
    expect(mockUnpublishProductUseCase.execute).toHaveBeenCalledWith({
      productId,
      sellerId,
    });
  });

  it('returns 401 when no auth is provided', async () => {
    const response = await request(app).patch(`/v1/products/${productId}/unpublish`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(mockUnpublishProductUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 403 when user does not have seller role', async () => {
    const response = await request(app)
      .patch(`/v1/products/${productId}/unpublish`)
      .set('x-test-user-id', sellerId)
      .set('x-test-role', 'buyer');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(mockUnpublishProductUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 403 when cross-seller attempts to unpublish', async () => {
    mockUnpublishProductUseCase.execute.mockRejectedValue(
      Object.assign(new Error('You do not own this product'), {
        code: 'FORBIDDEN',
        statusCode: 403,
      })
    );

    const response = await request(app)
      .patch(`/v1/products/${productId}/unpublish`)
      .set('x-test-user-id', '770e8400-e29b-41d4-a716-446655440002');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when product is not found', async () => {
    mockUnpublishProductUseCase.execute.mockRejectedValue(
      Object.assign(new Error('Product not found'), {
        code: 'PRODUCT_NOT_FOUND',
        statusCode: 404,
      })
    );

    const response = await request(app)
      .patch(`/v1/products/${productId}/unpublish`)
      .set('x-test-user-id', sellerId);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('returns 409 on invalid transition (e.g. product in draft state)', async () => {
    mockUnpublishProductUseCase.execute.mockRejectedValue(
      Object.assign(new Error("Cannot unpublish a product in state 'draft'"), {
        code: 'INVALID_STATE_TRANSITION',
        statusCode: 409,
      })
    );

    const response = await request(app)
      .patch(`/v1/products/${productId}/unpublish`)
      .set('x-test-user-id', sellerId);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('returns 400 when product ID is not a valid UUID', async () => {
    mockUnpublishProductUseCase.execute.mockRejectedValue(
      Object.assign(new Error('Product ID must be a valid UUID'), {
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );

    const response = await request(app)
      .patch('/v1/products/invalid-uuid/unpublish')
      .set('x-test-user-id', sellerId);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
