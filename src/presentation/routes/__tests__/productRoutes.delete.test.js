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

describe('Product Routes - DELETE /v1/products/:id', () => {
  let app;
  let mockDeleteProductUseCase;

  const productId = '550e8400-e29b-41d4-a716-446655440000';
  const sellerId = '660e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    mockDeleteProductUseCase = {
      execute: vi.fn(),
    };

    const customRouter = createProductRouter({
      deleteProductUseCase: mockDeleteProductUseCase,
    });

    app = createApp({ productRoutes: customRouter });
  });

  it('deletes the product and returns 204 with empty body on happy path', async () => {
    mockDeleteProductUseCase.execute.mockResolvedValue({
      meta: { timestamp: '2026-10-15T12:00:00.000Z' },
    });

    const response = await request(app)
      .delete(`/v1/products/${productId}`)
      .set('x-test-user-id', sellerId);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(mockDeleteProductUseCase.execute).toHaveBeenCalledWith({
      productId,
      sellerId,
    });
  });

  it('returns 401 when no auth is provided', async () => {
    const response = await request(app).delete(`/v1/products/${productId}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(mockDeleteProductUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 403 when user does not have seller role', async () => {
    const response = await request(app)
      .delete(`/v1/products/${productId}`)
      .set('x-test-user-id', sellerId)
      .set('x-test-role', 'buyer');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(mockDeleteProductUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 403 when cross-seller attempts to delete', async () => {
    mockDeleteProductUseCase.execute.mockRejectedValue(
      Object.assign(new Error('You do not own this product'), {
        code: 'FORBIDDEN',
        statusCode: 403,
      })
    );

    const response = await request(app)
      .delete(`/v1/products/${productId}`)
      .set('x-test-user-id', '770e8400-e29b-41d4-a716-446655440002');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when product does not exist', async () => {
    mockDeleteProductUseCase.execute.mockRejectedValue(
      Object.assign(new Error('Product not found'), {
        code: 'PRODUCT_NOT_FOUND',
        statusCode: 404,
      })
    );

    const response = await request(app)
      .delete(`/v1/products/${productId}`)
      .set('x-test-user-id', sellerId);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('returns 400 when product ID is not a valid UUID', async () => {
    mockDeleteProductUseCase.execute.mockRejectedValue(
      Object.assign(new Error('Product ID must be a valid UUID'), {
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );

    const response = await request(app)
      .delete('/v1/products/invalid-uuid')
      .set('x-test-user-id', sellerId);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
