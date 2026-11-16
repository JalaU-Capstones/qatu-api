import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListProductImagesUseCase } from '../ListProductImagesUseCase.js';

describe('ListProductImagesUseCase', () => {
  let productRepository;
  let useCase;

  const validProductId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    productRepository = {
      findById: vi.fn(),
      listImages: vi.fn(),
    };
    useCase = new ListProductImagesUseCase({ productRepository });
  });

  it('throws 400 VALIDATION_ERROR when productId is missing', async () => {
    await expect(useCase.execute({})).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'productId is required',
    });
    expect(productRepository.findById).not.toHaveBeenCalled();
  });

  it('throws 400 VALIDATION_ERROR when productId is not a valid UUID', async () => {
    await expect(useCase.execute({ productId: 'invalid-uuid' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'productId must be a valid UUID',
    });
    expect(productRepository.findById).not.toHaveBeenCalled();
  });

  it('throws 404 PRODUCT_NOT_FOUND when product does not exist', async () => {
    productRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ productId: validProductId })).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
      message: 'Product not found',
    });
    expect(productRepository.listImages).not.toHaveBeenCalled();
  });

  it('returns empty data array when product exists but has no images', async () => {
    productRepository.findById.mockResolvedValue({ id: validProductId });
    productRepository.listImages.mockResolvedValue([]);

    const result = await useCase.execute({ productId: validProductId });

    expect(result).toEqual({
      data: [],
      meta: { timestamp: expect.any(String) },
    });
    expect(productRepository.listImages).toHaveBeenCalledWith(validProductId);
  });

  it('returns mapped images when product has images', async () => {
    productRepository.findById.mockResolvedValue({ id: validProductId });
    productRepository.listImages.mockResolvedValue([
      {
        id: 'img-1',
        product_id: validProductId,
        path: `product-images/${validProductId}/img1.png`,
        alt_text: 'Image 1',
        position: 0,
        created_at: '2026-11-14T10:00:00.000Z',
      },
      {
        id: 'img-2',
        product_id: validProductId,
        path: `product-images/${validProductId}/img2.png`,
        alt_text: null,
        position: 1,
        created_at: '2026-11-14T10:01:00.000Z',
      },
    ]);

    const result = await useCase.execute({ productId: validProductId });

    expect(result.data).toHaveLength(2);
    expect(result.data[0].path).toContain(`product-images/${validProductId}/img1.png`);
    expect(result.data[0].path).toMatch(/^https?:\/\//);
    expect(result.data[0].position).toBe(0);
    expect(result.data[1].path).toContain(`product-images/${validProductId}/img2.png`);
    expect(result.data[1].path).toMatch(/^https?:\/\//);
    expect(result.data[1].position).toBe(1);
    expect(result.meta.timestamp).toBeDefined();
  });
});
