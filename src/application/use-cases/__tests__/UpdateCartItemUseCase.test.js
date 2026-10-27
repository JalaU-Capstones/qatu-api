import { describe, expect, it, vi } from 'vitest';
import { UpdateCartItemUseCase } from '../UpdateCartItemUseCase.js';

describe('UpdateCartItemUseCase', () => {
  const userId = '00000000-0000-0000-0000-000000000002';
  const productId = '10000000-0000-0000-0000-000000000001';

  it('Scenario 1: Update quantity with valid stock -> returns updated CartItem', async () => {
    const mockCartItem = { id: 'item-1', userId, productId, quantity: 3 };
    const cartRepository = {
      updateQuantity: vi.fn().mockResolvedValue(mockCartItem),
    };
    const productRepository = {
      findById: vi.fn().mockResolvedValue({ id: productId, stock: 10 }),
    };

    const useCase = new UpdateCartItemUseCase({ cartRepository, productRepository });
    const result = await useCase.execute({ userId, productId, quantity: 3 });

    expect(productRepository.findById).toHaveBeenCalledWith(productId);
    expect(cartRepository.updateQuantity).toHaveBeenCalledWith({ userId, productId, quantity: 3 });
    expect(result).toEqual(mockCartItem);
  });

  it('Scenario 2: Set quantity to 0 -> calls removeItem and returns null', async () => {
    const cartRepository = {
      removeItem: vi.fn().mockResolvedValue(),
    };
    const productRepository = { findById: vi.fn() };

    const useCase = new UpdateCartItemUseCase({ cartRepository, productRepository });
    const result = await useCase.execute({ userId, productId, quantity: 0 });

    expect(cartRepository.removeItem).toHaveBeenCalledWith({ userId, productId });
    expect(productRepository.findById).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('Scenario 3: Product not found -> throws PRODUCT_NOT_FOUND (404)', async () => {
    const cartRepository = {};
    const productRepository = {
      findById: vi.fn().mockResolvedValue(null),
    };

    const useCase = new UpdateCartItemUseCase({ cartRepository, productRepository });

    await expect(useCase.execute({ userId, productId, quantity: 2 })).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('Scenario 4: Quantity exceeds available stock -> throws INSUFFICIENT_STOCK (422)', async () => {
    const cartRepository = {};
    const productRepository = {
      findById: vi.fn().mockResolvedValue({ id: productId, stock: 2 }),
    };

    const useCase = new UpdateCartItemUseCase({ cartRepository, productRepository });

    await expect(useCase.execute({ userId, productId, quantity: 5 })).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      statusCode: 422,
    });
  });

  it('Scenario 5: Cart item not found in repo -> throws CART_ITEM_NOT_FOUND (404)', async () => {
    const cartRepository = {
      updateQuantity: vi.fn().mockResolvedValue(null),
    };
    const productRepository = {
      findById: vi.fn().mockResolvedValue({ id: productId, stock: 10 }),
    };

    const useCase = new UpdateCartItemUseCase({ cartRepository, productRepository });

    await expect(useCase.execute({ userId, productId, quantity: 2 })).rejects.toMatchObject({
      code: 'CART_ITEM_NOT_FOUND',
      statusCode: 404,
    });
  });
});
