import { describe, expect, it, vi } from 'vitest';
import { ClearCartUseCase } from '../ClearCartUseCase.js';

describe('ClearCartUseCase', () => {
  const userId = '00000000-0000-4000-8000-000000000002';

  it('requires a cartRepository', () => {
    expect(() => new ClearCartUseCase()).toThrow('cartRepository is required');
    expect(() => new ClearCartUseCase({})).toThrow('cartRepository is required');
  });

  it('Scenario 1: Execute clear cart -> calls cartRepository.clearCart with userId', async () => {
    const cartRepository = {
      clearCart: vi.fn().mockResolvedValue(),
    };

    const useCase = new ClearCartUseCase({ cartRepository });
    await useCase.execute({ userId });

    expect(cartRepository.clearCart).toHaveBeenCalledWith(userId);
  });
});
