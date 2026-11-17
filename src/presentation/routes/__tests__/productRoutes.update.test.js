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

describe('Product Routes - PATCH /v1/products/:id', () => {
  let app;
  let mockUpdateProductUseCase;

  const productId = '550e8400-e29b-41d4-a716-446655440000';
  const sellerId = '660e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    mockUpdateProductUseCase = {
      execute: vi.fn(),
    };

    const customRouter = createProductRouter({
      updateProductUseCase: mockUpdateProductUseCase,
    });

    app = createApp({ productRoutes: customRouter });
  });

  it('updates the product and returns 200 on happy path', async () => {
    mockUpdateProductUseCase.execute.mockResolvedValue({
      data: {
        id: productId,
        name: 'Updated Chair',
        price: 99.99,
        state: 'draft',
      },
      meta: { timestamp: '2026-10-15T12:00:00.000Z' },
    });

    const response = await request(app)
      .patch(`/v1/products/${productId}`)
      .set('x-test-user-id', sellerId)
      .send({ price: 99.99 });

    expect(response.status).toBe(200);
    expect(response.body.data.price).toBe(99.99);
    expect(mockUpdateProductUseCase.execute).toHaveBeenCalledWith({
      productId,
      sellerId,
      fields: { price: 99.99 },
    });
  });

  it('returns 400 when body is empty', async () => {
    const response = await request(app)
      .patch(`/v1/products/${productId}`)
      .set('x-test-user-id', sellerId)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpdateProductUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when body contains forbidden/unknown field like slug', async () => {
    const response = await request(app)
      .patch(`/v1/products/${productId}`)
      .set('x-test-user-id', sellerId)
      .send({ slug: 'new-slug' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpdateProductUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when price is zero or negative', async () => {
    const response = await request(app)
      .patch(`/v1/products/${productId}`)
      .set('x-test-user-id', sellerId)
      .send({ price: -10 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpdateProductUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when currency is not in enum', async () => {
    const response = await request(app)
      .patch(`/v1/products/${productId}`)
      .set('x-test-user-id', sellerId)
      .send({ currency: 'JPY' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpdateProductUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 401 when no auth is provided', async () => {
    const response = await request(app).patch(`/v1/products/${productId}`).send({ price: 50 });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(mockUpdateProductUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 403 when user does not have seller role', async () => {
    const response = await request(app)
      .patch(`/v1/products/${productId}`)
      .set('x-test-user-id', sellerId)
      .set('x-test-role', 'buyer')
      .send({ price: 50 });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(mockUpdateProductUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 403 when cross-seller attempts to update', async () => {
    mockUpdateProductUseCase.execute.mockRejectedValue(
      Object.assign(new Error('You do not own this product'), {
        code: 'FORBIDDEN',
        statusCode: 403,
      })
    );

    const response = await request(app)
      .patch(`/v1/products/${productId}`)
      .set('x-test-user-id', '770e8400-e29b-41d4-a716-446655440002')
      .send({ price: 50 });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when product does not exist', async () => {
    mockUpdateProductUseCase.execute.mockRejectedValue(
      Object.assign(new Error('Product not found'), {
        code: 'PRODUCT_NOT_FOUND',
        statusCode: 404,
      })
    );

    const response = await request(app)
      .patch(`/v1/products/${productId}`)
      .set('x-test-user-id', sellerId)
      .send({ price: 50 });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('returns 409 when product is archived', async () => {
    mockUpdateProductUseCase.execute.mockRejectedValue(
      Object.assign(new Error("Cannot edit a product in state 'archived'"), {
        code: 'INVALID_STATE_TRANSITION',
        statusCode: 409,
      })
    );

    const response = await request(app)
      .patch(`/v1/products/${productId}`)
      .set('x-test-user-id', sellerId)
      .send({ price: 50 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('returns 409 when attempting to change currency on a published product', async () => {
    mockUpdateProductUseCase.execute.mockRejectedValue(
      Object.assign(
        new Error('Cannot change currency on a published product. Unpublish it first.'),
        {
          code: 'CANNOT_CHANGE_CURRENCY_ON_PUBLISHED',
          statusCode: 409,
        }
      )
    );

    const response = await request(app)
      .patch(`/v1/products/${productId}`)
      .set('x-test-user-id', sellerId)
      .send({ currency: 'EUR' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CANNOT_CHANGE_CURRENCY_ON_PUBLISHED');
  });
});
