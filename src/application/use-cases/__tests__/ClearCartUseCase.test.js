import { describe, expect, it, vi } from 'vitest';
import { ClearCartUseCase } from '../ClearCartUseCase.js';

describe('ClearCartUseCase', () => {
  const userId = '00000000-0000-0000-0000-000000000002';

  it('Scenario 1: Execute clear cart -> calls cartRepository.clearCart with userId', async () => {
    const cartRepository = {
      clearCart: vi.fn().mockResolvedValue(),
    };

    const useCase = new ClearCartUseCase({ cartRepository });
    await useCase.execute({ userId });

    expect(cartRepository.clearCart).toHaveBeenCalledWith(userId);
  });
});
