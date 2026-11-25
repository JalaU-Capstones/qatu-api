import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../middleware/errorHandler.js';
import { createSellerApplicationRouter } from '../sellerApplicationRoutes.js';

vi.mock('../../middleware/authMiddleware.js', () => ({
  authMiddleware: (req, _res, next) => {
    req.user = { id: req.headers['x-test-user-id'] };
    return next();
  },
}));

const PROFILE_ID = '11111111-1111-4111-8111-111111111111';

describe('seller application routes', () => {
  let app;
  let controller;

  beforeEach(() => {
    controller = {
      getMe: vi.fn((req, res) => res.status(200).json({ data: { id: 'app-1' } })),
      apply: vi.fn((req, res) => res.status(201).json({ data: { id: 'app-1' } })),
    };
    const router = createSellerApplicationRouter({ sellerApplicationController: controller });

    app = express();
    app.use(express.json());
    app.use('/v1/seller-applications', router);
    app.use(errorHandler);
  });

  it('delegates GET /me to the controller', async () => {
    const response = await request(app)
      .get('/v1/seller-applications/me')
      .set('x-test-user-id', PROFILE_ID);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('app-1');
    expect(controller.getMe).toHaveBeenCalledOnce();
  });

  it('validates the body and delegates POST / to the controller', async () => {
    const response = await request(app)
      .post('/v1/seller-applications')
      .set('x-test-user-id', PROFILE_ID)
      .send({
        business_name: 'Mi Tienda',
        business_description: 'Venta de productos artesanales hechos a mano.',
      });

    expect(response.status).toBe(201);
    expect(controller.apply).toHaveBeenCalledOnce();
  });

  it('rejects an invalid POST body before reaching the controller', async () => {
    const response = await request(app)
      .post('/v1/seller-applications')
      .set('x-test-user-id', PROFILE_ID)
      .send({ business_name: 'A' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(controller.apply).not.toHaveBeenCalled();
  });
});
