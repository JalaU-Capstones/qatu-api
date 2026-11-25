import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  describe('role claims are never forwarded to the use cases (ADR-017)', () => {
    // `req.user.role` is derived from user_metadata, which the end user can edit.
    const forgedUser = { id: userId, role: 'admin' };
    const makeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });

    it('listOrders passes only the user id and query, not the role', async () => {
      const listOrdersUseCase = {
        execute: vi.fn().mockResolvedValue({ data: [], meta: {} }),
      };
      const controller = new OrderController({ listOrdersUseCase });

      await controller.listOrders(
        { user: forgedUser, validatedQuery: { view: 'admin' } },
        makeRes(),
        vi.fn()
      );

      const [dto] = listOrdersUseCase.execute.mock.calls[0];
      expect(dto.userId).toBe(userId);
      expect(dto.view).toBe('admin'); // the use case still authorizes it against user_roles
      expect(JSON.stringify(dto)).not.toContain('roleHint');
    });

    it('getOrderById passes only orderId and userId', async () => {
      const getOrderByIdUseCase = { execute: vi.fn().mockResolvedValue({ data: {} }) };
      const controller = new OrderController({
        listOrdersUseCase: { execute: vi.fn() },
        getOrderByIdUseCase,
      });

      await controller.getOrderById(
        { user: forgedUser, params: { id: 'order-1' } },
        makeRes(),
        vi.fn()
      );

      expect(getOrderByIdUseCase.execute).toHaveBeenCalledWith({
        orderId: 'order-1',
        userId,
      });
    });

    it('updateOrderStatus passes only orderId, userId and the requested status', async () => {
      const updateOrderStatusUseCase = { execute: vi.fn().mockResolvedValue({ data: {} }) };
      const controller = new OrderController({
        listOrdersUseCase: { execute: vi.fn() },
        updateOrderStatusUseCase,
      });
      const res = makeRes();

      await controller.updateOrderStatus(
        { user: forgedUser, params: { id: 'order-1' }, validatedBody: { status: 'shipped' } },
        res,
        vi.fn()
      );

      expect(updateOrderStatusUseCase.execute).toHaveBeenCalledWith({
        orderId: 'order-1',
        userId,
        nextStatus: 'shipped',
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
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

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ORDER_ID = '9d1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a';

function createResponse() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json };
}

describe('OrderController — remaining branches', () => {
  let useCases;
  let controller;

  beforeEach(() => {
    useCases = {
      listOrdersUseCase: { execute: vi.fn() },
      getOrderByIdUseCase: { execute: vi.fn() },
      createOrderUseCase: { execute: vi.fn() },
      updateOrderStatusUseCase: { execute: vi.fn() },
    };
    controller = new OrderController(useCases);
  });

  describe('listOrders', () => {
    it('defaults to an empty query and forwards use case errors', async () => {
      useCases.listOrdersUseCase.execute.mockResolvedValueOnce({ data: [] });

      await controller.listOrders({ user: { id: USER_ID } }, createResponse(), vi.fn());

      expect(useCases.listOrdersUseCase.execute.mock.calls[0][0]).toMatchObject({
        userId: USER_ID,
        page: 1,
        limit: 20,
        status: undefined,
        view: 'buyer',
      });

      const error = new Error('db down');
      useCases.listOrdersUseCase.execute.mockRejectedValueOnce(error);
      const next = vi.fn();
      await controller.listOrders({ user: { id: USER_ID } }, createResponse(), next);
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getOrderById', () => {
    it('forwards UNAUTHORIZED and missing use case errors', async () => {
      let next = vi.fn();
      await controller.getOrderById({}, createResponse(), next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'UNAUTHORIZED', statusCode: 401 })
      );

      const without = new OrderController({ listOrdersUseCase: useCases.listOrdersUseCase });
      next = vi.fn();
      await without.getOrderById({ user: { id: USER_ID }, params: { id: ORDER_ID } }, {}, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'getOrderByIdUseCase is not configured',
        })
      );
    });

    it('forwards use case errors', async () => {
      const error = new Error('not found');
      useCases.getOrderByIdUseCase.execute.mockRejectedValue(error);
      const next = vi.fn();

      await controller.getOrderById(
        { user: { id: USER_ID }, params: { id: ORDER_ID } },
        createResponse(),
        next
      );

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateOrderStatus', () => {
    it('uses raw body and forwards UNAUTHORIZED and missing use case errors', async () => {
      useCases.updateOrderStatusUseCase.execute.mockResolvedValue({ data: {} });

      await controller.updateOrderStatus(
        { user: { id: USER_ID }, params: { id: ORDER_ID }, body: { status: 'shipped' } },
        createResponse(),
        vi.fn()
      );
      expect(useCases.updateOrderStatusUseCase.execute).toHaveBeenCalledWith({
        orderId: ORDER_ID,
        userId: USER_ID,
        nextStatus: 'shipped',
      });

      let next = vi.fn();
      await controller.updateOrderStatus({}, createResponse(), next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'UNAUTHORIZED', statusCode: 401 })
      );

      const without = new OrderController({ listOrdersUseCase: useCases.listOrdersUseCase });
      next = vi.fn();
      await without.updateOrderStatus(
        { user: { id: USER_ID }, params: { id: ORDER_ID } },
        {},
        next
      );
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'updateOrderStatusUseCase is not configured',
        })
      );
    });

    it('forwards use case errors', async () => {
      const error = new Error('boom');
      useCases.updateOrderStatusUseCase.execute.mockRejectedValue(error);
      const next = vi.fn();

      await controller.updateOrderStatus(
        { user: { id: USER_ID }, params: { id: ORDER_ID }, validatedBody: { status: 'shipped' } },
        createResponse(),
        next
      );

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  it('tolerates a fully missing body in createOrder and updateOrderStatus', async () => {
    const noBodyReq = { user: { id: USER_ID }, params: { id: ORDER_ID } };

    const next = vi.fn();
    await controller.createOrder(noBodyReq, createResponse(), next);
    expect(next).toHaveBeenCalled();

    useCases.updateOrderStatusUseCase.execute.mockResolvedValueOnce({ data: {} });
    await controller.updateOrderStatus(noBodyReq, createResponse(), vi.fn());
    expect(useCases.updateOrderStatusUseCase.execute).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      userId: USER_ID,
      nextStatus: undefined,
    });
  });

  describe('createOrder', () => {
    it('uses raw body and forwards use case errors', async () => {
      useCases.createOrderUseCase.execute.mockResolvedValueOnce({ data: {} });

      await controller.createOrder(
        {
          user: { id: USER_ID },
          body: {
            payment_method: 'cash_on_delivery',
            shipping_address: {
              full_name: 'Aaron Florez',
              phone: '71234567',
              street: '123 Main St',
              city: 'La Paz',
              country: 'BO',
            },
          },
        },
        createResponse(),
        vi.fn()
      );
      expect(useCases.createOrderUseCase.execute.mock.calls[0][0]).toMatchObject({
        buyerId: USER_ID,
        paymentMethod: 'cash_on_delivery',
      });

      const error = new Error('boom');
      useCases.createOrderUseCase.execute.mockRejectedValueOnce(error);
      const next = vi.fn();
      await controller.createOrder(
        {
          user: { id: USER_ID },
          body: {
            shipping_address: {
              full_name: 'Aaron Florez',
              phone: '71234567',
              street: '123 Main St',
              city: 'La Paz',
              country: 'BO',
            },
          },
        },
        createResponse(),
        next
      );
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
