import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RemoveCartItemUseCase } from '../RemoveCartItemUseCase.js';

describe('RemoveCartItemUseCase', () => {
  const userId = '00000000-0000-0000-0000-000000000002';
  const cartItemId = 'c4b3a2d1-0000-0000-0000-000000000001';
  const mockCartItem = { id: cartItemId, userId, productId: 'some-prod-id', quantity: 2 };

  let cartRepository;
  let useCase;

  beforeEach(() => {
    cartRepository = {
      findById: vi.fn().mockResolvedValue(mockCartItem),
      removeItem: vi.fn(),
    };
    useCase = new RemoveCartItemUseCase({ cartRepository });
  });

  it('Scenario 1: Execute remove item with valid ownership -> calls cartRepository.removeItem', async () => {
    await useCase.execute({ userId, cartItemId });

    expect(cartRepository.findById).toHaveBeenCalledWith(cartItemId);
    expect(cartRepository.removeItem).toHaveBeenCalledWith(cartItemId);
  });

  it('Scenario 2: Cart item not found -> throws NOT_FOUND (404)', async () => {
    cartRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ userId, cartItemId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
    expect(cartRepository.removeItem).not.toHaveBeenCalled();
  });

  it('Scenario 3: Cart item belongs to another user (IDOR prevention) -> throws NOT_FOUND (404)', async () => {
    cartRepository.findById.mockResolvedValue({ ...mockCartItem, userId: 'other-user-id' });

    await expect(useCase.execute({ userId, cartItemId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
    expect(cartRepository.removeItem).not.toHaveBeenCalled();
  });
});
