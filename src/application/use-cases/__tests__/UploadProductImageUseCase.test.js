import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../../infrastructure/config/env.js';
import { UploadProductImageUseCase } from '../UploadProductImageUseCase.js';

const JPEG_BUF = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_BUF = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP_BUF = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
  Buffer.alloc(4),
]);
const ZIP_BUF = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
const RANDOM_BUF = Buffer.from([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
]);

describe('UploadProductImageUseCase', () => {
  let mockProductRepository;
  let mockStorageService;
  let useCase;

  const productId = '550e8400-e29b-41d4-a716-446655440000';
  const sellerId = '00000000-0000-4000-8000-000000000002';
  const sampleFile = {
    buffer: PNG_BUF,
    mimeType: 'image/png',
    originalName: 'product.png',
    size: PNG_BUF.length,
  };

  beforeEach(() => {
    env.PUBLIC_APP_URL = '';
    env.SUPABASE_STORAGE_PUBLIC_URL = 'http://localhost:54321/storage/v1/object/public';
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

  it('requires productRepository and storageService', () => {
    expect(() => new UploadProductImageUseCase()).toThrow('productRepository is required');
    expect(
      () => new UploadProductImageUseCase({ productRepository: mockProductRepository })
    ).toThrow('storageService is required');
  });

  it.each([
    [
      { accessToken: 'token', productId: 'not-a-uuid', sellerId, file: sampleFile },
      'productId must be a valid UUID',
    ],
    [{ accessToken: 'token', productId, file: sampleFile }, 'sellerId is required'],
    [{ accessToken: 'token', productId, sellerId, file: null }, 'image file is required'],
    [
      { accessToken: 'token', productId, sellerId, file: { ...sampleFile, size: 0 } },
      'image file is required',
    ],
  ])('rejects an invalid command (%s)', async (command, message) => {
    await expect(useCase.execute(command)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message,
    });
    expect(mockStorageService.uploadProductImage).not.toHaveBeenCalled();
  });

  it('throws 404 PRODUCT_NOT_FOUND when the product does not exist', async () => {
    mockProductRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ productId, sellerId, file: sampleFile, accessToken: 'token' })
    ).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
      message: 'Product not found',
    });
  });

  it('throws 403 FORBIDDEN when the seller does not own the product', async () => {
    mockProductRepository.findById.mockResolvedValue({
      id: productId,
      seller_id: 'another-seller',
      state: 'draft',
    });

    await expect(
      useCase.execute({ productId, sellerId, file: sampleFile, accessToken: 'token' })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      message: 'You do not own this product',
    });
  });

  it('rejects uploads to an archived product', async () => {
    mockProductRepository.findById.mockResolvedValue({
      id: productId,
      seller_id: sellerId,
      state: 'archived',
    });

    await expect(
      useCase.execute({ productId, sellerId, file: sampleFile, accessToken: 'token' })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'Cannot upload images to an archived product',
    });
  });

  it('throws 422 IMAGE_LIMIT_REACHED when the product already has five images', async () => {
    mockProductRepository.countImages.mockResolvedValue(5);

    await expect(
      useCase.execute({ productId, sellerId, file: sampleFile, accessToken: 'token' })
    ).rejects.toMatchObject({
      code: 'IMAGE_LIMIT_REACHED',
      statusCode: 422,
      message: 'A product can have at most 5 images',
    });
    expect(mockStorageService.uploadProductImage).not.toHaveBeenCalled();
  });

  it('rethrows an Error from the storage service unchanged', async () => {
    const storageError = new Error('storage down');
    mockStorageService.uploadProductImage.mockRejectedValue(storageError);

    await expect(
      useCase.execute({ productId, sellerId, file: sampleFile, accessToken: 'token' })
    ).rejects.toBe(storageError);
  });

  it('wraps a non-Error rejection from the storage service', async () => {
    mockStorageService.uploadProductImage.mockRejectedValue('boom');

    await expect(
      useCase.execute({ productId, sellerId, file: sampleFile, accessToken: 'token' })
    ).rejects.toMatchObject({
      message: `Failed to upload product image for ${productId}`,
      cause: 'boom',
    });
  });

  it('defaults the declared MIME to an empty string when it is missing', async () => {
    await expect(
      useCase.execute({
        productId,
        sellerId,
        file: { buffer: PNG_BUF, mimeType: undefined, size: PNG_BUF.length },
        accessToken: 'token',
      })
    ).rejects.toMatchObject({
      code: 'INVALID_FILE_FORMAT',
      message: 'File content does not match the declared image format.',
    });
  });

  it('uses the supplied position when uploading an image', async () => {
    await useCase.execute({
      productId,
      sellerId,
      file: sampleFile,
      position: '2',
      accessToken: 'token',
    });

    expect(mockProductRepository.addImage).toHaveBeenCalledWith(
      expect.objectContaining({ position: 2 })
    );
  });

  it.each([
    ['IMAGE/JPEG', 'photo.jpg', 'jpg'],
    ['IMAGE/JPEG', 'photo.gif', 'jpg'],
    ['IMAGE/JPEG', undefined, 'jpg'],
  ])(
    'derives the extension from the file name for a non-canonical MIME %s',
    async (mimeType, originalName, extension) => {
      await useCase.execute({
        productId,
        sellerId,
        file: { buffer: JPEG_BUF, mimeType, originalName, size: JPEG_BUF.length },
        accessToken: 'token',
      });

      expect(mockStorageService.uploadProductImage).toHaveBeenCalledWith(
        expect.objectContaining({ extension })
      );
    }
  );

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
      path: `http://localhost:54321/storage/v1/object/public/product-images/${productId}/img-1.png`,
      alt_text: null,
      position: 0,
      created_at: null,
    });
  });

  it('returns a resolved product-image URL when PUBLIC_APP_URL is empty', async () => {
    env.PUBLIC_APP_URL = '';

    const result = await useCase.execute({
      productId,
      sellerId,
      file: sampleFile,
      accessToken: 'seller-jwt-token',
    });

    expect(result.data.path).toBe(
      `http://localhost:54321/storage/v1/object/public/product-images/${productId}/img-1.png`
    );
  });

  it('returns a SPA-origin product-image URL when PUBLIC_APP_URL is set', async () => {
    env.PUBLIC_APP_URL = 'http://localhost:5173';

    const result = await useCase.execute({
      productId,
      sellerId,
      file: sampleFile,
      accessToken: 'seller-jwt-token',
    });

    expect(result.data.path).toBe(`http://localhost:5173/product-images/${productId}/img-1.png`);
  });

  it('keeps the raw DB row returned by addImage unchanged', async () => {
    await useCase.execute({
      productId,
      sellerId,
      file: sampleFile,
      accessToken: 'seller-jwt-token',
    });

    const rawRow = await mockProductRepository.addImage.mock.results[0].value;
    expect(rawRow.path).toBe(`product-images/${productId}/img-1.png`);
  });

  it('throws 422 INVALID_FILE_FORMAT when file buffer has unknown magic bytes (ZIP)', async () => {
    await expect(
      useCase.execute({
        productId,
        sellerId,
        file: {
          buffer: ZIP_BUF,
          mimeType: 'image/png',
          originalName: 'test.png',
          size: ZIP_BUF.length,
        },
        accessToken: 'seller-jwt-token',
      })
    ).rejects.toMatchObject({
      code: 'INVALID_FILE_FORMAT',
      statusCode: 422,
      message: 'File content is not a valid JPEG, PNG, or WebP image.',
    });

    expect(mockStorageService.uploadProductImage).not.toHaveBeenCalled();
  });

  it('throws 422 INVALID_FILE_FORMAT when file buffer contains random non-image bytes', async () => {
    await expect(
      useCase.execute({
        productId,
        sellerId,
        file: {
          buffer: RANDOM_BUF,
          mimeType: 'image/jpeg',
          originalName: 'test.jpg',
          size: RANDOM_BUF.length,
        },
        accessToken: 'seller-jwt-token',
      })
    ).rejects.toMatchObject({
      code: 'INVALID_FILE_FORMAT',
      statusCode: 422,
      message: 'File content is not a valid JPEG, PNG, or WebP image.',
    });

    expect(mockStorageService.uploadProductImage).not.toHaveBeenCalled();
  });

  it('throws 422 INVALID_FILE_FORMAT when declared MIME is image/jpeg but magic bytes are PNG', async () => {
    await expect(
      useCase.execute({
        productId,
        sellerId,
        file: {
          buffer: PNG_BUF,
          mimeType: 'image/jpeg',
          originalName: 'test.jpg',
          size: PNG_BUF.length,
        },
        accessToken: 'seller-jwt-token',
      })
    ).rejects.toMatchObject({
      code: 'INVALID_FILE_FORMAT',
      statusCode: 422,
      message: 'File content does not match the declared image format.',
    });

    expect(mockStorageService.uploadProductImage).not.toHaveBeenCalled();
  });

  it('throws 422 INVALID_FILE_FORMAT when declared MIME is image/webp but magic bytes are JPEG', async () => {
    await expect(
      useCase.execute({
        productId,
        sellerId,
        file: {
          buffer: JPEG_BUF,
          mimeType: 'image/webp',
          originalName: 'test.webp',
          size: JPEG_BUF.length,
        },
        accessToken: 'seller-jwt-token',
      })
    ).rejects.toMatchObject({
      code: 'INVALID_FILE_FORMAT',
      statusCode: 422,
      message: 'File content does not match the declared image format.',
    });

    expect(mockStorageService.uploadProductImage).not.toHaveBeenCalled();
  });

  it('accepts valid JPEG buffer with image/jpeg MIME type', async () => {
    const result = await useCase.execute({
      productId,
      sellerId,
      file: {
        buffer: JPEG_BUF,
        mimeType: 'image/jpeg',
        originalName: 'photo.jpg',
        size: JPEG_BUF.length,
      },
      accessToken: 'seller-jwt-token',
    });

    expect(mockStorageService.uploadProductImage).toHaveBeenCalledWith({
      productId,
      buffer: JPEG_BUF,
      mimeType: 'image/jpeg',
      extension: 'jpg',
      originalName: 'photo.jpg',
      size: JPEG_BUF.length,
      accessToken: 'seller-jwt-token',
    });
    expect(result.data.id).toBe('img-1');
  });

  it('accepts valid WebP buffer with image/webp MIME type', async () => {
    const result = await useCase.execute({
      productId,
      sellerId,
      file: {
        buffer: WEBP_BUF,
        mimeType: 'image/webp',
        originalName: 'photo.webp',
        size: WEBP_BUF.length,
      },
      accessToken: 'seller-jwt-token',
    });

    expect(mockStorageService.uploadProductImage).toHaveBeenCalledWith({
      productId,
      buffer: WEBP_BUF,
      mimeType: 'image/webp',
      extension: 'webp',
      originalName: 'photo.webp',
      size: WEBP_BUF.length,
      accessToken: 'seller-jwt-token',
    });
    expect(result.data.id).toBe('img-1');
  });
});
