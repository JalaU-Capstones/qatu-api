import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Profile } from '../../../domain/entities/Profile.js';
import { UpdateProfileUseCase } from '../UpdateProfileUseCase.js';

describe('UpdateProfileUseCase', () => {
  let mockProfileRepository;
  let useCase;

  const userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  const updatedProfileEntity = new Profile({
    id: userId,
    username: 'john_doe',
    fullName: 'Jane Doe',
    email: 'john@example.com',
    avatarPath: 'avatars/jane.webp',
    bio: 'Online marketplace enthusiast.',
    locale: 'es',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-14T12:00:00.000Z',
  });

  beforeEach(() => {
    mockProfileRepository = {
      update: vi.fn(),
    };
    useCase = new UpdateProfileUseCase({ profileRepository: mockProfileRepository });
  });

  it('should throw when profileRepository is missing', () => {
    expect(() => new UpdateProfileUseCase()).toThrow('profileRepository is required');
  });

  it('should update profile with valid full_name, bio, avatar_path, and locale', async () => {
    mockProfileRepository.update.mockResolvedValueOnce(updatedProfileEntity);

    const result = await useCase.execute({
      userId,
      updates: {
        full_name: '  Jane Doe  ',
        bio: '  Online marketplace enthusiast.  ',
        avatar_path: '  avatars/jane.webp  ',
        locale: 'es',
      },
    });

    expect(mockProfileRepository.update).toHaveBeenCalledWith(userId, {
      full_name: 'Jane Doe',
      bio: 'Online marketplace enthusiast.',
      avatar_path: 'avatars/jane.webp',
      locale: 'es',
    });

    expect(result.data).toEqual({
      id: userId,
      username: 'john_doe',
      full_name: 'Jane Doe',
      avatar_path: 'avatars/jane.webp',
      bio: 'Online marketplace enthusiast.',
      locale: 'es',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-14T12:00:00.000Z',
    });
    expect(result.data).not.toHaveProperty('email');
    expect(result.meta.timestamp).toEqual(expect.any(String));
  });

  it('should throw 403 FORBIDDEN when requestingUserId does not match targetUserId', async () => {
    await expect(
      useCase.execute({
        targetUserId: userId,
        requestingUserId: '11111111-2222-3333-4444-555555555555',
        updates: { bio: 'Trying to modify another profile' },
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      message: 'You do not have permission to update this profile',
    });
    expect(mockProfileRepository.update).not.toHaveBeenCalled();
  });

  it('should throw 400 VALIDATION_ERROR when avatar_path has an invalid format', async () => {
    await expect(
      useCase.execute({
        userId,
        updates: { avatar_path: '../etc/passwd' },
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'Avatar path must be a valid storage path or URL.',
    });

    await expect(
      useCase.execute({
        userId,
        updates: { avatar_path: 'avatars/hack.exe' },
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'Avatar path must be a valid storage path or URL.',
    });

    expect(mockProfileRepository.update).not.toHaveBeenCalled();
  });

  it('should throw 401 UNAUTHORIZED when userId is missing', async () => {
    await expect(
      useCase.execute({
        userId: '',
        updates: { bio: 'Hello' },
      })
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
    expect(mockProfileRepository.update).not.toHaveBeenCalled();
  });

  it('should throw 400 VALIDATION_ERROR when full_name is too short or too long', async () => {
    await expect(
      useCase.execute({
        userId,
        updates: { full_name: 'A' },
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });

    await expect(
      useCase.execute({
        userId,
        updates: { full_name: 'A'.repeat(101) },
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });

    expect(mockProfileRepository.update).not.toHaveBeenCalled();
  });

  it('should throw 400 VALIDATION_ERROR when bio exceeds 500 characters', async () => {
    await expect(
      useCase.execute({
        userId,
        updates: { bio: 'x'.repeat(501) },
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'Bio must be at most 500 characters long.',
    });

    expect(mockProfileRepository.update).not.toHaveBeenCalled();
  });

  it('should throw 400 VALIDATION_ERROR when avatar_path exceeds 500 characters', async () => {
    await expect(
      useCase.execute({
        userId,
        updates: { avatar_path: 'a'.repeat(501) },
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'Avatar path must be at most 500 characters long.',
    });

    expect(mockProfileRepository.update).not.toHaveBeenCalled();
  });

  it('should throw 400 VALIDATION_ERROR when locale is invalid', async () => {
    await expect(
      useCase.execute({
        userId,
        updates: { locale: 'x' },
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });

    expect(mockProfileRepository.update).not.toHaveBeenCalled();
  });

  it('should throw 400 VALIDATION_ERROR when no updatable fields are provided', async () => {
    await expect(
      useCase.execute({
        userId,
        updates: {},
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'At least one profile field must be provided',
    });

    expect(mockProfileRepository.update).not.toHaveBeenCalled();
  });

  it('should throw 404 NOT_FOUND when repository returns null', async () => {
    mockProfileRepository.update.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        userId,
        updates: { bio: 'Updated bio' },
      })
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      message: 'Profile not found',
    });
  });
});
