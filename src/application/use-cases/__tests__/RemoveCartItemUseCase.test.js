import { describe, expect, it, vi } from 'vitest';
import { RemoveCartItemUseCase } from '../RemoveCartItemUseCase.js';

describe('RemoveCartItemUseCase', () => {
  const userId = '00000000-0000-0000-0000-000000000002';
  const productId = '10000000-0000-0000-0000-000000000001';

  it('Scenario 1: Execute remove item -> calls cartRepository.removeItem', async () => {
    const cartRepository = {
      removeItem: vi.fn().mockResolvedValue(),
    };

    const useCase = new RemoveCartItemUseCase({ cartRepository });
    await useCase.execute({ userId, productId });

    expect(cartRepository.removeItem).toHaveBeenCalledWith({ userId, productId });
  });
});
