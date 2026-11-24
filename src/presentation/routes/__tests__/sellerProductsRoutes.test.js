import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../middleware/errorHandler.js';
import { createSellerProductsRouter } from '../sellerProductsRoutes.js';

vi.mock('../../middleware/authMiddleware.js', () => ({
  authMiddleware: (req, _res, next) => {
    req.user = { id: 'seller-1' };
    return next();
  },
}));

vi.mock('../../middleware/requireSellerRole.js', () => ({
  requireSellerRole: () => (req, _res, next) => {
    req.user.roles = ['seller'];
    return next();
  },
}));

describe('seller products routes', () => {
  let app;
  let productController;

  beforeEach(() => {
    productController = {
      listSellerProducts: vi.fn((_req, res) => res.status(200).json({ data: [] })),
    };
    const router = createSellerProductsRouter({ productController });

    app = express();
    app.use('/v1/seller', router);
    app.use(errorHandler);
  });

  it('validates the query and delegates GET /products to the controller', async () => {
    const response = await request(app).get('/v1/seller/products?page=1&limit=10');

    expect(response.status).toBe(200);
    expect(productController.listSellerProducts).toHaveBeenCalledOnce();
  });

  it('rejects an invalid status before reaching the controller', async () => {
    const response = await request(app).get('/v1/seller/products?status=unknown');

    expect(response.status).toBe(400);
    expect(productController.listSellerProducts).not.toHaveBeenCalled();
  });
});
