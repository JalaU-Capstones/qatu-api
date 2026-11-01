import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { Order } from '../../../domain/entities/Order.js';
import { supabase } from '../../../infrastructure/config/supabase.js';
import { createOrderRouter } from '../orderRoutes.js';

vi.mock('../../../infrastructure/config/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('Order Routes Integration - /v1/orders', () => {
  let app;
  let mockListOrdersUseCase;
  let mockGetOrderByIdUseCase;

  const buyerId = '00000000-0000-0000-0000-000000000002';
  const orderId = '9d1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a';

  const validToken = 'fake-valid-supabase-token';
  const invalidToken = 'fake-invalid-supabase-token';

  const sampleOrder = new Order({
    id: orderId,
    orderNumber: 'ORD-00100042',
    buyerId,
    status: 'pending',
    currency: 'USD',
    subtotal: 100,
    shippingCost: 10,
    tax: 5,
    total: 115,
    createdAt: '2026-10-14T11:00:00.000Z',
    updatedAt: '2026-10-14T11:00:00.000Z',
  });

  beforeEach(() => {
    vi.clearAllMocks();

    supabase.auth.getUser.mockImplementation(async (token) => {
      // eslint-disable-next-line security/detect-possible-timing-attacks
      if (token === validToken) {
        return {
          data: {
            user: {
              id: buyerId,
              email: 'buyer@example.com',
              role: 'authenticated',
              user_metadata: { role: 'buyer' },
            },
          },
          error: null,
        };
      }
      return {
        data: { user: null },
        error: { message: 'invalid' },
      };
    });

    mockListOrdersUseCase = {
      execute: vi.fn(),
    };

    mockGetOrderByIdUseCase = {
      execute: vi.fn(),
    };

    const orderRoutes = createOrderRouter({
      listOrdersUseCase: mockListOrdersUseCase,
      getOrderByIdUseCase: mockGetOrderByIdUseCase,
    });

    app = createApp({ orderRoutes });
  });

  describe('GET /v1/orders', () => {
    it('returns 401 when token is missing', async () => {
      const res = await request(app).get('/v1/orders');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when token is invalid', async () => {
      const res = await request(app)
        .get('/v1/orders')
        .set('Authorization', `Bearer ${invalidToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('Scenario: View own orders - returns paginated orders for authenticated buyer', async () => {
      mockListOrdersUseCase.execute.mockResolvedValue({
        data: [sampleOrder.toJSON()],
        meta: {
          page: 1,
          per_page: 20,
          total: 1,
          total_pages: 1,
        },
      });

      const res = await request(app).get('/v1/orders').set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        id: orderId,
        order_number: 'ORD-00100042',
        status: 'pending',
        total: 115,
        created_at: '2026-10-14T11:00:00.000Z',
      });
      expect(res.body.meta).toEqual({
        page: 1,
        per_page: 20,
        total: 1,
        total_pages: 1,
      });
    });

    it('authenticates successfully via access_token HttpOnly cookie', async () => {
      mockListOrdersUseCase.execute.mockResolvedValue({
        data: [sampleOrder.toJSON()],
        meta: {
          page: 1,
          per_page: 20,
          total: 1,
          total_pages: 1,
        },
      });

      const res = await request(app)
        .get('/v1/orders')
        .set('Cookie', [`access_token=${validToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(mockListOrdersUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ buyerId })
      );
    });

    it('Scenario: No orders - returns empty list with total 0', async () => {
      mockListOrdersUseCase.execute.mockResolvedValue({
        data: [],
        meta: {
          page: 1,
          per_page: 20,
          total: 0,
          total_pages: 0,
        },
      });

      const res = await request(app).get('/v1/orders').set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('passes pagination and status filter queries to use case', async () => {
      mockListOrdersUseCase.execute.mockResolvedValue({
        data: [],
        meta: { page: 2, per_page: 5, total: 10, total_pages: 2 },
      });

      const res = await request(app)
        .get('/v1/orders?page=2&limit=5&status=confirmed')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(mockListOrdersUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          buyerId,
          page: 2,
          limit: 5,
          status: 'confirmed',
        })
      );
    });
  });

  describe('GET /v1/orders/:id', () => {
    it('Scenario: Cannot see other buyers orders - receives 403 Forbidden', async () => {
      const forbiddenError = new Error('You do not have permission to access this order');
      forbiddenError.code = 'FORBIDDEN';
      forbiddenError.statusCode = 403;
      mockGetOrderByIdUseCase.execute.mockRejectedValue(forbiddenError);

      const res = await request(app)
        .get(`/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toEqual({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this order',
      });
    });

    it('returns 200 with order details for own order', async () => {
      mockGetOrderByIdUseCase.execute.mockResolvedValue({
        data: sampleOrder.toJSON(),
        meta: { timestamp: new Date().toISOString() },
      });

      const res = await request(app)
        .get(`/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(orderId);
      expect(res.body.data.total).toBe(115);
    });

    it('returns 200 with order details via access_token cookie', async () => {
      mockGetOrderByIdUseCase.execute.mockResolvedValue({
        data: sampleOrder.toJSON(),
        meta: { timestamp: new Date().toISOString() },
      });

      const res = await request(app)
        .get(`/v1/orders/${orderId}`)
        .set('Cookie', [`access_token=${validToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(orderId);
    });

    it('returns 404 when order is not found', async () => {
      const notFoundError = new Error('Order not found');
      notFoundError.code = 'NOT_FOUND';
      notFoundError.statusCode = 404;
      mockGetOrderByIdUseCase.execute.mockRejectedValue(notFoundError);

      const res = await request(app)
        .get('/v1/orders/nonexistent-id')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
