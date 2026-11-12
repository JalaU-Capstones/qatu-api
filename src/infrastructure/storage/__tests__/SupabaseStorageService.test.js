import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_AVATAR_SIZE_BYTES } from '../../../application/use-cases/UploadAvatarUseCase.js';
import { SupabaseStorageService } from '../SupabaseStorageService.js';

vi.mock('../../config/env.js', () => ({
  env: {
    SUPABASE_URL: 'http://host.docker.internal:54321',
    SUPABASE_STORAGE_PUBLIC_URL: 'http://localhost:54321/storage/v1/object/public',
    SUPABASE_STORAGE_BUCKET: 'avatars',
  },
}));

vi.mock('../../config/supabase.js', () => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
  },
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
    service = new SupabaseStorageService({
      client: mockClient,
      bucket: 'avatars',
      storageUrl: storageBaseUrl,
      uuidGenerator: () => fixedUuid,
    });
  });

  it('should upload avatar with UUID filename and return full public URL', async () => {
    const result = await service.uploadAvatar({
      userId,
      buffer: sampleBuffer,
      mimeType: 'image/png',
      extension: 'png',
      originalName: 'avatar.png',
      size: sampleBuffer.length,
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
      })
    ).rejects.toMatchObject({
      code: 'STORAGE_UPLOAD_ERROR',
      statusCode: 500,
      message: 'Failed to upload avatar to storage: Bucket quota exceeded',
    });
  });

  it('should construct full public URL from storageUrl when client.storage is not available', async () => {
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
    });

    expect(result).toEqual({
      path: `${storageBaseUrl}/avatars/${userId}/${fixedUuid}.jpg`,
    });
  });
});
