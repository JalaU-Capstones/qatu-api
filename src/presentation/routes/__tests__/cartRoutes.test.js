import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { supabase } from '../../../infrastructure/config/supabase.js';
import { CartRepository } from '../../../infrastructure/persistence/repositories/CartRepository.js';
import { createCartRouter } from '../cartRoutes.js';

vi.mock('../../../infrastructure/config/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('Cart Routes Integration', () => {
  let app;
  let mockAddToCartUseCase;
  let mockUpdateCartItemUseCase;
  let mockRemoveCartItemUseCase;
  let mockClearCartUseCase;

  const userId = '00000000-0000-0000-0000-000000000002';
  const productId = '10000000-0000-0000-0000-000000000001';

  const validToken = 'fake-valid-supabase-token';
  const invalidToken = 'fake-invalid-supabase-token';

  const cleanDb = async () => {
    try {
      const cartRepo = new CartRepository();
      await cartRepo.db.query(
        'DELETE FROM public.cart_items WHERE user_id = :userId AND product_id = :productId',
        { replacements: { userId, productId } }
      );
    } catch {
      // Ignore if DB is not available in unit test environment
    }
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await cleanDb();

    supabase.auth.getUser.mockImplementation(async (token) => {
      // eslint-disable-next-line security/detect-possible-timing-attacks
      if (token === validToken) {
        return {
          data: {
            user: {
              id: userId,
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

    mockAddToCartUseCase = {
      execute: vi.fn(),
    };
    mockUpdateCartItemUseCase = {
      execute: vi.fn(),
    };
    mockRemoveCartItemUseCase = {
      execute: vi.fn(),
    };
    mockClearCartUseCase = {
      execute: vi.fn(),
    };

    const customRouter = createCartRouter({
      addToCartUseCase: mockAddToCartUseCase,
      updateCartItemUseCase: mockUpdateCartItemUseCase,
      removeCartItemUseCase: mockRemoveCartItemUseCase,
      clearCartUseCase: mockClearCartUseCase,
    });

    app = createApp({ cartRoutes: customRouter });
  });

  afterAll(async () => {
    await cleanDb();
    try {
      const cartRepo = new CartRepository();
      await cartRepo.db.close();
    } catch {
      // Ignore
    }
  });

  it('Scenario 1: POST /v1/cart/items with valid body + valid JWT -> 201 with flat CartItem shape', async () => {
    const mockItem = {
      id: 'c4b3a2d1-0000-0000-0000-000000000001',
      user_id: userId,
      product_id: productId,
      quantity: 1,
      created_at: '2026-10-23T20:00:00.000Z',
      updated_at: '2026-10-23T20:00:00.000Z',
    };

    mockAddToCartUseCase.execute.mockResolvedValueOnce({
      toJSON: () => mockItem,
    });

    const response = await request(app)
      .post('/v1/cart/items')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ product_id: productId, quantity: 1 });

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual(mockItem);
    expect(response.body.data.id).toBe(mockItem.id);
    expect(response.body.data.user_id).toBe(userId);
    expect(response.body.data.product_id).toBe(productId);
    expect(response.body.data.quantity).toBe(1);
    expect(response.body.data.created_at).toBe(mockItem.created_at);
    expect(response.body.data.updated_at).toBe(mockItem.updated_at);
    expect(response.body.meta.timestamp).toBeDefined();

    // Guard against regression: old nested shape must NOT exist
    expect(response.body.data.item).toBeUndefined();
    expect(response.body.data.cart).toBeUndefined();

    expect(mockAddToCartUseCase.execute).toHaveBeenCalledTimes(1);
    const dto = mockAddToCartUseCase.execute.mock.calls[0][0];
    expect(dto.userId).toBe(userId);
    expect(dto.productId).toBe(productId);
    expect(dto.quantity).toBe(1);
  });

  it('Scenario 2: Same product again with quantity: 2 -> 201, body.data.quantity === 3', async () => {
    const mockItem = {
      id: 'c4b3a2d1-0000-0000-0000-000000000001',
      user_id: userId,
      product_id: productId,
      quantity: 3,
      created_at: '2026-10-23T20:00:00.000Z',
      updated_at: '2026-10-23T20:05:00.000Z',
    };

    mockAddToCartUseCase.execute.mockResolvedValueOnce({
      toJSON: () => mockItem,
    });

    const response = await request(app)
      .post('/v1/cart/items')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ product_id: productId, quantity: 2 });

    expect(response.status).toBe(201);
    expect(response.body.data.quantity).toBe(3);

    const dto = mockAddToCartUseCase.execute.mock.calls[0][0];
    expect(dto.userId).toBe(userId);
    expect(dto.productId).toBe(productId);
    expect(dto.quantity).toBe(2);
  });

  it('Scenario 3: No Authorization header -> 401, body.error.code === UNAUTHORIZED', async () => {
    const response = await request(app)
      .post('/v1/cart/items')
      .send({ product_id: productId, quantity: 1 });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(response.body.error.message).toBe('Authentication failed');
    expect(mockAddToCartUseCase.execute).not.toHaveBeenCalled();
  });

  it('Scenario 4: Expired JWT -> 401, body.error.code === UNAUTHORIZED', async () => {
    const response = await request(app)
      .post('/v1/cart/items')
      .set('Authorization', `Bearer ${invalidToken}`)
      .send({ product_id: productId, quantity: 1 });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(response.body.error.message).toBe('Authentication failed');
    expect(mockAddToCartUseCase.execute).not.toHaveBeenCalled();
  });

  it('Scenario 5: Missing product_id in body -> 400, body.error.code === VALIDATION_ERROR with field product_id', async () => {
    const response = await request(app)
      .post('/v1/cart/items')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ quantity: 1 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'product_id' })])
    );
    expect(mockAddToCartUseCase.execute).not.toHaveBeenCalled();
  });

  it('Scenario 6: Unknown product UUID -> 404, body.error.code === PRODUCT_NOT_FOUND', async () => {
    const error = new Error('Product not found');
    error.code = 'PRODUCT_NOT_FOUND';
    error.statusCode = 404;

    mockAddToCartUseCase.execute.mockRejectedValueOnce(error);

    const unknownProductId = '00000000-0000-0000-0000-000000000000';
    const response = await request(app)
      .post('/v1/cart/items')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ product_id: unknownProductId, quantity: 1 });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
    expect(response.body.error.message).toBe('Product not found');
  });

  it('Scenario 7: Oversell -> 422, body.error.code === INSUFFICIENT_STOCK', async () => {
    const error = new Error(
      'Insufficient stock. You already have 3 in your cart; only 2 more available.'
    );
    error.code = 'INSUFFICIENT_STOCK';
    error.statusCode = 422;

    mockAddToCartUseCase.execute.mockRejectedValueOnce(error);

    const response = await request(app)
      .post('/v1/cart/items')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ product_id: productId, quantity: 9999 });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(response.body.error.message).toContain('Insufficient stock');
  });

  it('Scenario 8: PATCH /v1/cart/items/:productId with valid body + valid JWT -> 200 with CartItem', async () => {
    const mockItem = {
      id: 'c4b3a2d1-0000-0000-0000-000000000001',
      user_id: userId,
      product_id: productId,
      quantity: 5,
      created_at: '2026-10-23T20:00:00.000Z',
      updated_at: '2026-10-23T20:10:00.000Z',
    };

    mockUpdateCartItemUseCase.execute.mockResolvedValueOnce({
      toJSON: () => mockItem,
    });

    const response = await request(app)
      .patch(`/v1/cart/items/${productId}`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ quantity: 5 });

    expect(response.status).toBe(200);
    expect(response.body.data.quantity).toBe(5);
    expect(response.body.meta.timestamp).toBeDefined();
    expect(mockUpdateCartItemUseCase.execute).toHaveBeenCalledWith({
      userId,
      productId,
      quantity: 5,
    });
  });

  it('Scenario 9: PATCH /v1/cart/items/:productId with negative quantity -> 400, body.error.code === VALIDATION_ERROR', async () => {
    const response = await request(app)
      .patch(`/v1/cart/items/${productId}`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ quantity: -1 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpdateCartItemUseCase.execute).not.toHaveBeenCalled();
  });

  it('Scenario 10: PATCH /v1/cart/items/:productId with no Authorization header -> 401, body.error.code === UNAUTHORIZED', async () => {
    const response = await request(app).patch(`/v1/cart/items/${productId}`).send({ quantity: 2 });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(mockUpdateCartItemUseCase.execute).not.toHaveBeenCalled();
  });

  it('Scenario 11: DELETE /v1/cart/items/:productId with valid JWT -> 204 No Content', async () => {
    mockRemoveCartItemUseCase.execute.mockResolvedValueOnce();

    const response = await request(app)
      .delete(`/v1/cart/items/${productId}`)
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(mockRemoveCartItemUseCase.execute).toHaveBeenCalledWith({
      userId,
      productId,
    });
  });

  it('Scenario 12: DELETE /v1/cart/items/:productId with no Authorization header -> 401, body.error.code === UNAUTHORIZED', async () => {
    const response = await request(app).delete(`/v1/cart/items/${productId}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(mockRemoveCartItemUseCase.execute).not.toHaveBeenCalled();
  });

  it('Scenario 13: DELETE /v1/cart with valid JWT -> 204 No Content', async () => {
    mockClearCartUseCase.execute.mockResolvedValueOnce();

    const response = await request(app)
      .delete('/v1/cart')
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(mockClearCartUseCase.execute).toHaveBeenCalledWith({
      userId,
    });
  });

  it('Scenario 14: DELETE /v1/cart with no Authorization header -> 401, body.error.code === UNAUTHORIZED', async () => {
    const response = await request(app).delete('/v1/cart');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(mockClearCartUseCase.execute).not.toHaveBeenCalled();
  });
});
