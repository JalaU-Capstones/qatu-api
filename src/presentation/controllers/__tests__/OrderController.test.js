import { describe, it, expect, vi } from 'vitest';
import { OrderController } from '../OrderController.js';

describe('OrderController', () => {
  const userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  it('throws error if listOrdersUseCase is missing in constructor', () => {
    expect(() => new OrderController()).toThrow('listOrdersUseCase is required');
  });

  it('listOrders returns 200 with result when authenticated', async () => {
    const mockListUC = {
      execute: vi.fn().mockResolvedValue({
        data: [{ id: 'order-1', order_number: 'ORD-00100042' }],
        meta: { page: 1, per_page: 20, total: 1, total_pages: 1 },
      }),
    };

    const controller = new OrderController({ listOrdersUseCase: mockListUC });

    const req = {
      user: { id: userId },
      validatedQuery: { page: 1, limit: 20 },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await controller.listOrders(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: [{ id: 'order-1', order_number: 'ORD-00100042' }],
      meta: { page: 1, per_page: 20, total: 1, total_pages: 1 },
    });
  });

  it('listOrders forwards error to next when unauthenticated', async () => {
    const mockListUC = { execute: vi.fn() };
    const controller = new OrderController({ listOrdersUseCase: mockListUC });

    const req = { user: null };
    const res = {};
    const next = vi.fn();

    await controller.listOrders(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'UNAUTHORIZED',
        statusCode: 401,
      })
    );
  });

  it('getOrderById returns 200 with order details', async () => {
    const mockGetByIdUC = {
      execute: vi.fn().mockResolvedValue({
        data: { id: 'order-1', order_number: 'ORD-00100042' },
        meta: { timestamp: '2026-10-14T11:00:00.000Z' },
      }),
    };

    const controller = new OrderController({
      listOrdersUseCase: { execute: vi.fn() },
      getOrderByIdUseCase: mockGetByIdUC,
    });

    const req = {
      user: { id: userId, role: 'buyer' },
      params: { id: 'order-1' },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await controller.getOrderById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { id: 'order-1', order_number: 'ORD-00100042' },
      })
    );
  });
});

