import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteProductImageUseCase } from '../DeleteProductImageUseCase.js';

const PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440099';
const IMAGE_ID = '770e8400-e29b-41d4-a716-446655440001';
const SELLER_ID = '660e8400-e29b-41d4-a716-446655440002';
const ACCESS_TOKEN = 'valid-jwt-token';

const product = (overrides = {}) => ({
  id: PRODUCT_ID,
  seller_id: SELLER_ID,
  name: 'Test Product',
  state: 'published',
  primary_image_path: 'product-images/test/cover.webp',
  ...overrides,
});

const image = (overrides = {}) => ({
  id: IMAGE_ID,
  product_id: PRODUCT_ID,
  path: 'product-images/test/cover.webp',
  alt_text: null,
  position: 0,
  created_at: new Date(),
  ...overrides,
});

describe('DeleteProductImageUseCase', () => {
  let productRepository;
  let storageService;
  let useCase;

  beforeEach(() => {
    productRepository = {
      findById: vi.fn(),
      findImageById: vi.fn(),
      countImages: vi.fn(),
      deleteImage: vi.fn(),
      recomputePrimaryImage: vi.fn(),
    };
    storageService = {
      deleteProductImage: vi.fn().mockResolvedValue({ deleted: true }),
    };
    useCase = new DeleteProductImageUseCase({ productRepository, storageService });
  });

  it('1. rejects a missing productId with 400 VALIDATION_ERROR', async () => {
    await expect(
      useCase.execute({ imageId: IMAGE_ID, sellerId: SELLER_ID, accessToken: ACCESS_TOKEN })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'productId is required',
    });
  });

  it('2. rejects an invalid UUID productId with 400 VALIDATION_ERROR', async () => {
    await expect(
      useCase.execute({
        productId: 'not-a-uuid',
        imageId: IMAGE_ID,
        sellerId: SELLER_ID,
        accessToken: ACCESS_TOKEN,
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'productId must be a valid UUID',
    });
  });

  it('3. rejects a missing imageId with 400 VALIDATION_ERROR', async () => {
    await expect(
      useCase.execute({ productId: PRODUCT_ID, sellerId: SELLER_ID, accessToken: ACCESS_TOKEN })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'imageId is required',
    });
  });

  it('4. rejects an invalid UUID imageId with 400 VALIDATION_ERROR', async () => {
    await expect(
      useCase.execute({
        productId: PRODUCT_ID,
        imageId: 'not-a-uuid',
        sellerId: SELLER_ID,
        accessToken: ACCESS_TOKEN,
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'imageId must be a valid UUID',
    });
  });

  it('5. rejects a missing sellerId with 400 VALIDATION_ERROR', async () => {
    await expect(
      useCase.execute({ productId: PRODUCT_ID, imageId: IMAGE_ID, accessToken: ACCESS_TOKEN })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'sellerId is required',
    });
  });

  it('6. rejects a missing accessToken with 401 UNAUTHORIZED', async () => {
    await expect(
      useCase.execute({ productId: PRODUCT_ID, imageId: IMAGE_ID, sellerId: SELLER_ID })
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
      message: 'Session token not available for storage upload',
    });
  });

  it('7. returns 404 PRODUCT_NOT_FOUND when product does not exist', async () => {
    productRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        productId: PRODUCT_ID,
        imageId: IMAGE_ID,
        sellerId: SELLER_ID,
        accessToken: ACCESS_TOKEN,
      })
    ).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
      message: 'Product not found',
    });
    expect(productRepository.deleteImage).not.toHaveBeenCalled();
  });

  it('8. rejects request when product is owned by another seller with 403 FORBIDDEN', async () => {
    productRepository.findById.mockResolvedValue(product({ seller_id: 'other-seller' }));

    await expect(
      useCase.execute({
        productId: PRODUCT_ID,
        imageId: IMAGE_ID,
        sellerId: SELLER_ID,
        accessToken: ACCESS_TOKEN,
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      message: 'You do not own this product',
    });
    expect(productRepository.deleteImage).not.toHaveBeenCalled();
  });

  it('9. returns 404 PRODUCT_NOT_FOUND when image does not exist', async () => {
    productRepository.findById.mockResolvedValue(product());
    productRepository.findImageById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        productId: PRODUCT_ID,
        imageId: IMAGE_ID,
        sellerId: SELLER_ID,
        accessToken: ACCESS_TOKEN,
      })
    ).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
      message: 'Product image not found',
    });
    expect(productRepository.deleteImage).not.toHaveBeenCalled();
  });

  it('10. returns 404 PRODUCT_NOT_FOUND when image belongs to different product (no leak)', async () => {
    productRepository.findById.mockResolvedValue(product());
    productRepository.findImageById.mockResolvedValue(image({ product_id: OTHER_PRODUCT_ID }));

    await expect(
      useCase.execute({
        productId: PRODUCT_ID,
        imageId: IMAGE_ID,
        sellerId: SELLER_ID,
        accessToken: ACCESS_TOKEN,
      })
    ).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
      message: 'Product image not found',
    });
    expect(productRepository.deleteImage).not.toHaveBeenCalled();
  });

  it('11. throws 409 INVALID_STATE_TRANSITION when deleting last image of published product', async () => {
    productRepository.findById.mockResolvedValue(product({ state: 'published' }));
    productRepository.findImageById.mockResolvedValue(image());
    productRepository.countImages.mockResolvedValue(1);

    await expect(
      useCase.execute({
        productId: PRODUCT_ID,
        imageId: IMAGE_ID,
        sellerId: SELLER_ID,
        accessToken: ACCESS_TOKEN,
      })
    ).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      statusCode: 409,
      message: expect.stringContaining('last image'),
    });
    expect(productRepository.deleteImage).not.toHaveBeenCalled();
  });

  it('12. allows deleting image from published product when multiple images exist', async () => {
    productRepository.findById.mockResolvedValue(product({ state: 'published' }));
    productRepository.findImageById.mockResolvedValue(image());
    productRepository.countImages.mockResolvedValue(2);
    productRepository.deleteImage.mockResolvedValue(image());
    productRepository.recomputePrimaryImage.mockResolvedValue({});

    const result = await useCase.execute({
      productId: PRODUCT_ID,
      imageId: IMAGE_ID,
      sellerId: SELLER_ID,
      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({ meta: { timestamp: expect.any(String) } });
    expect(productRepository.deleteImage).toHaveBeenCalledWith(IMAGE_ID);
    expect(productRepository.recomputePrimaryImage).toHaveBeenCalledWith(PRODUCT_ID);
    expect(storageService.deleteProductImage).toHaveBeenCalledWith(ACCESS_TOKEN, image().path);
  });

  it('13. allows deleting last image of a draft product', async () => {
    productRepository.findById.mockResolvedValue(product({ state: 'draft' }));
    productRepository.findImageById.mockResolvedValue(image());
    productRepository.deleteImage.mockResolvedValue(image());
    productRepository.recomputePrimaryImage.mockResolvedValue({});

    const result = await useCase.execute({
      productId: PRODUCT_ID,
      imageId: IMAGE_ID,
      sellerId: SELLER_ID,
      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({ meta: { timestamp: expect.any(String) } });
    expect(productRepository.countImages).not.toHaveBeenCalled();
    expect(productRepository.deleteImage).toHaveBeenCalledWith(IMAGE_ID);
  });

  it('14. allows deleting last image of an unpublished product', async () => {
    productRepository.findById.mockResolvedValue(product({ state: 'unpublished' }));
    productRepository.findImageById.mockResolvedValue(image());
    productRepository.deleteImage.mockResolvedValue(image());
    productRepository.recomputePrimaryImage.mockResolvedValue({});

    const result = await useCase.execute({
      productId: PRODUCT_ID,
      imageId: IMAGE_ID,
      sellerId: SELLER_ID,
      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({ meta: { timestamp: expect.any(String) } });
    expect(productRepository.countImages).not.toHaveBeenCalled();
    expect(productRepository.deleteImage).toHaveBeenCalledWith(IMAGE_ID);
  });

  it('15. tolerates storage delete failure without failing the request (DB authoritative)', async () => {
    productRepository.findById.mockResolvedValue(product({ state: 'draft' }));
    productRepository.findImageById.mockResolvedValue(image());
    productRepository.deleteImage.mockResolvedValue(image());
    productRepository.recomputePrimaryImage.mockResolvedValue({});
    storageService.deleteProductImage.mockResolvedValue({
      deleted: false,
      error: new Error('Network timeout'),
    });

    const result = await useCase.execute({
      productId: PRODUCT_ID,
      imageId: IMAGE_ID,
      sellerId: SELLER_ID,
      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({ meta: { timestamp: expect.any(String) } });
    expect(productRepository.deleteImage).toHaveBeenCalledWith(IMAGE_ID);
  });

  it('16. happy path: invokes deleteImage, recomputePrimaryImage and storageService with correct arguments', async () => {
    productRepository.findById.mockResolvedValue(product({ state: 'draft' }));
    productRepository.findImageById.mockResolvedValue(image());
    productRepository.deleteImage.mockResolvedValue(image());
    productRepository.recomputePrimaryImage.mockResolvedValue({});

    await useCase.execute({
      productId: PRODUCT_ID,
      imageId: IMAGE_ID,
      sellerId: SELLER_ID,
      accessToken: ACCESS_TOKEN,
    });

    expect(productRepository.deleteImage).toHaveBeenCalledTimes(1);
    expect(productRepository.deleteImage).toHaveBeenCalledWith(IMAGE_ID);
    expect(productRepository.recomputePrimaryImage).toHaveBeenCalledTimes(1);
    expect(productRepository.recomputePrimaryImage).toHaveBeenCalledWith(PRODUCT_ID);
    expect(storageService.deleteProductImage).toHaveBeenCalledTimes(1);
    expect(storageService.deleteProductImage).toHaveBeenCalledWith(ACCESS_TOKEN, image().path);
  });
});
