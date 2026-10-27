import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UpdateCartItemUseCase } from '../UpdateCartItemUseCase.js';

describe('UpdateCartItemUseCase', () => {
  const userId = '00000000-0000-0000-0000-000000000002';
  const cartItemId = 'c4b3a2d1-0000-0000-0000-000000000001';
  const productId = '10000000-0000-0000-0000-000000000001';
  const mockCartItem = { id: cartItemId, userId, productId, quantity: 2 };

  let cartRepository;
  let productRepository;
  let useCase;

  beforeEach(() => {
    cartRepository = {
      findById: vi.fn().mockResolvedValue(mockCartItem),
      updateQuantity: vi.fn(),
      removeItem: vi.fn(),
    };
    productRepository = {
      findById: vi.fn().mockResolvedValue({ id: productId, stock: 10 }),
    };
    useCase = new UpdateCartItemUseCase({ cartRepository, productRepository });
  });

  it('Scenario 1: Update quantity with valid stock -> returns updated CartItem', async () => {
    const updatedCartItem = { ...mockCartItem, quantity: 3 };
    cartRepository.updateQuantity.mockResolvedValue(updatedCartItem);

    const result = await useCase.execute({ userId, cartItemId, quantity: 3 });

    expect(cartRepository.findById).toHaveBeenCalledWith(cartItemId);
    expect(productRepository.findById).toHaveBeenCalledWith(productId);
    expect(cartRepository.updateQuantity).toHaveBeenCalledWith({ id: cartItemId, quantity: 3 });
    expect(result).toEqual(updatedCartItem);
  });

  it('Scenario 2: Set quantity to 0 -> calls removeItem and returns null', async () => {
    const result = await useCase.execute({ userId, cartItemId, quantity: 0 });

    expect(cartRepository.findById).toHaveBeenCalledWith(cartItemId);
    expect(cartRepository.removeItem).toHaveBeenCalledWith(cartItemId);
    expect(productRepository.findById).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('Scenario 3: Cart item not found -> throws NOT_FOUND (404)', async () => {
    cartRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ userId, cartItemId, quantity: 2 })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });

  it('Scenario 4: Cart item belongs to another user (IDOR prevention) -> throws NOT_FOUND (404)', async () => {
    cartRepository.findById.mockResolvedValue({ ...mockCartItem, userId: 'other-user-id' });

    await expect(useCase.execute({ userId, cartItemId, quantity: 2 })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });

  it('Scenario 5: Product no longer available -> throws NOT_FOUND (404)', async () => {
    productRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ userId, cartItemId, quantity: 2 })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });

  it('Scenario 6: Quantity exceeds available stock -> throws INSUFFICIENT_STOCK (422)', async () => {
    productRepository.findById.mockResolvedValue({ id: productId, stock: 2 });

    await expect(useCase.execute({ userId, cartItemId, quantity: 5 })).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      statusCode: 422,
    });
  });
});
