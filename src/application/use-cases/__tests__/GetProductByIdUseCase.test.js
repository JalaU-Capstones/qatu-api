import { describe, it, expect, vi } from 'vitest';
import { Product } from '../../../domain/entities/Product.js';
import { GetProductByIdUseCase } from '../GetProductByIdUseCase.js';

describe('GetProductByIdUseCase', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000';

  const createSampleProduct = (overrides = {}) =>
    new Product({
      id: validId,
      seller_id: '660e8400-e29b-41d4-a716-446655440001',
      category_id: '770e8400-e29b-41d4-a716-446655440002',
      name: 'Ergonomic Office Chair',
      slug: 'ergonomic-office-chair',
      description: 'High quality ergonomic mesh chair.',
      price: 199.99,
      currency: 'USD',
      stock: 25,
      attributes: { color: 'black', material: 'mesh' },
      primary_image_path: 'product-images/chair.webp',
      state: 'published',
      average_rating: 4.8,
      ratings_count: 12,
      published_at: '2026-10-10T14:30:00.000Z',
      created_at: '2026-10-09T08:00:00.000Z',
      updated_at: '2026-10-10T14:30:00.000Z',
      ...overrides,
    });

  it('should throw an error when productRepository is missing', () => {
    expect(() => new GetProductByIdUseCase()).toThrow('productRepository is required');
    expect(() => new GetProductByIdUseCase({})).toThrow('productRepository is required');
  });

  it('should return published product details mapped through ProductListItemDTO with meta.timestamp', async () => {
    const sampleProduct = createSampleProduct();
    const mockRepo = {
      findById: vi.fn().mockResolvedValue(sampleProduct),
    };
    const useCase = new GetProductByIdUseCase({ productRepository: mockRepo });

    const result = await useCase.execute(validId);

    expect(mockRepo.findById).toHaveBeenCalledWith(validId);
    expect(result.data).toEqual({
      id: validId,
      seller_id: '660e8400-e29b-41d4-a716-446655440001',
      category_id: '770e8400-e29b-41d4-a716-446655440002',
      name: 'Ergonomic Office Chair',
      slug: 'ergonomic-office-chair',
      description: 'High quality ergonomic mesh chair.',
      price: 199.99,
      currency: 'USD',
      stock: 25,
      attributes: { color: 'black', material: 'mesh' },
      primary_image_path: 'product-images/chair.webp',
      state: 'published',
      average_rating: 4.8,
      ratings_count: 12,
      published_at: '2026-10-10T14:30:00.000Z',
      created_at: '2026-10-09T08:00:00.000Z',
      updated_at: '2026-10-10T14:30:00.000Z',
    });
    expect(result.meta).toBeDefined();
    expect(typeof result.meta.timestamp).toBe('string');
  });

  it('should accept an object input with { id } or { productId }', async () => {
    const sampleProduct = createSampleProduct();
    const mockRepo = {
      findById: vi.fn().mockResolvedValue(sampleProduct),
    };
    const useCase = new GetProductByIdUseCase({ productRepository: mockRepo });

    const result = await useCase.execute({ id: validId });

    expect(mockRepo.findById).toHaveBeenCalledWith(validId);
    expect(result.data.id).toBe(validId);
  });

  it('should throw 404 PRODUCT_NOT_FOUND without querying DB when id is not a valid UUID', async () => {
    const mockRepo = {
      findById: vi.fn(),
    };
    const useCase = new GetProductByIdUseCase({ productRepository: mockRepo });

    await expect(useCase.execute('not-a-uuid')).rejects.toMatchObject({
      message: 'Product not found',
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
    });
    expect(mockRepo.findById).not.toHaveBeenCalled();
  });

  it('should throw 404 PRODUCT_NOT_FOUND when product does not exist in repository', async () => {
    const mockRepo = {
      findById: vi.fn().mockResolvedValue(null),
    };
    const useCase = new GetProductByIdUseCase({ productRepository: mockRepo });

    await expect(useCase.execute(validId)).rejects.toMatchObject({
      message: 'Product not found',
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
    });
    expect(mockRepo.findById).toHaveBeenCalledWith(validId);
  });

  it.each(['draft', 'unpublished', 'archived'])(
    'should throw 404 PRODUCT_NOT_FOUND when product state is "%s"',
    async (state) => {
      const unpublishedProduct = createSampleProduct({ state });
      const mockRepo = {
        findById: vi.fn().mockResolvedValue(unpublishedProduct),
      };
      const useCase = new GetProductByIdUseCase({ productRepository: mockRepo });

      await expect(useCase.execute(validId)).rejects.toMatchObject({
        message: 'Product not found',
        code: 'PRODUCT_NOT_FOUND',
        statusCode: 404,
      });
    }
  );

  it('should propagate unexpected repository errors', async () => {
    const mockRepo = {
      findById: vi.fn().mockRejectedValue(new Error('Database connection error')),
    };
    const useCase = new GetProductByIdUseCase({ productRepository: mockRepo });

    await expect(useCase.execute(validId)).rejects.toThrow('Database connection error');
  });
});
