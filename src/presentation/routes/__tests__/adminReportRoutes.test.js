import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../app.js';
import { createAdminReportRouter } from '../adminReportRoutes.js';

vi.mock('../../middleware/authMiddleware.js', () => ({
  authMiddleware: (req, _res, next) => {
    if (!req.headers['x-test-user-id']) {
      const err = new Error('Authentication required');
      err.code = 'UNAUTHORIZED';
      err.statusCode = 401;
      return next(err);
    }
    req.user = { id: req.headers['x-test-user-id'] };
    return next();
  },
}));

vi.mock('../../middleware/requireAdminRole.js', () => ({
  requireAdminRole: () => (req, _res, next) => {
    if (req.headers['x-test-role'] !== 'admin') {
      const err = new Error('Admin role required');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      return next(err);
    }
    return next();
  },
}));

describe('Admin report routes', () => {
  let app;
  let getSalesReportUseCase;
  let getUsersReportUseCase;
  let getProductsReportUseCase;

  beforeEach(() => {
    getSalesReportUseCase = { execute: vi.fn() };
    getUsersReportUseCase = { execute: vi.fn() };
    getProductsReportUseCase = { execute: vi.fn() };

    const router = createAdminReportRouter({
      getSalesReportUseCase,
      getUsersReportUseCase,
      getProductsReportUseCase,
    });
    app = createApp({ adminReportRoutes: router });
  });

  function asAdmin() {
    return { 'x-test-user-id': 'admin-1', 'x-test-role': 'admin' };
  }

  it('returns the sales report for an admin', async () => {
    getSalesReportUseCase.execute.mockResolvedValue({
      data: { currency: 'BOB', total_revenue: 10, total_orders: 1, period_breakdown: [] },
      meta: { timestamp: '2026-03-01T00:00:00.000Z' },
    });

    const response = await request(app)
      .get('/v1/admin/reports/sales')
      .query({ from: '2026-03-01', to: '2026-03-31', group_by: 'week' })
      .set(asAdmin());

    expect(response.status).toBe(200);
    expect(response.body.data.total_revenue).toBe(10);
    expect(getSalesReportUseCase.execute).toHaveBeenCalledWith({
      from: '2026-03-01',
      to: '2026-03-31',
      groupBy: 'week',
    });
  });

  it('returns 401 when the caller is anonymous', async () => {
    const response = await request(app)
      .get('/v1/admin/reports/sales')
      .query({ from: '2026-03-01', to: '2026-03-31' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(getSalesReportUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller is not an admin', async () => {
    const response = await request(app)
      .get('/v1/admin/reports/users')
      .query({ from: '2026-03-01', to: '2026-03-31' })
      .set('x-test-user-id', 'buyer-1');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(getUsersReportUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when the date range is missing', async () => {
    const response = await request(app).get('/v1/admin/reports/products').set(asAdmin());

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(getProductsReportUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns the user and product reports', async () => {
    getUsersReportUseCase.execute.mockResolvedValue({
      data: { buyer_count: 4, seller_count: 1, pending_seller_applications: 2 },
      meta: { timestamp: '2026-03-01T00:00:00.000Z' },
    });
    getProductsReportUseCase.execute.mockResolvedValue({
      data: { published_products: 3, draft_products: 1, unpublished_products: 1 },
      meta: { timestamp: '2026-03-01T00:00:00.000Z' },
    });

    const users = await request(app)
      .get('/v1/admin/reports/users')
      .query({ from: '2026-03-01', to: '2026-03-31' })
      .set(asAdmin());
    const products = await request(app)
      .get('/v1/admin/reports/products')
      .query({ from: '2026-03-01', to: '2026-03-31' })
      .set(asAdmin());

    expect(users.status).toBe(200);
    expect(users.body.data.pending_seller_applications).toBe(2);
    expect(products.status).toBe(200);
    expect(products.body.data.unpublished_products).toBe(1);
  });
});
