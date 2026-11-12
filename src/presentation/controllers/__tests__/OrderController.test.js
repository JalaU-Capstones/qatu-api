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
  describe('createOrder (US-10)', () => {
    const body = {
      shipping_address: {
        full_name: 'Aaron Florez',
        phone: '71234567',
        street: '123 Main St',
        city: 'La Paz',
        country: 'BO',
      },
      payment_method: 'cash_on_delivery',
      notes: 'Leave at reception',
    };
    const makeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });

    it('returns 201 with the use case result, using the session user as buyer', async () => {
      const result = { data: { id: 'order-1' }, meta: { timestamp: 'now' } };
      const createOrderUseCase = { execute: vi.fn().mockResolvedValue(result) };
      const controller = new OrderController({
        listOrdersUseCase: { execute: vi.fn() },
        createOrderUseCase,
      });
      const res = makeRes();
      const next = vi.fn();

      await controller.createOrder(
        { user: { id: userId }, validatedBody: { ...body, buyer_id: 'forged' } },
        res,
        next
      );

      expect(createOrderUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          buyerId: userId,
          paymentMethod: 'cash_on_delivery',
          notes: 'Leave at reception',
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(result);
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards a 401 to next when there is no authenticated user', async () => {
      const controller = new OrderController({
        listOrdersUseCase: { execute: vi.fn() },
        createOrderUseCase: { execute: vi.fn() },
      });
      const next = vi.fn();

      await controller.createOrder({ validatedBody: body }, makeRes(), next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it('forwards business errors (e.g. 422) untouched', async () => {
      const failure = Object.assign(new Error('Your cart is empty'), { statusCode: 422 });
      const controller = new OrderController({
        listOrdersUseCase: { execute: vi.fn() },
        createOrderUseCase: { execute: vi.fn().mockRejectedValue(failure) },
      });
      const next = vi.fn();

      await controller.createOrder({ user: { id: userId }, validatedBody: body }, makeRes(), next);

      expect(next).toHaveBeenCalledWith(failure);
    });

    it('fails with 500 when the use case is not wired', async () => {
      const controller = new OrderController({ listOrdersUseCase: { execute: vi.fn() } });
      const next = vi.fn();

      await controller.createOrder({ user: { id: userId }, validatedBody: body }, makeRes(), next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500 }));
    });
  });
});
