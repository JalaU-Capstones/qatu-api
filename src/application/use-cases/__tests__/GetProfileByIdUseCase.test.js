import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Profile } from '../../../domain/entities/Profile.js';
import { GetProfileByIdUseCase } from '../GetProfileByIdUseCase.js';

describe('GetProfileByIdUseCase', () => {
  let mockProfileRepository;
  let useCase;

  const validId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  const sampleProfile = new Profile({
    id: validId,
    username: 'john_doe',
    fullName: 'John Doe',
    email: 'john@example.com',
    avatarPath: 'avatars/john.webp',
    bio: 'Artisan collector.',
    locale: 'en',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  });

  beforeEach(() => {
    mockProfileRepository = {
      findById: vi.fn(),
    };
    useCase = new GetProfileByIdUseCase({ profileRepository: mockProfileRepository });
  });

  it('should throw when profileRepository is missing', () => {
    expect(() => new GetProfileByIdUseCase()).toThrow('profileRepository is required');
  });

  it('should return serialized profile envelope when profile exists', async () => {
    mockProfileRepository.findById.mockResolvedValueOnce(sampleProfile);

    const result = await useCase.execute({ profileId: validId });

    expect(mockProfileRepository.findById).toHaveBeenCalledWith(validId);
    expect(result.data).toEqual({
      id: validId,
      username: 'john_doe',
      full_name: 'John Doe',
      avatar_path: 'avatars/john.webp',
      bio: 'Artisan collector.',
      locale: 'en',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
    });
    expect(result.data).not.toHaveProperty('email');
    expect(result.meta.timestamp).toEqual(expect.any(String));
  });

  it('should accept a plain string UUID input', async () => {
    mockProfileRepository.findById.mockResolvedValueOnce(sampleProfile);

    const result = await useCase.execute(validId);
    expect(result.data.id).toBe(validId);
  });

  it('should throw 404 NOT_FOUND when profileId is not a valid UUID', async () => {
    await expect(useCase.execute({ profileId: 'not-a-uuid' })).rejects.toMatchObject({
      message: 'Profile not found',
      code: 'NOT_FOUND',
      statusCode: 404,
    });
    expect(mockProfileRepository.findById).not.toHaveBeenCalled();
  });

  it('should throw 404 NOT_FOUND when profile does not exist in repository', async () => {
    mockProfileRepository.findById.mockResolvedValueOnce(null);

    await expect(useCase.execute({ profileId: validId })).rejects.toMatchObject({
      message: 'Profile not found',
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });
});
