import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CartController } from '../CartController.js';

describe('CartController', () => {
  let controller;
  let mockAddToCartUseCase;
  let mockUpdateCartItemUseCase;
  let mockRemoveCartItemUseCase;
  let mockClearCartUseCase;
  let req;
  let res;
  let next;

  const userId = '00000000-0000-0000-0000-000000000002';
  const productId = '10000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    mockAddToCartUseCase = { execute: vi.fn() };
    mockUpdateCartItemUseCase = { execute: vi.fn() };
    mockRemoveCartItemUseCase = { execute: vi.fn() };
    mockClearCartUseCase = { execute: vi.fn() };

    controller = new CartController({
      addToCartUseCase: mockAddToCartUseCase,
      updateCartItemUseCase: mockUpdateCartItemUseCase,
      removeCartItemUseCase: mockRemoveCartItemUseCase,
      clearCartUseCase: mockClearCartUseCase,
    });

    req = {
      user: { id: userId },
      params: {},
      body: {},
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    next = vi.fn();
  });

  describe('updateItem', () => {
    it('Scenario 1: Valid request -> 200 OK with formatted JSON', async () => {
      req.params = { productId };
      req.validatedBody = { quantity: 3 };

      const mockItem = {
        toJSON: () => ({ id: 'item-1', productId, quantity: 3 }),
      };
      mockUpdateCartItemUseCase.execute.mockResolvedValue(mockItem);

      await controller.updateItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: { id: 'item-1', productId, quantity: 3 },
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

  describe('removeItem', () => {
    it('Scenario 1: Valid request -> 204 No Content', async () => {
      req.params = { productId };
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
});
