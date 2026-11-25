import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnpublishProductUseCase } from '../UnpublishProductUseCase.js';

const PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440000';
const SELLER_ID = '660e8400-e29b-41d4-a716-446655440001';
const PUBLISHED_AT = '2026-10-15T10:00:00.000Z';

const product = (overrides = {}) => ({
  id: PRODUCT_ID,
  seller_id: SELLER_ID,
  category_id: '770e8400-e29b-41d4-a716-446655440002',
  name: 'Test Product',
  slug: 'test-product',
  description: 'A test product',
  price: '29.99',
  currency: 'USD',
  stock: 10,
  attributes: {},
  primary_image_path: 'product-images/x/y.png',
  state: 'published',
  average_rating: '0',
  ratings_count: 0,
  published_at: PUBLISHED_AT,
  created_at: '2026-10-14T08:00:00.000Z',
  updated_at: '2026-10-14T08:00:00.000Z',
  ...overrides,
});

describe('UnpublishProductUseCase', () => {
  it('requires a productRepository', () => {
    expect(() => new UnpublishProductUseCase()).toThrow('productRepository is required');
    expect(() => new UnpublishProductUseCase({})).toThrow('productRepository is required');
  });

  let productRepository;
  let useCase;

  beforeEach(() => {
    productRepository = {
      findById: vi.fn(),
      unpublish: vi.fn(),
      findByIdWithDetails: vi.fn(),
    };
    useCase = new UnpublishProductUseCase({ productRepository });
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
    expect(productRepository.unpublish).not.toHaveBeenCalled();
  });

  it('rejects unpublishing a product owned by another seller', async () => {
    productRepository.findById.mockResolvedValue(product({ seller_id: 'another-seller' }));

    await expect(
      useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      message: 'You do not own this product',
    });
    expect(productRepository.unpublish).not.toHaveBeenCalled();
  });

  it('rejects unpublishing a product in draft state', async () => {
    productRepository.findById.mockResolvedValue(product({ state: 'draft' }));

    await expect(
      useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID })
    ).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      statusCode: 409,
      message: "Cannot unpublish a product in state 'draft'",
    });
    expect(productRepository.unpublish).not.toHaveBeenCalled();
  });

  it('rejects unpublishing a product in unpublished state', async () => {
    productRepository.findById.mockResolvedValue(product({ state: 'unpublished' }));

    await expect(
      useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID })
    ).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      statusCode: 409,
      message: "Cannot unpublish a product in state 'unpublished'",
    });
    expect(productRepository.unpublish).not.toHaveBeenCalled();
  });

  it('rejects unpublishing a product in archived state', async () => {
    productRepository.findById.mockResolvedValue(product({ state: 'archived' }));

    await expect(
      useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID })
    ).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      statusCode: 409,
      message: "Cannot unpublish a product in state 'archived'",
    });
    expect(productRepository.unpublish).not.toHaveBeenCalled();
  });

  it('returns a conflict if the conditional update loses a race', async () => {
    productRepository.findById.mockResolvedValue(product({ state: 'published' }));
    productRepository.unpublish.mockResolvedValue(null);

    await expect(
      useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID })
    ).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      statusCode: 409,
      message: "Cannot unpublish a product in state 'unpublished'",
    });
  });

  it('unpublishes a published product and preserves published_at', async () => {
    const published = product({ state: 'published', published_at: PUBLISHED_AT });
    productRepository.findById.mockResolvedValue(published);

    const unpublished = {
      ...published,
      state: 'unpublished',
      updated_at: '2026-10-16T12:00:00.000Z',
    };
    productRepository.unpublish.mockResolvedValue(unpublished);
    productRepository.findByIdWithDetails.mockResolvedValue({
      ...unpublished,
      images: [
        {
          id: 'img-1',
          product_id: PRODUCT_ID,
          path: 'product-images/x/y.png',
          alt_text: null,
          position: 0,
          created_at: '2026-10-14T12:00:00.000Z',
        },
      ],
      seller: { id: SELLER_ID, username: 'seller', full_name: 'Seller Name', avatar_path: null },
      category: { id: 'cat-1', name: 'Cat', slug: 'cat' },
    });

    const result = await useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID });

    expect(result.data.state).toBe('unpublished');
    expect(result.data.published_at).toBe(PUBLISHED_AT);
    expect(result.meta.timestamp).toEqual(expect.any(String));
    expect(productRepository.unpublish).toHaveBeenCalledTimes(1);
    expect(productRepository.unpublish).toHaveBeenCalledWith({
      productId: PRODUCT_ID,
      sellerId: SELLER_ID,
    });
  });

  it('falls back to the unpublished row when no detailed product is returned', async () => {
    const published = product({ state: 'published', published_at: PUBLISHED_AT });
    productRepository.findById.mockResolvedValue(published);
    const unpublished = { ...published, state: 'unpublished' };
    productRepository.unpublish.mockResolvedValue(unpublished);
    productRepository.findByIdWithDetails.mockResolvedValue(null);

    const result = await useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID });

    expect(result.data.state).toBe('unpublished');
  });
});
