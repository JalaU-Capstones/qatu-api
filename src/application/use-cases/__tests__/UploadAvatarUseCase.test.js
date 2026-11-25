import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Profile } from '../../../domain/entities/Profile.js';
import { MAX_AVATAR_SIZE_BYTES, UploadAvatarUseCase } from '../UploadAvatarUseCase.js';

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

describe('UploadAvatarUseCase', () => {
  let mockProfileRepository;
  let mockStorageService;
  let useCase;

  const userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const relativeAvatarPath = `avatars/${userId}/550e8400-e29b-41d4-a716-446655440000.webp`;
  const publicAvatarUrl = `http://localhost:54321/storage/v1/object/public/${relativeAvatarPath}`;
  const validBuffer = WEBP_BUF;

  const updatedProfileEntity = new Profile({
    id: userId,
    username: 'john_doe',
    fullName: 'John Doe',
    email: 'john@example.com',
    avatarPath: relativeAvatarPath,
    bio: 'Artisan collector.',
    locale: 'en',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-14T12:00:00.000Z',
  });

  beforeEach(() => {
    mockProfileRepository = {
      update: vi.fn().mockResolvedValue(updatedProfileEntity),
    };
    mockStorageService = {
      uploadAvatar: vi.fn().mockResolvedValue({
        path: relativeAvatarPath,
        publicUrl: publicAvatarUrl,
      }),
    };
    useCase = new UploadAvatarUseCase({
      profileRepository: mockProfileRepository,
      storageService: mockStorageService,
    });
  });

  it('should throw when required dependencies are missing', () => {
    expect(() => new UploadAvatarUseCase()).toThrow('profileRepository is required');
    expect(() => new UploadAvatarUseCase({ profileRepository: mockProfileRepository })).toThrow(
      'storageService is required'
    );
  });

  it('accepts a file name without an extension', async () => {
    const result = await useCase.execute({
      userId,
      requestingUserId: userId,
      buffer: PNG_BUF,
      mimeType: 'image/png',
      originalName: 'avatar',
      size: PNG_BUF.length,
      accessToken: 'test-jwt',
    });

    expect(mockStorageService.uploadAvatar).toHaveBeenCalledWith(
      expect.objectContaining({ extension: 'png', originalName: 'avatar' })
    );
    expect(result.data.id).toBe(userId);
  });

  it('should throw 400 VALIDATION_ERROR when accessToken is missing', async () => {
    await expect(
      useCase.execute({
        userId,
        requestingUserId: userId,
        buffer: validBuffer,
        mimeType: 'image/webp',
        originalName: 'avatar.webp',
        size: validBuffer.length,
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'accessToken is required',
    });
    expect(mockStorageService.uploadAvatar).not.toHaveBeenCalled();
  });

  it('should upload valid JPEG, PNG, or WebP image and update profile avatar_path with relative storage path', async () => {
    const result = await useCase.execute({
      userId,
      requestingUserId: userId,
      buffer: validBuffer,
      mimeType: 'image/webp',
      originalName: 'avatar.webp',
      size: validBuffer.length,
      accessToken: 'test-jwt',
    });

    expect(mockStorageService.uploadAvatar).toHaveBeenCalledWith({
      userId,
      buffer: validBuffer,
      mimeType: 'image/webp',
      extension: 'webp',
      originalName: 'avatar.webp',
      size: validBuffer.length,
    });
    expect(mockStorageService.uploadAvatar.mock.calls[0][0].accessToken).toBe('test-jwt');
    expect(mockProfileRepository.update).toHaveBeenCalledWith(userId, {
      avatar_path: relativeAvatarPath,
    });
    expect(result.data).toEqual({
      id: userId,
      username: 'john_doe',
      full_name: 'John Doe',
      avatar_path: publicAvatarUrl,
      bio: 'Artisan collector.',
      locale: 'en',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-14T12:00:00.000Z',
    });
    expect(result.data).not.toHaveProperty('email');
  });

  it('should throw 401 UNAUTHORIZED when userId is missing', async () => {
    await expect(
      useCase.execute({
        userId: '',
        buffer: validBuffer,
        mimeType: 'image/png',
        accessToken: 'test-jwt',
      })
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
    expect(mockStorageService.uploadAvatar).not.toHaveBeenCalled();
  });

  it('should throw 403 FORBIDDEN when requestingUserId does not match targetUserId', async () => {
    await expect(
      useCase.execute({
        targetUserId: userId,
        requestingUserId: '11111111-2222-3333-4444-555555555555',
        buffer: validBuffer,
        mimeType: 'image/png',
        accessToken: 'test-jwt',
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
    expect(mockStorageService.uploadAvatar).not.toHaveBeenCalled();
    expect(mockProfileRepository.update).not.toHaveBeenCalled();
  });

  it('should throw 400 VALIDATION_ERROR when image buffer is missing or empty', async () => {
    await expect(
      useCase.execute({
        userId,
        requestingUserId: userId,
        buffer: null,
        mimeType: 'image/png',
        accessToken: 'test-jwt',
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });

  it('should throw 422 FILE_TOO_LARGE when image exceeds 2 MB', async () => {
    const oversizedBuffer = Buffer.alloc(MAX_AVATAR_SIZE_BYTES + 1);

    await expect(
      useCase.execute({
        userId,
        requestingUserId: userId,
        buffer: oversizedBuffer,
        mimeType: 'image/jpeg',
        originalName: 'large.jpg',
        size: oversizedBuffer.length,
        accessToken: 'test-jwt',
      })
    ).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
      statusCode: 422,
      message: 'The image exceeds the maximum size of 2 MB.',
    });
    expect(mockStorageService.uploadAvatar).not.toHaveBeenCalled();
  });

  it('should throw 422 INVALID_FILE_FORMAT when MIME type or extension is unsupported', async () => {
    await expect(
      useCase.execute({
        userId,
        requestingUserId: userId,
        buffer: validBuffer,
        mimeType: 'image/gif',
        originalName: 'animated.gif',
        accessToken: 'test-jwt',
      })
    ).rejects.toMatchObject({
      code: 'INVALID_FILE_FORMAT',
      statusCode: 422,
      message: 'Only JPEG, PNG, and WebP images are accepted.',
    });

    await expect(
      useCase.execute({
        userId,
        requestingUserId: userId,
        buffer: validBuffer,
        mimeType: 'image/png',
        originalName: 'malicious.svg',
        accessToken: 'test-jwt',
      })
    ).rejects.toMatchObject({
      code: 'INVALID_FILE_FORMAT',
      statusCode: 422,
      message: 'Only JPEG, PNG, and WebP images are accepted.',
    });

    expect(mockStorageService.uploadAvatar).not.toHaveBeenCalled();
  });

  it('should throw 404 NOT_FOUND when profile does not exist in repository', async () => {
    mockProfileRepository.update.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        userId,
        requestingUserId: userId,
        buffer: PNG_BUF,
        mimeType: 'image/png',
        originalName: 'avatar.png',
        accessToken: 'test-jwt',
      })
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      message: 'Profile not found',
    });
  });

  it('throws 422 INVALID_FILE_FORMAT when avatar buffer has unknown magic bytes (ZIP)', async () => {
    await expect(
      useCase.execute({
        userId,
        requestingUserId: userId,
        buffer: ZIP_BUF,
        mimeType: 'image/png',
        originalName: 'avatar.png',
        size: ZIP_BUF.length,
        accessToken: 'test-jwt',
      })
    ).rejects.toMatchObject({
      code: 'INVALID_FILE_FORMAT',
      statusCode: 422,
      message: 'File content is not a valid JPEG, PNG, or WebP image.',
    });

    expect(mockStorageService.uploadAvatar).not.toHaveBeenCalled();
  });

  it('throws 422 INVALID_FILE_FORMAT when avatar buffer contains random non-image bytes', async () => {
    await expect(
      useCase.execute({
        userId,
        requestingUserId: userId,
        buffer: RANDOM_BUF,
        mimeType: 'image/jpeg',
        originalName: 'avatar.jpg',
        size: RANDOM_BUF.length,
        accessToken: 'test-jwt',
      })
    ).rejects.toMatchObject({
      code: 'INVALID_FILE_FORMAT',
      statusCode: 422,
      message: 'File content is not a valid JPEG, PNG, or WebP image.',
    });

    expect(mockStorageService.uploadAvatar).not.toHaveBeenCalled();
  });

  it('throws 422 INVALID_FILE_FORMAT when declared MIME is image/jpeg but magic bytes are PNG', async () => {
    await expect(
      useCase.execute({
        userId,
        requestingUserId: userId,
        buffer: PNG_BUF,
        mimeType: 'image/jpeg',
        originalName: 'avatar.jpg',
        size: PNG_BUF.length,
        accessToken: 'test-jwt',
      })
    ).rejects.toMatchObject({
      code: 'INVALID_FILE_FORMAT',
      statusCode: 422,
      message: 'File content does not match the declared image format.',
    });

    expect(mockStorageService.uploadAvatar).not.toHaveBeenCalled();
  });

  it('throws 422 INVALID_FILE_FORMAT when declared MIME is image/webp but magic bytes are JPEG', async () => {
    await expect(
      useCase.execute({
        userId,
        requestingUserId: userId,
        buffer: JPEG_BUF,
        mimeType: 'image/webp',
        originalName: 'avatar.webp',
        size: JPEG_BUF.length,
        accessToken: 'test-jwt',
      })
    ).rejects.toMatchObject({
      code: 'INVALID_FILE_FORMAT',
      statusCode: 422,
      message: 'File content does not match the declared image format.',
    });

    expect(mockStorageService.uploadAvatar).not.toHaveBeenCalled();
  });

  it('accepts valid JPEG buffer with image/jpeg MIME type for avatar', async () => {
    const result = await useCase.execute({
      userId,
      requestingUserId: userId,
      buffer: JPEG_BUF,
      mimeType: 'image/jpeg',
      originalName: 'avatar.jpg',
      size: JPEG_BUF.length,
      accessToken: 'test-jwt',
    });

    expect(mockStorageService.uploadAvatar).toHaveBeenCalledWith({
      userId,
      buffer: JPEG_BUF,
      mimeType: 'image/jpeg',
      extension: 'jpg',
      originalName: 'avatar.jpg',
      size: JPEG_BUF.length,
    });
    expect(result.data.id).toBe(userId);
  });

  it('accepts valid PNG buffer with image/png MIME type for avatar', async () => {
    const result = await useCase.execute({
      userId,
      requestingUserId: userId,
      buffer: PNG_BUF,
      mimeType: 'image/png',
      originalName: 'avatar.png',
      size: PNG_BUF.length,
      accessToken: 'test-jwt',
    });

    expect(mockStorageService.uploadAvatar).toHaveBeenCalledWith({
      userId,
      buffer: PNG_BUF,
      mimeType: 'image/png',
      extension: 'png',
      originalName: 'avatar.png',
      size: PNG_BUF.length,
    });
    expect(result.data.id).toBe(userId);
  });
});
