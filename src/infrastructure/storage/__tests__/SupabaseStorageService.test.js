import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseStorageService } from '../SupabaseStorageService.js';

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
  const sampleBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

  beforeEach(() => {
    mockUpload = vi.fn().mockResolvedValue({ data: { path: `${userId}/avatar.png` }, error: null });
    mockClient = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
        }),
      },
    };
    service = new SupabaseStorageService({ client: mockClient, bucket: 'avatars' });
  });

  it('should upload avatar to Supabase Storage bucket and return storage path', async () => {
    const result = await service.uploadAvatar({
      userId,
      buffer: sampleBuffer,
      mimeType: 'image/png',
      extension: 'png',
    });

    expect(mockClient.storage.from).toHaveBeenCalledWith('avatars');
    expect(mockUpload).toHaveBeenCalledWith(`${userId}/avatar.png`, sampleBuffer, {
      contentType: 'image/png',
      upsert: true,
    });
    expect(result).toEqual({
      path: `avatars/${userId}/avatar.png`,
    });
  });

  it('should throw 400 VALIDATION_ERROR when required parameters are missing', async () => {
    await expect(
      service.uploadAvatar({
        userId: '',
        buffer: sampleBuffer,
        mimeType: 'image/png',
        extension: 'png',
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
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

  it('should still return computed storage path when client.storage is not available in test stub', async () => {
    const fallbackService = new SupabaseStorageService({ client: {}, bucket: 'avatars' });
    const result = await fallbackService.uploadAvatar({
      userId,
      buffer: sampleBuffer,
      mimeType: 'image/jpeg',
      extension: 'jpg',
    });

    expect(result).toEqual({
      path: `avatars/${userId}/avatar.jpg`,
    });
  });
});
