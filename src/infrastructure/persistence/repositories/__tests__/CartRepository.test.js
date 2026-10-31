import { QueryTypes } from 'sequelize';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CartRepository } from '../CartRepository.js';

describe('CartRepository', () => {
  let repository;
  let mockDb;

  const userId = '00000000-0000-0000-0000-000000000002';
  const productId = '10000000-0000-0000-0000-000000000001';
  const cartItemId = 'c4b3a2d1-0000-0000-0000-000000000001';

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };
    repository = new CartRepository({ db: mockDb });
  });

  describe('findById', () => {
    it('Scenario 1: Returns domain entity when found', async () => {
      const mockRow = {
        id: cartItemId,
        user_id: userId,
        product_id: productId,
        quantity: 2,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue([mockRow]);

      const result = await repository.findById(cartItemId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, user_id, product_id'),
        expect.objectContaining({
          replacements: { id: cartItemId },
          type: QueryTypes.SELECT,
        })
      );
      expect(result.id).toBe(cartItemId);
      expect(result.userId).toBe(userId);
      expect(result.productId).toBe(productId);
      expect(result.quantity).toBe(2);
    });

    it('Scenario 2: Returns null if no row found', async () => {
      mockDb.query.mockResolvedValue([]);

      const result = await repository.findById(cartItemId);

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('Scenario 1: Returns the joined cart item + product rows for the user', async () => {
      const mockRow = {
        id: cartItemId,
        user_id: userId,
        product_id: productId,
        quantity: 2,
        created_at: new Date(),
        updated_at: new Date(),
        product_seller_id: '660e8400-e29b-41d4-a716-446655440001',
        product_name: 'Ergonomic Office Chair',
        product_slug: 'ergonomic-office-chair',
        product_price: 199.99,
      };

      mockDb.query.mockResolvedValue([mockRow]);

      const result = await repository.findByUserId(userId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM public.cart_items ci'),
        expect.objectContaining({
          replacements: { userId },
          type: QueryTypes.SELECT,
        })
      );
      expect(result).toEqual([mockRow]);
      expect(result[0].product_name).toBe('Ergonomic Office Chair');
    });

    it('Scenario 2: Returns an empty array when the user has no cart items', async () => {
      mockDb.query.mockResolvedValue([]);

      const result = await repository.findByUserId(userId);

      expect(result).toEqual([]);
    });
  });

  describe('updateQuantity', () => {
    it('Scenario 1: Updates quantity and returns domain entity', async () => {
      const mockRow = {
        id: cartItemId,
        user_id: userId,
        product_id: productId,
        quantity: 4,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue([mockRow]);

      const result = await repository.updateQuantity({ id: cartItemId, quantity: 4 });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE public.cart_items'),
        expect.objectContaining({
          replacements: { id: cartItemId, quantity: 4 },
          type: QueryTypes.SELECT,
        })
      );
      expect(result.quantity).toBe(4);
      expect(result.id).toBe(cartItemId);
    });

    it('Scenario 2: Returns null if no row updated', async () => {
      mockDb.query.mockResolvedValue([]);

      const result = await repository.updateQuantity({ id: cartItemId, quantity: 4 });

      expect(result).toBeNull();
    });
  });

  describe('removeItem', () => {
    it('Scenario 1: Executes DELETE query with correct parameters', async () => {
      mockDb.query.mockResolvedValue();

      await repository.removeItem(cartItemId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM public.cart_items'),
        expect.objectContaining({
          replacements: { id: cartItemId },
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
