import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../middleware/errorHandler.js';
import { createAdminSellerApplicationRouter } from '../adminSellerApplicationRoutes.js';

vi.mock('../../middleware/authMiddleware.js', () => ({
  authMiddleware: (req, _res, next) => {
    req.user = { id: 'admin-1' };
    return next();
  },
}));

vi.mock('../../middleware/requireAdminRole.js', () => ({
  requireAdminRole: () => (req, _res, next) => next(),
}));

const APPLICATION_ID = '22222222-2222-4222-8222-222222222222';

describe('admin seller application routes', () => {
  let app;
  let controller;

  beforeEach(() => {
    controller = {
      list: vi.fn((_req, res) => res.status(200).json({ data: [] })),
      review: vi.fn((_req, res) => res.status(200).json({ data: {} })),
    };
    const router = createAdminSellerApplicationRouter({
      adminSellerApplicationController: controller,
    });

    app = express();
    app.use(express.json());
    app.use('/v1/admin/seller-applications', router);
    app.use(errorHandler);
  });

  it('validates the query and delegates GET / to the controller', async () => {
    const response = await request(app).get('/v1/admin/seller-applications?status=pending&page=1');

    expect(response.status).toBe(200);
    expect(controller.list).toHaveBeenCalledOnce();
    expect(response.body.data).toEqual([]);
  });

  it('rejects an invalid status before reaching the controller', async () => {
    const response = await request(app).get('/v1/admin/seller-applications?status=unknown');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(controller.list).not.toHaveBeenCalled();
  });

  it('validates the params and body and delegates PATCH /:id to the controller', async () => {
    const response = await request(app)
      .patch(`/v1/admin/seller-applications/${APPLICATION_ID}`)
      .send({ status: 'approved' });

    expect(response.status).toBe(200);
    expect(controller.review).toHaveBeenCalledOnce();
  });

  it('rejects an invalid application id before reaching the controller', async () => {
    const response = await request(app)
      .patch('/v1/admin/seller-applications/not-a-uuid')
      .send({ status: 'approved' });

    expect(response.status).toBe(400);
    expect(controller.review).not.toHaveBeenCalled();
  });
});
