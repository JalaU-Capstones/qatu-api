import { QueryTypes } from 'sequelize';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CartRepository } from '../CartRepository.js';

describe('CartRepository', () => {
  let repository;
  let mockDb;

  const userId = '00000000-0000-0000-0000-000000000002';
  const productId = '10000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };
    repository = new CartRepository({ db: mockDb });
  });

  describe('updateQuantity', () => {
    it('Scenario 1: Updates quantity and returns domain entity', async () => {
      const mockRow = {
        id: 'item-1',
        user_id: userId,
        product_id: productId,
        quantity: 4,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue([mockRow]);

      const result = await repository.updateQuantity({ userId, productId, quantity: 4 });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE public.cart_items'),
        expect.objectContaining({
          replacements: { userId, productId, quantity: 4 },
          type: QueryTypes.SELECT,
        })
      );
      expect(result.quantity).toBe(4);
      expect(result.userId).toBe(userId);
    });

    it('Scenario 2: Returns null if no row updated', async () => {
      mockDb.query.mockResolvedValue([]);

      const result = await repository.updateQuantity({ userId, productId, quantity: 4 });

      expect(result).toBeNull();
    });
  });

  describe('removeItem', () => {
    it('Scenario 1: Executes DELETE query with correct parameters', async () => {
      mockDb.query.mockResolvedValue();

      await repository.removeItem({ userId, productId });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM public.cart_items'),
        expect.objectContaining({
          replacements: { userId, productId },
          type: QueryTypes.DELETE,
        })
      );
    });
  });

  describe('clearCart', () => {
    it('Scenario 1: Executes DELETE query for user', async () => {
      mockDb.query.mockResolvedValue();

      await repository.clearCart(userId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM public.cart_items'),
        expect.objectContaining({
          replacements: { userId },
          type: QueryTypes.DELETE,
        })
      );
    });
  });
});
