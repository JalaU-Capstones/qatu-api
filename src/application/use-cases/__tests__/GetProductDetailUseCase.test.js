import { describe, it, expect, vi } from 'vitest';
import { GetProductDetailRequestDTO } from '../../dtos/ProductDetailDTO.js';
import { GetProductDetailUseCase } from '../GetProductDetailUseCase.js';

describe('GetProductDetailUseCase', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000';
  const sellerId = '660e8400-e29b-41d4-a716-446655440001';

  const createSampleDetailedProduct = (overrides = {}) => ({
    id: validId,
    seller_id: sellerId,
    category_id: '770e8400-e29b-41d4-a716-446655440002',
    name: 'Ergonomic Office Chair',
    slug: 'ergonomic-office-chair',
    description: 'High quality ergonomic mesh chair.',
    price: 199.99,
    currency: 'USD',
    stock: 25,
    attributes: { color: 'black', material: 'mesh' },
    primary_image_path: 'product-images/chair.webp',
    images: [{ id: 'img-1', image_path: 'product-images/chair.webp', position: 0 }],
    seller: {
      id: sellerId,
      username: 'john_seller',
      full_name: 'John Seller',
      avatar_path: '/avatars/john.jpg',
    },
    category: {
      id: '770e8400-e29b-41d4-a716-446655440002',
      name: 'Furniture',
      slug: 'furniture',
    },
    state: 'published',
    average_rating: 4.8,
    ratings_count: 12,
    published_at: '2026-10-10T14:30:00.000Z',
    created_at: '2026-10-09T08:00:00.000Z',
    updated_at: '2026-10-10T14:30:00.000Z',
    ...overrides,
  });

  it('should throw an error when productRepository is missing', () => {
    expect(() => new GetProductDetailUseCase()).toThrow('productRepository is required');
  });

  it('should return published product with all detailed relations', async () => {
    const sample = createSampleDetailedProduct();
    const mockRepo = {
      findByIdWithDetails: vi.fn().mockResolvedValue(sample),
    };
    const useCase = new GetProductDetailUseCase({ productRepository: mockRepo });
    const dto = new GetProductDetailRequestDTO({ productId: validId });

    const result = await useCase.execute(dto);

    expect(mockRepo.findByIdWithDetails).toHaveBeenCalledWith(validId);
    expect(result.data).toMatchObject({
      id: validId,
      name: 'Ergonomic Office Chair',
      seller: { id: sellerId, username: 'john_seller' },
      category: { name: 'Furniture' },
      images: expect.arrayContaining([expect.objectContaining({ id: 'img-1' })]),
      average_rating: 4.8,
      ratings_count: 12,
    });
    expect(result.meta.timestamp).toBeDefined();
  });

  it('should throw 404 when product is unpublished and requested publicly (no currentUserId)', async () => {
    const draftProduct = createSampleDetailedProduct({ state: 'draft' });
    const mockRepo = {
      findByIdWithDetails: vi.fn().mockResolvedValue(draftProduct),
    };
    const useCase = new GetProductDetailUseCase({ productRepository: mockRepo });
    const dto = new GetProductDetailRequestDTO({ productId: validId });

    await expect(useCase.execute(dto)).rejects.toMatchObject({
      message: 'Product not found',
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('should throw 404 when product is unpublished and requested by a different user', async () => {
    const draftProduct = createSampleDetailedProduct({ state: 'draft' });
    const mockRepo = {
      findByIdWithDetails: vi.fn().mockResolvedValue(draftProduct),
    };
    const useCase = new GetProductDetailUseCase({ productRepository: mockRepo });
    const dto = new GetProductDetailRequestDTO({
      productId: validId,
      currentUserId: '999e8400-e29b-41d4-a716-446655440099',
    });

    await expect(useCase.execute(dto)).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('should return product with state "draft" when accessed by the owning seller', async () => {
    const draftProduct = createSampleDetailedProduct({ state: 'draft' });
    const mockRepo = {
      findByIdWithDetails: vi.fn().mockResolvedValue(draftProduct),
    };
    const useCase = new GetProductDetailUseCase({ productRepository: mockRepo });
    const dto = new GetProductDetailRequestDTO({
      productId: validId,
      currentUserId: sellerId,
    });

    const result = await useCase.execute(dto);

    expect(result.data.state).toBe('draft');
    expect(result.data.id).toBe(validId);
  });

  it('should throw 404 without querying database if productId is not a valid UUID', async () => {
    const mockRepo = { findByIdWithDetails: vi.fn() };
    const useCase = new GetProductDetailUseCase({ productRepository: mockRepo });
    const dto = new GetProductDetailRequestDTO({ productId: 'invalid-id' });

    await expect(useCase.execute(dto)).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
    });
    expect(mockRepo.findByIdWithDetails).not.toHaveBeenCalled();
  });
});
