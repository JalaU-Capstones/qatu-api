import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GetCartRequestDTO } from '../../dtos/GetCartDTO.js';
import { GetCartUseCase } from '../GetCartUseCase.js';

describe('GetCartUseCase', () => {
  const userId = '00000000-0000-0000-0000-000000000002';
  const productId = '10000000-0000-0000-0000-000000000001';
  const sellerId = '660e8400-e29b-41d4-a716-446655440001';
  const cartItemId = 'c4b3a2d1-0000-0000-0000-000000000001';

  const createSampleRow = (overrides = {}) => ({
    id: cartItemId,
    user_id: userId,
    product_id: productId,
    quantity: 2,
    created_at: new Date('2026-10-14T10:00:00.000Z'),
    updated_at: new Date('2026-10-14T10:30:00.000Z'),
    product_seller_id: sellerId,
    product_category_id: '770e8400-e29b-41d4-a716-446655440002',
    product_name: 'Ergonomic Office Chair',
    product_slug: 'ergonomic-office-chair',
    product_description: 'High quality ergonomic mesh chair.',
    product_price: 199.99,
    product_currency: 'USD',
    product_stock: 25,
    product_attributes: { color: 'black', material: 'mesh' },
    product_primary_image_path: 'product-images/chair.webp',
    product_state: 'published',
    product_average_rating: 4.8,
    product_ratings_count: 12,
    product_published_at: new Date('2026-10-10T14:30:00.000Z'),
    product_created_at: new Date('2026-10-09T08:00:00.000Z'),
    product_updated_at: new Date('2026-10-10T14:30:00.000Z'),
    ...overrides,
  });

  let mockCartRepository;

  beforeEach(() => {
    mockCartRepository = {
      findByUserId: vi.fn(),
    };
  });

  it('should throw an error when cartRepository is missing', () => {
    expect(() => new GetCartUseCase()).toThrow('cartRepository is required');
  });

  it('should return cart items without product by default when includeProduct is false', async () => {
    mockCartRepository.findByUserId.mockResolvedValue([createSampleRow()]);

    const useCase = new GetCartUseCase({ cartRepository: mockCartRepository });
    const result = await useCase.execute({ userId });

    expect(mockCartRepository.findByUserId).toHaveBeenCalledWith(userId, { includeProduct: false });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: cartItemId,
      user_id: userId,
      product_id: productId,
      quantity: 2,
      created_at: '2026-10-14T10:00:00.000Z',
      updated_at: '2026-10-14T10:30:00.000Z',
    });
    expect(result[0].product).toBeUndefined();
  });

  it('should return cart items with populated product when includeProduct is true', async () => {
    mockCartRepository.findByUserId.mockResolvedValue([createSampleRow()]);

    const useCase = new GetCartUseCase({ cartRepository: mockCartRepository });
    const result = await useCase.execute({ userId, includeProduct: true });

    expect(mockCartRepository.findByUserId).toHaveBeenCalledWith(userId, { includeProduct: true });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: cartItemId,
      user_id: userId,
      product_id: productId,
      quantity: 2,
      created_at: '2026-10-14T10:00:00.000Z',
      updated_at: '2026-10-14T10:30:00.000Z',
    });
    expect(result[0].product).toMatchObject({
      id: productId,
      seller_id: sellerId,
      name: 'Ergonomic Office Chair',
      slug: 'ergonomic-office-chair',
      price: 199.99,
      currency: 'USD',
      stock: 25,
      state: 'published',
      attributes: { color: 'black', material: 'mesh' },
      average_rating: 4.8,
      ratings_count: 12,
    });
    expect(result[0].product.created_at).toBe('2026-10-09T08:00:00.000Z');
  });

  it('should accept a GetCartRequestDTO as the execute input', async () => {
    mockCartRepository.findByUserId.mockResolvedValue([]);

    const useCase = new GetCartUseCase({ cartRepository: mockCartRepository });
    const result = await useCase.execute({ userId: new GetCartRequestDTO({ userId }) });

    expect(mockCartRepository.findByUserId).toHaveBeenCalledWith(userId, { includeProduct: false });
    expect(result).toEqual([]);
  });

  it('should return an empty array when the user has no cart items', async () => {
    mockCartRepository.findByUserId.mockResolvedValue([]);

    const useCase = new GetCartUseCase({ cartRepository: mockCartRepository });
    const result = await useCase.execute({ userId });

    expect(result).toEqual([]);
  });

  it('should omit the product field when the row has no product populated even if includeProduct is true', async () => {
    mockCartRepository.findByUserId.mockResolvedValue([
      createSampleRow({ product_name: null, product_seller_id: null }),
    ]);

    const useCase = new GetCartUseCase({ cartRepository: mockCartRepository });
    const result = await useCase.execute({ userId, includeProduct: true });

    expect(result[0].product).toBeUndefined();
  });

  it('should reject a missing userId with a validation error', async () => {
    const useCase = new GetCartUseCase({ cartRepository: mockCartRepository });

    await expect(useCase.execute({ userId: '' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    expect(mockCartRepository.findByUserId).not.toHaveBeenCalled();
  });
});
