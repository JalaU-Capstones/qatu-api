import { describe, it, expect, vi } from 'vitest';
import { CartItem } from '../../../domain/entities/CartItem.js';
import { Product } from '../../../domain/entities/Product.js';
import { AddToCartRequestDTO } from '../../dtos/AddToCartDTO.js';
import { AddToCartUseCase } from '../AddToCartUseCase.js';

describe('AddToCartUseCase', () => {
  const userId = '00000000-0000-0000-0000-000000000001';
  const productId = '10000000-0000-0000-0000-000000000001';

  it('should throw an error when dependencies are missing', () => {
    expect(() => new AddToCartUseCase()).toThrow('cartRepository is required');
    expect(() => new AddToCartUseCase({ cartRepository: {} })).toThrow(
      'productRepository is required'
    );
  });

  it('Scenario 1: Happy path (product published, stock 10, no existing cart item)', async () => {
    const product = new Product({
      id: productId,
      name: 'Test Product',
      slug: 'test-product',
      price: 10,
      stock: 10,
      state: 'published',
    });

    const expectedCartItem = new CartItem({
      id: 'c-1',
      userId,
      productId,
      quantity: 1,
      createdAt: new Date('2026-10-23T00:00:00Z'),
      updatedAt: new Date('2026-10-23T00:00:00Z'),
    });

    const cartRepository = {
      findByUserAndProduct: vi.fn().mockResolvedValue(null),
      incrementQuantity: vi.fn().mockResolvedValue(expectedCartItem),
      countByUser: vi.fn(),
    };
    const productRepository = {
      findById: vi.fn().mockResolvedValue(product),
    };

    const useCase = new AddToCartUseCase({ cartRepository, productRepository });
    const requestDto = new AddToCartRequestDTO({ userId, productId, quantity: 1 });

    const result = await useCase.execute(requestDto);

    expect(productRepository.findById).toHaveBeenCalledWith(productId);
    expect(cartRepository.findByUserAndProduct).toHaveBeenCalledWith({ userId, productId });
    expect(cartRepository.incrementQuantity).toHaveBeenCalledWith({
      userId,
      productId,
      delta: 1,
    });
    expect(cartRepository.countByUser).not.toHaveBeenCalled();

    const json = result.toJSON();
    expect(json).toEqual({
      id: 'c-1',
      user_id: userId,
      product_id: productId,
      quantity: 1,
      created_at: '2026-10-23T00:00:00.000Z',
      updated_at: '2026-10-23T00:00:00.000Z',
    });
  });

  it('Scenario 2: Incrementing existing item (existing quantity 2, stock 10, delta 1 -> quantity 3)', async () => {
    const product = new Product({
      id: productId,
      name: 'Test Product',
      slug: 'test-product',
      price: 10,
      stock: 10,
      state: 'published',
    });

    const existingCartItem = new CartItem({
      id: 'c-1',
      userId,
      productId,
      quantity: 2,
    });

    const updatedCartItem = new CartItem({
      id: 'c-1',
      userId,
      productId,
      quantity: 3,
    });

    const cartRepository = {
      findByUserAndProduct: vi.fn().mockResolvedValue(existingCartItem),
      incrementQuantity: vi.fn().mockResolvedValue(updatedCartItem),
      countByUser: vi.fn(),
    };
    const productRepository = {
      findById: vi.fn().mockResolvedValue(product),
    };

    const useCase = new AddToCartUseCase({ cartRepository, productRepository });
    const requestDto = new AddToCartRequestDTO({ userId, productId, quantity: 1 });

    const result = await useCase.execute(requestDto);

    expect(cartRepository.incrementQuantity).toHaveBeenCalledWith({
      userId,
      productId,
      delta: 1,
    });
    expect(cartRepository.countByUser).not.toHaveBeenCalled();
    expect(result.toJSON().quantity).toBe(3);
  });

  it('Scenario 3: Product not found (findById returns null) -> throws PRODUCT_NOT_FOUND (404)', async () => {
    const cartRepository = {
      findByUserAndProduct: vi.fn(),
      incrementQuantity: vi.fn(),
      countByUser: vi.fn(),
    };
    const productRepository = {
      findById: vi.fn().mockResolvedValue(null),
    };

    const useCase = new AddToCartUseCase({ cartRepository, productRepository });
    const requestDto = new AddToCartRequestDTO({ userId, productId, quantity: 1 });

    await expect(useCase.execute(requestDto)).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
      message: 'Product not found',
    });

    expect(cartRepository.findByUserAndProduct).not.toHaveBeenCalled();
    expect(cartRepository.incrementQuantity).not.toHaveBeenCalled();
    expect(cartRepository.countByUser).not.toHaveBeenCalled();
  });

  it('Scenario 4: Product not published (state: draft, stock 10) -> throws PRODUCT_NOT_AVAILABLE (422)', async () => {
    const product = new Product({
      id: productId,
      name: 'Draft Product',
      slug: 'draft-product',
      price: 10,
      stock: 10,
      state: 'draft',
    });

    const cartRepository = {
      findByUserAndProduct: vi.fn(),
      incrementQuantity: vi.fn(),
      countByUser: vi.fn(),
    };
    const productRepository = {
      findById: vi.fn().mockResolvedValue(product),
    };

    const useCase = new AddToCartUseCase({ cartRepository, productRepository });
    const requestDto = new AddToCartRequestDTO({ userId, productId, quantity: 1 });

    await expect(useCase.execute(requestDto)).rejects.toMatchObject({
      code: 'PRODUCT_NOT_AVAILABLE',
      statusCode: 422,
      message: 'Product is not available for purchase',
    });

    expect(cartRepository.findByUserAndProduct).not.toHaveBeenCalled();
    expect(cartRepository.incrementQuantity).not.toHaveBeenCalled();
    expect(cartRepository.countByUser).not.toHaveBeenCalled();
  });

  it('Scenario 5: Product out of stock (state: published, stock 0) -> throws PRODUCT_OUT_OF_STOCK (422)', async () => {
    const product = new Product({
      id: productId,
      name: 'Out of Stock Product',
      slug: 'oos-product',
      price: 10,
      stock: 0,
      state: 'published',
    });

    const cartRepository = {
      findByUserAndProduct: vi.fn().mockResolvedValue(null),
      incrementQuantity: vi.fn(),
      countByUser: vi.fn(),
    };
    const productRepository = {
      findById: vi.fn().mockResolvedValue(product),
    };

    const useCase = new AddToCartUseCase({ cartRepository, productRepository });
    const requestDto = new AddToCartRequestDTO({ userId, productId, quantity: 1 });

    await expect(useCase.execute(requestDto)).rejects.toMatchObject({
      code: 'PRODUCT_OUT_OF_STOCK',
      statusCode: 422,
      message: 'Product out of stock',
    });

    expect(cartRepository.incrementQuantity).not.toHaveBeenCalled();
    expect(cartRepository.countByUser).not.toHaveBeenCalled();
  });

  it('Scenario 6: Insufficient stock (stock 5, existing quantity 4, delta 2) -> throws INSUFFICIENT_STOCK (422)', async () => {
    const product = new Product({
      id: productId,
      name: 'Low Stock Product',
      slug: 'low-stock-product',
      price: 10,
      stock: 5,
      state: 'published',
    });

    const existingCartItem = new CartItem({
      id: 'c-1',
      userId,
      productId,
      quantity: 4,
    });

    const cartRepository = {
      findByUserAndProduct: vi.fn().mockResolvedValue(existingCartItem),
      incrementQuantity: vi.fn(),
      countByUser: vi.fn(),
    };
    const productRepository = {
      findById: vi.fn().mockResolvedValue(product),
    };

    const useCase = new AddToCartUseCase({ cartRepository, productRepository });
    const requestDto = new AddToCartRequestDTO({ userId, productId, quantity: 2 });

    const promise = useCase.execute(requestDto);

    await expect(promise).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      statusCode: 422,
    });

    try {
      await promise;
    } catch (err) {
      expect(err.message).toContain('4');
      expect(err.message).toContain('1 more available');
    }

    expect(cartRepository.incrementQuantity).not.toHaveBeenCalled();
    expect(cartRepository.countByUser).not.toHaveBeenCalled();
  });

  it('Guards against regression: never calls cartRepository.countByUser and never accesses productRepository.db', async () => {
    const product = new Product({
      id: productId,
      name: 'Test Product',
      slug: 'test-product',
      price: 10,
      stock: 10,
      state: 'published',
    });

    const cartItem = new CartItem({
      id: 'c-1',
      userId,
      productId,
      quantity: 1,
    });

    const countByUserMock = vi.fn();
    const cartRepository = {
      findByUserAndProduct: vi.fn().mockResolvedValue(null),
      incrementQuantity: vi.fn().mockResolvedValue(cartItem),
      countByUser: countByUserMock,
    };

    const dbQueryMock = vi.fn();
    const productRepository = {
      findById: vi.fn().mockResolvedValue(product),
      db: {
        query: dbQueryMock,
      },
    };

    const useCase = new AddToCartUseCase({ cartRepository, productRepository });
    await useCase.execute(new AddToCartRequestDTO({ userId, productId, quantity: 1 }));

    expect(countByUserMock).not.toHaveBeenCalled();
    expect(dbQueryMock).not.toHaveBeenCalled();
  });
});
