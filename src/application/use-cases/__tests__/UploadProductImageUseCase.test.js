import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadProductImageUseCase } from '../UploadProductImageUseCase.js';

describe('UploadProductImageUseCase', () => {
  let mockProductRepository;
  let mockStorageService;
  let useCase;

  const productId = '550e8400-e29b-41d4-a716-446655440000';
  const sellerId = 'seller-123';
  const sampleFile = {
    buffer: Buffer.from('fake-image-bytes'),
    mimeType: 'image/png',
    originalName: 'product.png',
    size: 16,
  };

  beforeEach(() => {
    mockProductRepository = {
      findById: vi.fn().mockResolvedValue({
        id: productId,
        seller_id: sellerId,
        state: 'draft',
      }),
      countImages: vi.fn().mockResolvedValue(0),
      addImage: vi.fn().mockResolvedValue({
        id: 'img-1',
        product_id: productId,
        path: `product-images/${productId}/img-1.png`,
        altText: null,
        position: 0,
      }),
      setPrimaryImageIfNull: vi.fn().mockResolvedValue(true),
    };

    mockStorageService = {
      uploadProductImage: vi.fn().mockResolvedValue({
        bucket: 'product-images',
        path: `product-images/${productId}/img-1.png`,
        publicUrl: `http://localhost:54321/storage/v1/object/public/product-images/${productId}/img-1.png`,
      }),
    };

    useCase = new UploadProductImageUseCase({
      productRepository: mockProductRepository,
      storageService: mockStorageService,
    });
  });

  it('throws 400 VALIDATION_ERROR when accessToken is missing', async () => {
    await expect(
      useCase.execute({
        productId,
        sellerId,
        file: sampleFile,
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'accessToken is required',
    });

    expect(mockStorageService.uploadProductImage).not.toHaveBeenCalled();
  });

  it('passes accessToken to storageService.uploadProductImage when provided', async () => {
    const result = await useCase.execute({
      productId,
      sellerId,
      file: sampleFile,
      accessToken: 'seller-jwt-token',
    });

    expect(mockStorageService.uploadProductImage).toHaveBeenCalledWith({
      productId,
      buffer: sampleFile.buffer,
      mimeType: sampleFile.mimeType,
      extension: 'png',
      originalName: sampleFile.originalName,
      size: sampleFile.size,
      accessToken: 'seller-jwt-token',
    });

    expect(result.data).toEqual({
      id: 'img-1',
      product_id: productId,
      path: `product-images/${productId}/img-1.png`,
      altText: null,
      position: 0,
    });
  });
});
