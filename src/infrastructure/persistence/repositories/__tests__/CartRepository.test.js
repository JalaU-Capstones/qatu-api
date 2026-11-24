import { QueryTypes } from 'sequelize';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CartItem } from '../../../../domain/entities/CartItem.js';
import { CartRepository } from '../CartRepository.js';

describe('CartRepository', () => {
  let repository;
  let mockDb;

  const userId = '00000000-0000-4000-8000-000000000002';
  const productId = '10000000-0000-4000-8000-000000000001';
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
    it('Scenario 1: includeProduct: false (default) -> query does NOT contain JOIN', async () => {
      const mockRow = {
        id: cartItemId,
        user_id: userId,
        product_id: productId,
        quantity: 2,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue([mockRow]);

      const result = await repository.findByUserId(userId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringMatching(/FROM\s+public\.cart_items/),
        expect.objectContaining({
          replacements: { userId },
          type: QueryTypes.SELECT,
        })
      );
      const sqlQuery = mockDb.query.mock.calls[0][0];
      expect(sqlQuery).not.toContain('JOIN');
      expect(result).toEqual([mockRow]);
    });

    it('Scenario 2: includeProduct: true -> query DOES contain JOIN', async () => {
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

      const result = await repository.findByUserId(userId, { includeProduct: true });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM public.cart_items ci'),
        expect.objectContaining({
          replacements: { userId },
          type: QueryTypes.SELECT,
        })
      );
      const sqlQuery = mockDb.query.mock.calls[0][0];
      expect(sqlQuery).toContain('INNER JOIN public.products p');
      expect(result).toEqual([mockRow]);
      expect(result[0].product_name).toBe('Ergonomic Office Chair');
    });

    it('Scenario 3: Returns an empty array when the user has no cart items', async () => {
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

    it('Scenario 2: Joins the checkout transaction when one is given', async () => {
      mockDb.query.mockResolvedValue();
      const transaction = { id: 'tx' };

      await repository.clearCart(userId, { transaction });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM public.cart_items'),
        expect.objectContaining({ transaction })
      );
    });

    it('Scenario 3: Does not add a transaction key when none is given', async () => {
      mockDb.query.mockResolvedValue();

      await repository.clearCart(userId);

      expect(mockDb.query.mock.calls[0][1]).not.toHaveProperty('transaction');
    });
  });

  describe('findCheckoutLines', () => {
    const baseRow = {
      cart_item_id: cartItemId,
      product_id: productId,
      quantity: 2,
      seller_id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
      name: 'Clean Code',
      price: '19.99',
      currency: 'USD',
      state: 'published',
      primary_image_path: 'img/clean-code.webp',
      deleted_at: null,
    };

    it('Scenario 1: Locks only the cart rows and orders by product id', async () => {
      mockDb.query.mockResolvedValue([baseRow]);
      const transaction = { id: 'tx' };

      await repository.findCheckoutLines(userId, { transaction });

      const [sql, options] = mockDb.query.mock.calls[0];
      expect(sql).toContain('FOR UPDATE OF ci');
      expect(sql).toContain('ORDER BY ci.product_id ASC');
      expect(options).toMatchObject({
        replacements: { userId },
        type: QueryTypes.SELECT,
        transaction,
      });
    });

    it('Scenario 2: Maps rows to checkout lines with numeric price and quantity', async () => {
      mockDb.query.mockResolvedValue([baseRow]);

      const lines = await repository.findCheckoutLines(userId);

      expect(lines).toEqual([
        {
          cartItemId,
          productId,
          sellerId: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
          name: 'Clean Code',
          unitPrice: 19.99,
          currency: 'USD',
          quantity: 2,
          imagePath: 'img/clean-code.webp',
          isAvailable: true,
        },
      ]);
    });

    it('Scenario 3: Flags unpublished or deleted products as unavailable', async () => {
      mockDb.query.mockResolvedValue([
        { ...baseRow, state: 'unpublished' },
        { ...baseRow, deleted_at: new Date() },
      ]);

      const lines = await repository.findCheckoutLines(userId);

      expect(lines.map((l) => l.isAvailable)).toEqual([false, false]);
    });

    it('Scenario 4: Returns an empty array for an empty cart', async () => {
      mockDb.query.mockResolvedValue([]);

      await expect(repository.findCheckoutLines(userId)).resolves.toEqual([]);
    });
  });
});

const USER_ID = 'user-1';
const PRODUCT_ID = 'product-1';

const cartRow = (overrides = {}) => ({
  id: 'item-1',
  user_id: USER_ID,
  product_id: PRODUCT_ID,
  quantity: '2',
  created_at: '2026-11-01T00:00:00.000Z',
  updated_at: '2026-11-02T00:00:00.000Z',
  ...overrides,
});

const checkoutRow = (overrides = {}) => ({
  cart_item_id: 'item-1',
  product_id: PRODUCT_ID,
  seller_id: 'seller-1',
  name: 'Chair',
  price: '10.50',
  currency: 'USD',
  quantity: '2',
  primary_image_path: 'product-images/chair.webp',
  state: 'published',
  deleted_at: null,
  ...overrides,
});

describe('CartRepository — remaining branches', () => {
  it('uses the shared sequelize instance by default', () => {
    expect(new CartRepository().db).toBeDefined();
  });

  describe('toDomain', () => {
    it('returns null for a missing row', () => {
      const repository = new CartRepository({ db: { query: vi.fn() } });
      expect(repository.toDomain(null)).toBeNull();
    });

    it('leaves timestamps null when the row omits them', () => {
      const repository = new CartRepository({ db: { query: vi.fn() } });
      const item = repository.toDomain(cartRow({ created_at: null, updated_at: null }));

      expect(item).toBeInstanceOf(CartItem);
      expect(item.quantity).toBe(2);
      expect(item.createdAt).toBeNull();
      expect(item.updatedAt).toBeNull();
    });
  });

  describe('findByUserAndProduct', () => {
    it('returns null when the query returns no rows', async () => {
      const db = { query: vi.fn().mockResolvedValue([]) };
      const repository = new CartRepository({ db });

      await expect(
        repository.findByUserAndProduct({ userId: USER_ID, productId: PRODUCT_ID })
      ).resolves.toBeNull();
      expect(db.query.mock.calls[0][1].replacements).toEqual({
        userId: USER_ID,
        productId: PRODUCT_ID,
      });
    });

    it('returns null for an undefined result set', async () => {
      const db = { query: vi.fn().mockResolvedValue(undefined) };
      const repository = new CartRepository({ db });

      await expect(
        repository.findByUserAndProduct({ userId: USER_ID, productId: PRODUCT_ID })
      ).resolves.toBeNull();
    });

    it('maps the matching row to a CartItem', async () => {
      const db = { query: vi.fn().mockResolvedValue([cartRow()]) };
      const repository = new CartRepository({ db });

      const item = await repository.findByUserAndProduct({
        userId: USER_ID,
        productId: PRODUCT_ID,
      });

      expect(item).toBeInstanceOf(CartItem);
      expect(item.quantity).toBe(2);
    });
  });

  describe('incrementQuantity', () => {
    it('throws when the atomic upsert returns no row', async () => {
      const db = { query: vi.fn().mockResolvedValue([]) };
      const repository = new CartRepository({ db });

      await expect(
        repository.incrementQuantity({ userId: USER_ID, productId: PRODUCT_ID, delta: 1 })
      ).rejects.toThrow('Failed to increment cart item quantity: no row returned');
      expect(db.query.mock.calls[0][1].type).toBe(QueryTypes.SELECT);
    });

    it('maps the returned row', async () => {
      const db = { query: vi.fn().mockResolvedValue([cartRow()]) };
      const repository = new CartRepository({ db });

      await expect(
        repository.incrementQuantity({ userId: USER_ID, productId: PRODUCT_ID, delta: 2 })
      ).resolves.toBeInstanceOf(CartItem);
    });
  });

  describe('findCheckoutLines', () => {
    it('marks unavailable lines and defaults a missing image path', async () => {
      const db = {
        query: vi.fn().mockResolvedValue([
          checkoutRow({ primary_image_path: undefined, state: 'draft' }),
          checkoutRow({
            primary_image_path: null,
            deleted_at: new Date('2026-11-01T00:00:00.000Z'),
          }),
        ]),
      };
      const repository = new CartRepository({ db });

      const lines = await repository.findCheckoutLines(USER_ID);

      expect(lines[0]).toMatchObject({
        cartItemId: 'item-1',
        unitPrice: 10.5,
        quantity: 2,
        imagePath: null,
        isAvailable: false,
      });
      expect(lines[1].isAvailable).toBe(false);
      expect(db.query.mock.calls[0][0]).toContain('FOR UPDATE OF ci');
    });

    it('returns an empty list for an unexpected result and forwards a transaction', async () => {
      const db = { query: vi.fn().mockResolvedValue(undefined) };
      const repository = new CartRepository({ db });
      const transaction = { id: 'tx' };

      await expect(repository.findCheckoutLines(USER_ID, { transaction })).resolves.toEqual([]);
      expect(db.query.mock.calls[0][1]).toMatchObject({ transaction });
    });
  });

  describe('countByUser', () => {
    it('returns zero for empty results and defaults a missing total', async () => {
      const db = { query: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{}]) };
      const repository = new CartRepository({ db });

      await expect(repository.countByUser(USER_ID)).resolves.toBe(0);
      await expect(repository.countByUser(USER_ID)).resolves.toBe(0);
    });

    it('converts a string total to a number', async () => {
      const db = { query: vi.fn().mockResolvedValue([{ total: '3' }]) };
      const repository = new CartRepository({ db });

      await expect(repository.countByUser(USER_ID)).resolves.toBe(3);
    });
  });

  describe('clearCart', () => {
    it('omits the transaction when none is provided', async () => {
      const db = { query: vi.fn().mockResolvedValue(undefined) };
      const repository = new CartRepository({ db });

      await repository.clearCart(USER_ID);
      expect(db.query.mock.calls[0][1]).toEqual({
        replacements: { userId: USER_ID },
        type: QueryTypes.DELETE,
      });
    });
  });
});
