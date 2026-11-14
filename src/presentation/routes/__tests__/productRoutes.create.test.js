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

describe('Product Routes - POST /v1/products', () => {
  let app;
  let mockCreateProductUseCase;

  beforeEach(() => {
    mockCreateProductUseCase = {
      execute: vi.fn(),
    };

    const customRouter = createProductRouter({
      createProductUseCase: mockCreateProductUseCase,
    });

    app = createApp({ productRoutes: customRouter });
  });

  it('should create a draft product with 201 status', async () => {
    const sellerId = '11111111-1111-4111-8111-111111111111';
    mockCreateProductUseCase.execute.mockResolvedValue({
      data: { id: 'p1', name: 'Test Product', slug: 'test-product', state: 'draft' },
      meta: { timestamp: '2026-10-15T10:00:00.000Z' },
    });

    const response = await request(app).post('/v1/products').set('x-test-user-id', sellerId).send({
      name: 'Test Product',
      price: 19.99,
      category_id: '22222222-2222-4222-8222-222222222222',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.state).toBe('draft');
    expect(response.body.meta.timestamp).toBeDefined();
    expect(mockCreateProductUseCase.execute).toHaveBeenCalledTimes(1);
    const dto = mockCreateProductUseCase.execute.mock.calls[0][0];
    expect(dto.sellerId).toBe(sellerId);
  });

  it('should return 400 when category_id is missing', async () => {
    const response = await request(app)
      .post('/v1/products')
      .set('x-test-user-id', '11111111-1111-4111-8111-111111111111')
      .send({
        name: 'X',
        price: 19.99,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'category_id', message: expect.any(String) }),
      ])
    );
    expect(mockCreateProductUseCase.execute).not.toHaveBeenCalled();
  });

  it('should return 400 when category_id is not a valid UUID', async () => {
    const response = await request(app)
      .post('/v1/products')
      .set('x-test-user-id', '11111111-1111-4111-8111-111111111111')
      .send({
        name: 'X',
        price: 19.99,
        category_id: 'not-a-uuid',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'category_id',
          message: 'category_id must be a valid UUID',
        }),
      ])
    );
    expect(mockCreateProductUseCase.execute).not.toHaveBeenCalled();
  });
});
