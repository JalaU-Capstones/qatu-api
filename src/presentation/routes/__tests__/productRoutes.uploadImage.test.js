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

vi.mock('../../middleware/multipartProductImageMiddleware.js', () => ({
  multipartProductImageMiddleware: (req, _res, next) => {
    if (!req.headers['x-test-file']) {
      const err = new Error('image field is required');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      return next(err);
    }

    req.file = {
      buffer: Buffer.from('x'),
      mimeType: 'image/png',
      size: 1,
      originalName: 'a.png',
    };
    return next();
  },
}));

describe('Product Routes - POST /v1/products/:id/images', () => {
  let app;
  let mockUploadProductImageUseCase;

  beforeEach(() => {
    mockUploadProductImageUseCase = {
      execute: vi.fn(),
    };

    const customRouter = createProductRouter({
      uploadProductImageUseCase: mockUploadProductImageUseCase,
    });

    app = createApp({ productRoutes: customRouter });
  });

  it('should upload a product image with 201 status', async () => {
    const productId = '11111111-1111-4111-8111-111111111111';
    const sellerId = '22222222-2222-4222-8222-222222222222';
    const location = `/v1/products/${productId}/images/img-1`;

    mockUploadProductImageUseCase.execute.mockResolvedValue({
      data: { id: 'img-1', product_id: productId, path: 'product-images/abc/cover.webp' },
      meta: { timestamp: '2026-10-15T10:00:00.000Z' },
      location,
    });

    const response = await request(app)
      .post(`/v1/products/${productId}/images`)
      .set('x-test-user-id', sellerId)
      .set('x-test-file', 'present');

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe(location);
    expect(response.body.data.id).toBe('img-1');
    expect(response.body.meta.timestamp).toBe('2026-10-15T10:00:00.000Z');
    expect(mockUploadProductImageUseCase.execute).toHaveBeenCalledTimes(1);
    expect(mockUploadProductImageUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ productId, sellerId, altText: null, position: null })
    );
  });

  it('should return 400 when the multipart middleware rejects a missing file', async () => {
    const productId = '11111111-1111-4111-8111-111111111111';

    const response = await request(app)
      .post(`/v1/products/${productId}/images`)
      .set('x-test-user-id', '22222222-2222-4222-8222-222222222222');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('image field is required');
    expect(mockUploadProductImageUseCase.execute).not.toHaveBeenCalled();
  });

  it('should return 403 when the use case rejects ownership', async () => {
    const productId = '11111111-1111-4111-8111-111111111111';
    const sellerId = '22222222-2222-4222-8222-222222222222';

    mockUploadProductImageUseCase.execute.mockRejectedValue(
      Object.assign(new Error('You do not own this product'), {
        code: 'FORBIDDEN',
        statusCode: 403,
      })
    );

    const response = await request(app)
      .post(`/v1/products/${productId}/images`)
      .set('x-test-user-id', sellerId)
      .set('x-test-file', 'present');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(mockUploadProductImageUseCase.execute).toHaveBeenCalledTimes(1);
  });
});
