import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CartController } from '../CartController.js';

describe('CartController', () => {
  let controller;
  let mockAddToCartUseCase;
  let mockUpdateCartItemUseCase;
  let mockRemoveCartItemUseCase;
  let mockClearCartUseCase;
  let mockGetCartUseCase;
  let req;
  let res;
  let next;

  const userId = '00000000-0000-4000-8000-000000000002';
  const productId = '10000000-0000-4000-8000-000000000001';
  const cartItemId = 'c4b3a2d1-0000-0000-0000-000000000001';

  beforeEach(() => {
    mockAddToCartUseCase = { execute: vi.fn() };
    mockUpdateCartItemUseCase = { execute: vi.fn() };
    mockRemoveCartItemUseCase = { execute: vi.fn() };
    mockClearCartUseCase = { execute: vi.fn() };
    mockGetCartUseCase = { execute: vi.fn() };

    controller = new CartController({
      addToCartUseCase: mockAddToCartUseCase,
      updateCartItemUseCase: mockUpdateCartItemUseCase,
      removeCartItemUseCase: mockRemoveCartItemUseCase,
      clearCartUseCase: mockClearCartUseCase,
      getCartUseCase: mockGetCartUseCase,
    });

    req = {
      user: { id: userId },
      params: {},
      body: {},
      validatedBody: {},
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    next = vi.fn();
  });

  it('requires addToCartUseCase in the constructor', () => {
    expect(() => new CartController()).toThrow('addToCartUseCase is required');
  });

  describe('addItem', () => {
    it('forwards an UNAUTHORIZED error when the user is missing', async () => {
      req.user = null;

      await controller.addItem(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'UNAUTHORIZED', statusCode: 401 })
      );
      expect(mockAddToCartUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe('getCart', () => {
    it('forwards an error when getCartUseCase is not injected', async () => {
      const withoutGetCart = new CartController({ addToCartUseCase: mockAddToCartUseCase });

      await withoutGetCart.getCart(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'getCartUseCase is not injected' })
      );
    });
  });

  it('uses the raw body when validatedBody is absent in addItem', async () => {
    req.validatedBody = undefined;
    req.body = { product_id: productId, quantity: 2 };
    mockAddToCartUseCase.execute.mockResolvedValue({ toJSON: () => ({ id: 'item-1' }) });

    await controller.addItem(req, res, next);

    expect(mockAddToCartUseCase.execute.mock.calls[0][0]).toMatchObject({
      userId,
      productId,
      quantity: 2,
    });
  });

  describe('updateItem', () => {
    it('Scenario 1: Valid request -> 200 OK with formatted JSON', async () => {
      req.params = { id: cartItemId };
      req.validatedBody = { quantity: 3 };

      const mockItem = {
        toJSON: () => ({ id: cartItemId, productId, quantity: 3 }),
      };
      mockUpdateCartItemUseCase.execute.mockResolvedValue(mockItem);

      await controller.updateItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: { id: cartItemId, productId, quantity: 3 },
        meta: expect.objectContaining({ timestamp: expect.any(String) }),
      });
    });

    it('Scenario 2: Missing auth user -> calls next with 401 UNAUTHORIZED', async () => {
      req.user = null;

      await controller.updateItem(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
          statusCode: 401,
        })
      );
    });
  });

  it('uses the raw body and returns null when updateItem finds no item', async () => {
    req.params = { id: cartItemId };
    req.validatedBody = undefined;
    req.body = { quantity: 2 };
    mockUpdateCartItemUseCase.execute.mockResolvedValue(null);

    await controller.updateItem(req, res, next);

    expect(mockUpdateCartItemUseCase.execute).toHaveBeenCalledWith({
      userId,
      cartItemId,
      quantity: 2,
    });
    expect(res.json).toHaveBeenCalledWith({
      data: null,
      meta: expect.objectContaining({ timestamp: expect.any(String) }),
    });
  });

  describe('removeItem', () => {
    it('Scenario 1: Valid request -> 204 No Content', async () => {
      req.params = { id: cartItemId };
      mockRemoveCartItemUseCase.execute.mockResolvedValue();

      await controller.removeItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('Scenario 2: Missing auth user -> calls next with 401 UNAUTHORIZED', async () => {
      req.user = null;

      await controller.removeItem(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
          statusCode: 401,
        })
      );
    });
  });

  describe('clearCart', () => {
    it('Scenario 1: Valid request -> 204 No Content', async () => {
      mockClearCartUseCase.execute.mockResolvedValue();

      await controller.clearCart(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('Scenario 2: Missing auth user -> calls next with 401 UNAUTHORIZED', async () => {
      req.user = null;

      await controller.clearCart(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
          statusCode: 401,
        })
      );
    });
  });

  describe('getCart', () => {
    beforeEach(() => {
      req.validatedQuery = {};
      req.query = {};
    });

    it('Scenario 1: Valid request without include -> 200 OK and passes includeProduct: false', async () => {
      const items = [{ id: cartItemId, user_id: userId, product_id: productId, quantity: 1 }];
      mockGetCartUseCase.execute.mockResolvedValue(items);

      await controller.getCart(req, res, next);

      expect(mockGetCartUseCase.execute).toHaveBeenCalledWith({ userId, includeProduct: false });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: items,
        meta: expect.objectContaining({ timestamp: expect.any(String) }),
      });
    });

    it('Scenario 2: Valid request with include=product -> passes includeProduct: true', async () => {
      req.query = { include: 'product' };
      const items = [
        {
          id: cartItemId,
          user_id: userId,
          product_id: productId,
          quantity: 1,
          product: { id: productId, name: 'Chair' },
        },
      ];
      mockGetCartUseCase.execute.mockResolvedValue(items);

      await controller.getCart(req, res, next);

      expect(mockGetCartUseCase.execute).toHaveBeenCalledWith({ userId, includeProduct: true });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: items,
        meta: expect.objectContaining({ timestamp: expect.any(String) }),
      });
    });

    it('Scenario 3: Missing auth user -> calls next with 401 UNAUTHORIZED', async () => {
      req.user = null;

      await controller.getCart(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
          statusCode: 401,
        })
      );
      expect(mockGetCartUseCase.execute).not.toHaveBeenCalled();
    });

    it('Scenario 4: Use case error -> calls next with the error', async () => {
      const failure = new Error('boom');
      mockGetCartUseCase.execute.mockRejectedValue(failure);

      await controller.getCart(req, res, next);

      expect(next).toHaveBeenCalledWith(failure);
    });
  });
});
