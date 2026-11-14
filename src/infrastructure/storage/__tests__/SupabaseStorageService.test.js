import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_AVATAR_SIZE_BYTES } from '../../../application/use-cases/UploadAvatarUseCase.js';
import { env } from '../../config/env.js';
import { createUserScopedSupabaseClient } from '../../config/supabase.js';
import { MAX_PRODUCT_IMAGE_SIZE_BYTES } from '../SupabaseStorageService.js';
import { SupabaseStorageService } from '../SupabaseStorageService.js';

vi.mock('../../config/env.js', () => ({
  env: {
    SUPABASE_URL: 'http://host.docker.internal:54321',
    SUPABASE_STORAGE_PUBLIC_URL: 'http://localhost:54321/storage/v1/object/public',
    SUPABASE_STORAGE_BUCKET: 'avatars',
    PUBLIC_APP_URL: '',
  },
}));

vi.mock('../../config/supabase.js', () => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
  },
  createUserScopedSupabaseClient: vi.fn(),
}));

describe('SupabaseStorageService', () => {
  let mockUpload;
  let mockClient;
  let service;

  const userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const fixedUuid = '550e8400-e29b-41d4-a716-446655440000';
  const sampleBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const storageBaseUrl = 'https://example.supabase.co/storage/v1/object/public';

  beforeEach(() => {
    env.PUBLIC_APP_URL = '';
    mockUpload = vi
      .fn()
      .mockResolvedValue({ data: { path: `${userId}/${fixedUuid}.png` }, error: null });
    mockClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
        }),
      },
    };
    createUserScopedSupabaseClient.mockReset();
    createUserScopedSupabaseClient.mockReturnValue(mockClient);
    service = new SupabaseStorageService({
      client: mockClient,
      bucket: 'avatars',
      storageUrl: storageBaseUrl,
      uuidGenerator: () => fixedUuid,
    });
  });

  it('should throw 400 VALIDATION_ERROR when accessToken is missing on uploadAvatar', async () => {
    await expect(
      service.uploadAvatar({
        userId,
        buffer: sampleBuffer,
        mimeType: 'image/png',
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'accessToken is required for avatar upload',
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('should call createUserScopedSupabaseClient with accessToken and use scoped client', async () => {
    const scopedUpload = vi.fn().mockResolvedValue({ data: {}, error: null });
    const scopedClient = {
      storage: {
        from: vi.fn().mockReturnValue({ upload: scopedUpload }),
      },
    };
    createUserScopedSupabaseClient.mockReturnValueOnce(scopedClient);

    const result = await service.uploadAvatar({
      userId,
      buffer: sampleBuffer,
      mimeType: 'image/png',
      extension: 'png',
      originalName: 'avatar.png',
      size: sampleBuffer.length,
      accessToken: 'custom-user-jwt',
    });

    expect(createUserScopedSupabaseClient).toHaveBeenCalledWith('custom-user-jwt');
    expect(scopedClient.storage.from).toHaveBeenCalledWith('avatars');
    expect(scopedUpload).toHaveBeenCalled();
    expect(mockClient.storage.from).not.toHaveBeenCalled();
    expect(result.path).toBe(`${storageBaseUrl}/avatars/${userId}/${fixedUuid}.png`);
  });

  it('should upload avatar with UUID filename and return full public URL', async () => {
    const result = await service.uploadAvatar({
      userId,
      buffer: sampleBuffer,
      mimeType: 'image/png',
      extension: 'png',
      originalName: 'avatar.png',
      size: sampleBuffer.length,
      accessToken: 'test-jwt',
    });

    expect(mockClient.storage.from).toHaveBeenCalledWith('avatars');
    expect(mockUpload).toHaveBeenCalledWith(`${userId}/${fixedUuid}.png`, sampleBuffer, {
      contentType: 'image/png',
      upsert: true,
    });
    expect(result).toEqual({
      path: `${storageBaseUrl}/avatars/${userId}/${fixedUuid}.png`,
    });
  });

  it('should use env.SUPABASE_STORAGE_PUBLIC_URL to construct final URL, not env.SUPABASE_URL', async () => {
    const defaultUrlService = new SupabaseStorageService({
      client: mockClient,
      bucket: 'avatars',
      uuidGenerator: () => fixedUuid,
    });

    const result = await defaultUrlService.uploadAvatar({
      userId,
      buffer: sampleBuffer,
      mimeType: 'image/png',
      extension: 'png',
      originalName: 'avatar.png',
      size: sampleBuffer.length,
      accessToken: 'test-jwt',
    });

    expect(result.path).toBe(
      `http://localhost:54321/storage/v1/object/public/avatars/${userId}/${fixedUuid}.png`
    );
    expect(result.path).not.toContain('host.docker.internal');
  });

  it('should throw 400 VALIDATION_ERROR when userId or buffer is missing', async () => {
    await expect(
      service.uploadAvatar({
        userId: '',
        buffer: sampleBuffer,
        mimeType: 'image/png',
        accessToken: 'test-jwt',
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('should throw 422 FILE_TOO_LARGE before uploading when buffer exceeds 2 MB', async () => {
    const oversized = Buffer.alloc(MAX_AVATAR_SIZE_BYTES + 1);

    await expect(
      service.uploadAvatar({
        userId,
        buffer: oversized,
        mimeType: 'image/jpeg',
        extension: 'jpg',
        accessToken: 'test-jwt',
      })
    ).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
      statusCode: 422,
      message: 'The image exceeds the maximum size of 2 MB.',
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('should throw 422 INVALID_FILE_FORMAT before uploading when MIME type or extension (.exe, .svg, .gif) is unsupported', async () => {
    for (const badCase of [
      { mimeType: 'image/gif', originalName: 'anim.gif' },
      { mimeType: 'image/svg+xml', originalName: 'vector.svg' },
      { mimeType: 'application/x-msdownload', originalName: 'malware.exe' },
      { mimeType: 'image/png', originalName: 'disguised.exe' },
    ]) {
      await expect(
        service.uploadAvatar({
          userId,
          buffer: sampleBuffer,
          accessToken: 'test-jwt',
          ...badCase,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_FILE_FORMAT',
        statusCode: 422,
        message: 'Only JPEG, PNG, and WebP images are accepted.',
      });
    }
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('should throw 500 STORAGE_UPLOAD_ERROR when Supabase Storage returns an error', async () => {
    mockUpload.mockResolvedValueOnce({
      data: null,
      error: { message: 'Bucket quota exceeded' },
    });

    await expect(
      service.uploadAvatar({
        userId,
        buffer: sampleBuffer,
        mimeType: 'image/webp',
        extension: '.webp',
        accessToken: 'test-jwt',
      })
    ).rejects.toMatchObject({
      code: 'STORAGE_UPLOAD_ERROR',
      statusCode: 500,
      message: 'Failed to upload avatar to storage: Bucket quota exceeded',
    });
  });

  it('should construct full public URL from storageUrl when client.storage is not available', async () => {
    createUserScopedSupabaseClient.mockReturnValueOnce({});
    const fallbackService = new SupabaseStorageService({
      client: {},
      bucket: 'avatars',
      storageUrl: storageBaseUrl,
      uuidGenerator: () => fixedUuid,
    });
    const result = await fallbackService.uploadAvatar({
      userId,
      buffer: sampleBuffer,
      mimeType: 'image/jpeg',
      extension: 'jpg',
      accessToken: 'test-jwt',
    });

    expect(result).toEqual({
      path: `${storageBaseUrl}/avatars/${userId}/${fixedUuid}.jpg`,
    });
  });

  describe('getPublicUrl', () => {
    it('returns the Supabase direct URL when PUBLIC_APP_URL is empty', () => {
      const directUrlService = new SupabaseStorageService({
        client: mockClient,
        storageUrl: 'http://localhost:54321/storage/v1/object/public',
      });

      expect(directUrlService.getPublicUrl('product-images', 'abc/xyz.webp')).toBe(
        'http://localhost:54321/storage/v1/object/public/product-images/abc/xyz.webp'
      );
    });

    it('returns the SPA-origin URL when PUBLIC_APP_URL is set', () => {
      env.PUBLIC_APP_URL = 'https://qatu.com';

      expect(service.getPublicUrl('product-images', 'abc/xyz.webp')).toBe(
        'https://qatu.com/product-images/abc/xyz.webp'
      );
    });

    it('strips a trailing slash from PUBLIC_APP_URL', () => {
      env.PUBLIC_APP_URL = 'https://qatu.com/';

      expect(service.getPublicUrl('product-images', 'abc/xyz.webp')).toBe(
        'https://qatu.com/product-images/abc/xyz.webp'
      );
    });

    it('throws VALIDATION_ERROR when bucket is missing', () => {
      let caughtError;
      try {
        service.getPublicUrl('', 'abc.webp');
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('throws VALIDATION_ERROR when objectKey is missing', () => {
      let caughtError;
      try {
        service.getPublicUrl('product-images', '');
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });
  });

  describe('uploadProductImage', () => {
    it('throws 400 VALIDATION_ERROR when accessToken is missing on uploadProductImage', async () => {
      await expect(
        service.uploadProductImage({
          productId: 'prod-uuid',
          buffer: Buffer.from('x'),
          mimeType: 'image/webp',
        })
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        message: 'accessToken is required for product image upload',
      });
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('calls createUserScopedSupabaseClient with accessToken and uses scoped client', async () => {
      const scopedUpload = vi.fn().mockResolvedValue({ data: {}, error: null });
      const scopedClient = {
        storage: {
          from: vi.fn().mockReturnValue({ upload: scopedUpload }),
        },
      };
      createUserScopedSupabaseClient.mockReturnValueOnce(scopedClient);

      await service.uploadProductImage({
        productId: 'prod-uuid',
        buffer: Buffer.from('x'),
        mimeType: 'image/webp',
        accessToken: 'scoped-jwt',
      });

      expect(createUserScopedSupabaseClient).toHaveBeenCalledWith('scoped-jwt');
      expect(scopedClient.storage.from).toHaveBeenCalledWith('product-images');
      expect(scopedUpload).toHaveBeenCalled();
      expect(mockClient.storage.from).not.toHaveBeenCalled();
    });

    it('uploads to product-images with a product UUID path and upsert disabled', async () => {
      await service.uploadProductImage({
        productId: 'prod-uuid',
        buffer: Buffer.from('x'),
        mimeType: 'image/webp',
        accessToken: 'test-jwt',
      });

      expect(mockClient.storage.from).toHaveBeenCalledWith('product-images');
      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringMatching(/^prod-uuid\/[0-9a-f-]+\.webp$/),
        Buffer.from('x'),
        { contentType: 'image/webp', upsert: false }
      );
    });

    it('returns the bucket, relative path, and computed public URL', async () => {
      const result = await service.uploadProductImage({
        productId: 'prod-uuid',
        buffer: Buffer.from('x'),
        mimeType: 'image/webp',
        accessToken: 'test-jwt',
      });

      expect(result.bucket).toBe('product-images');
      expect(result.path).toBe(`product-images/prod-uuid/${fixedUuid}.webp`);
      expect(result.publicUrl).toBe(`${storageBaseUrl}/product-images/prod-uuid/${fixedUuid}.webp`);
    });

    it('throws VALIDATION_ERROR when productId is missing', async () => {
      await expect(
        service.uploadProductImage({
          buffer: Buffer.from('x'),
          mimeType: 'image/webp',
          accessToken: 'test-jwt',
        })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('throws FILE_TOO_LARGE when the buffer exceeds 5 MB', async () => {
      await expect(
        service.uploadProductImage({
          productId: 'prod-uuid',
          buffer: Buffer.alloc(MAX_PRODUCT_IMAGE_SIZE_BYTES + 1),
          mimeType: 'image/jpeg',
          accessToken: 'test-jwt',
        })
      ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE', statusCode: 422 });
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('throws INVALID_FILE_FORMAT when the MIME type is unsupported', async () => {
      await expect(
        service.uploadProductImage({
          productId: 'prod-uuid',
          buffer: Buffer.from('x'),
          mimeType: 'image/gif',
          accessToken: 'test-jwt',
        })
      ).rejects.toMatchObject({ code: 'INVALID_FILE_FORMAT', statusCode: 422 });
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('throws STORAGE_UPLOAD_ERROR when the client upload fails', async () => {
      mockUpload.mockResolvedValueOnce({ error: { message: 'quota exceeded' } });

      await expect(
        service.uploadProductImage({
          productId: 'prod-uuid',
          buffer: Buffer.from('x'),
          mimeType: 'image/webp',
          accessToken: 'test-jwt',
        })
      ).rejects.toMatchObject({
        code: 'STORAGE_UPLOAD_ERROR',
        statusCode: 500,
        message: 'Failed to upload product image to storage: quota exceeded',
      });
    });
  });

  describe('_uploadToStorage', () => {
    it('uses explicit client parameter when provided', async () => {
      const explicitUpload = vi.fn().mockResolvedValue({ error: null });
      const explicitClient = {
        storage: { from: vi.fn().mockReturnValue({ upload: explicitUpload }) },
      };

      await service._uploadToStorage({
        client: explicitClient,
        bucket: 'avatars',
        objectKey: 'some/key.png',
        buffer: Buffer.from('x'),
        contentType: 'image/png',
        upsert: true,
        uploadType: 'avatar',
      });

      expect(explicitClient.storage.from).toHaveBeenCalledWith('avatars');
      expect(explicitUpload).toHaveBeenCalledWith('some/key.png', expect.any(Buffer), {
        contentType: 'image/png',
        upsert: true,
      });
      expect(mockClient.storage.from).not.toHaveBeenCalled();
    });

    it('falls back to this.client when client parameter is omitted', async () => {
      await service._uploadToStorage({
        bucket: 'avatars',
        objectKey: 'fallback/key.png',
        buffer: Buffer.from('x'),
        contentType: 'image/png',
        upsert: true,
        uploadType: 'avatar',
      });

      expect(mockClient.storage.from).toHaveBeenCalledWith('avatars');
      expect(mockUpload).toHaveBeenCalledWith('fallback/key.png', expect.any(Buffer), {
        contentType: 'image/png',
        upsert: true,
      });
    });
  });
});
