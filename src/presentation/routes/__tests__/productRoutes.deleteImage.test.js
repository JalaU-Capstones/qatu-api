import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../app.js';
import { createProductRouter } from '../productRoutes.js';

vi.mock('../../middleware/authMiddleware.js', () => ({
  authMiddleware: (req, _res, next) => {
    const userId =
      req.headers['x-test-user-id'] ||
      req.headers['x-test-no-token-user-id'] ||
      (req.headers.authorization ? 'seller-from-bearer' : null);
    req.user = userId ? { id: userId } : null;
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

describe('Product Routes - DELETE /v1/products/:id/images/:imageId', () => {
  let app;
  let mockDeleteProductImageUseCase;

  const productId = '550e8400-e29b-41d4-a716-446655440000';
  const imageId = '660e8400-e29b-41d4-a716-446655440001';
  const sellerId = '770e8400-e29b-41d4-a716-446655440002';

  beforeEach(() => {
    mockDeleteProductImageUseCase = {
      execute: vi.fn(),
    };

    const customRouter = createProductRouter({
      deleteProductImageUseCase: mockDeleteProductImageUseCase,
    });

    app = createApp({ productRoutes: customRouter });
  });

  it('deletes the image and returns 204 using x-test-user-id fallback access token', async () => {
    mockDeleteProductImageUseCase.execute.mockResolvedValue({
      meta: { timestamp: '2026-10-15T12:00:00.000Z' },
    });

    const response = await request(app)
      .delete(`/v1/products/${productId}/images/${imageId}`)
      .set('x-test-user-id', sellerId);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(mockDeleteProductImageUseCase.execute).toHaveBeenCalledWith({
      productId,
      imageId,
      sellerId,
      accessToken: 'test-token',
    });
  });

  it('deletes the image and returns 204 extracting access token from Bearer header', async () => {
    mockDeleteProductImageUseCase.execute.mockResolvedValue({
      meta: { timestamp: '2026-10-15T12:00:00.000Z' },
    });

    const response = await request(app)
      .delete(`/v1/products/${productId}/images/${imageId}`)
      .set('Authorization', 'Bearer custom-jwt-token');

    expect(response.status).toBe(204);
    expect(mockDeleteProductImageUseCase.execute).toHaveBeenCalledWith({
      productId,
      imageId,
      sellerId: 'seller-from-bearer',
      accessToken: 'custom-jwt-token',
    });
  });

  it('returns 401 when no auth is provided', async () => {
    const response = await request(app).delete(`/v1/products/${productId}/images/${imageId}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(mockDeleteProductImageUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 401 when user is authenticated but no accessToken is extractable', async () => {
    const response = await request(app)
      .delete(`/v1/products/${productId}/images/${imageId}`)
      .set('x-test-no-token-user-id', sellerId);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(mockDeleteProductImageUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 403 when user does not have seller role', async () => {
    const response = await request(app)
      .delete(`/v1/products/${productId}/images/${imageId}`)
      .set('x-test-user-id', sellerId)
      .set('x-test-role', 'buyer');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(mockDeleteProductImageUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 403 when cross-seller attempts to delete image', async () => {
    mockDeleteProductImageUseCase.execute.mockRejectedValue(
      Object.assign(new Error('You do not own this product'), {
        code: 'FORBIDDEN',
        statusCode: 403,
      })
    );

    const response = await request(app)
      .delete(`/v1/products/${productId}/images/${imageId}`)
      .set('x-test-user-id', '880e8400-e29b-41d4-a716-446655440003');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when image is not found', async () => {
    mockDeleteProductImageUseCase.execute.mockRejectedValue(
      Object.assign(new Error('Product image not found'), {
        code: 'PRODUCT_NOT_FOUND',
        statusCode: 404,
      })
    );

    const response = await request(app)
      .delete(`/v1/products/${productId}/images/${imageId}`)
      .set('x-test-user-id', sellerId);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('returns 404 when image belongs to another product', async () => {
    mockDeleteProductImageUseCase.execute.mockRejectedValue(
      Object.assign(new Error('Product image does not belong to the specified product'), {
        code: 'PRODUCT_NOT_FOUND',
        statusCode: 404,
      })
    );

    const response = await request(app)
      .delete(`/v1/products/${productId}/images/${imageId}`)
      .set('x-test-user-id', sellerId);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('returns 409 when attempting to delete the last image on a published product', async () => {
    mockDeleteProductImageUseCase.execute.mockRejectedValue(
      Object.assign(
        new Error(
          'Cannot delete the only image of a published product. Unpublish the product first or upload a replacement.'
        ),
        {
          code: 'INVALID_STATE_TRANSITION',
          statusCode: 409,
        }
      )
    );

    const response = await request(app)
      .delete(`/v1/products/${productId}/images/${imageId}`)
      .set('x-test-user-id', sellerId);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('returns 400 when product ID or image ID is not a valid UUID', async () => {
    mockDeleteProductImageUseCase.execute.mockRejectedValue(
      Object.assign(new Error('Product ID must be a valid UUID'), {
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );

    const response = await request(app)
      .delete('/v1/products/invalid-uuid/images/invalid-uuid')
      .set('x-test-user-id', sellerId);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
