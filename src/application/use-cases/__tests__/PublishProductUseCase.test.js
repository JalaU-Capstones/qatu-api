import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishProductUseCase } from '../PublishProductUseCase.js';

const PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440000';
const SELLER_ID = '660e8400-e29b-41d4-a716-446655440001';

const product = (overrides = {}) => ({
  id: PRODUCT_ID,
  seller_id: SELLER_ID,
  category_id: '770e8400-e29b-41d4-a716-446655440002',
  name: 'Test Product',
  slug: 'test-product',
  description: 'A test product',
  price: '29.99',
  currency: 'USD',
  stock: 0,
  attributes: {},
  primary_image_path: null,
  state: 'draft',
  average_rating: '0',
  ratings_count: 0,
  published_at: null,
  created_at: '2026-10-14T08:00:00.000Z',
  updated_at: '2026-10-14T08:00:00.000Z',
  ...overrides,
});

describe('PublishProductUseCase', () => {
  let productRepository;
  let useCase;

  beforeEach(() => {
    productRepository = {
      findById: vi.fn(),
      publish: vi.fn(),
    };
    useCase = new PublishProductUseCase({ productRepository });
  });

  it('rejects a missing productId', async () => {
    await expect(useCase.execute({ sellerId: SELLER_ID })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'productId is required',
    });
    expect(productRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects an invalid productId UUID', async () => {
    await expect(
      useCase.execute({ productId: 'not-a-uuid', sellerId: SELLER_ID })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'productId must be a valid UUID',
    });
    expect(productRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a missing sellerId', async () => {
    await expect(useCase.execute({ productId: PRODUCT_ID })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'sellerId is required',
    });
    expect(productRepository.findById).not.toHaveBeenCalled();
  });

  it('returns PRODUCT_NOT_FOUND when no product exists', async () => {
    productRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID })
    ).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
      message: 'Product not found',
    });
    expect(productRepository.publish).not.toHaveBeenCalled();
  });

  it('rejects publishing a product owned by another seller', async () => {
    productRepository.findById.mockResolvedValue(product({ seller_id: 'another-seller' }));

    await expect(
      useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      message: 'You do not own this product',
    });
    expect(productRepository.publish).not.toHaveBeenCalled();
  });

  it.each(['published', 'unpublished', 'archived'])(
    'rejects publishing a product currently in %s state',
    async (state) => {
      productRepository.findById.mockResolvedValue(product({ state }));

      await expect(
        useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID })
      ).rejects.toMatchObject({
        code: 'INVALID_STATE_TRANSITION',
        statusCode: 409,
        message: `Cannot publish a product in state '${state}'`,
      });
      expect(productRepository.publish).not.toHaveBeenCalled();
    }
  );

  it('rejects a draft product without a primary image before publish', async () => {
    productRepository.findById.mockResolvedValue(product({ primary_image_path: null }));

    await expect(
      useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID })
    ).rejects.toMatchObject({
      code: 'IMAGE_REQUIRED',
      statusCode: 422,
      message: 'A product must have at least one image before being published',
    });
    expect(productRepository.publish).not.toHaveBeenCalled();
  });

  it('publishes the seller draft and returns product detail with metadata', async () => {
    productRepository.findById.mockResolvedValue(product({ primary_image_path: '/something' }));
    const updated = product({
      primary_image_path: '/something',
      state: 'published',
      published_at: '2026-10-15T10:00:00.000Z',
      updated_at: '2026-10-15T10:00:00.000Z',
    });
    productRepository.publish.mockResolvedValue(updated);

    const result = await useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID });

    expect(result.data.state).toBe('published');
    expect(result.data.published_at).not.toBeNull();
    expect(result.meta.timestamp).toEqual(expect.any(String));
    expect(productRepository.publish).toHaveBeenCalledTimes(1);
    expect(productRepository.publish).toHaveBeenCalledWith({
      productId: PRODUCT_ID,
      sellerId: SELLER_ID,
    });
  });

  it('returns a conflict if the conditional update loses a race', async () => {
    productRepository.findById.mockResolvedValue(product({ primary_image_path: '/something' }));
    productRepository.publish.mockResolvedValue(null);

    await expect(
      useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID })
    ).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      statusCode: 409,
      message: "Cannot publish a product in state 'published'",
    });
  });
});
