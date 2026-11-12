import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetCurrentUserUseCase } from '../GetCurrentUserUseCase.js';

describe('GetCurrentUserUseCase', () => {
  let mockProfileRepository;
  let useCase;

  const mockProfile = {
    id: 'user-uuid-1',
    username: 'buyer_test',
    full_name: 'Buyer Test',
    email: 'buyer@example.com',
    avatar_path: null,
    bio: null,
    locale: 'en',
    roles: [{ id: 1, name: 'buyer', created_at: '2026-01-01T00:00:00.000Z' }],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    mockProfileRepository = {
      findById: vi.fn(),
    };
    useCase = new GetCurrentUserUseCase({ profileRepository: mockProfileRepository });
  });

  it('throws error when profileRepository is missing in constructor', () => {
    expect(() => new GetCurrentUserUseCase()).toThrow('profileRepository is required');
  });

  it('throws 401 UNAUTHORIZED when userId is missing', async () => {
    await expect(useCase.execute({})).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
      message: 'User ID is required',
    });
  });

  it('throws 404 NOT_FOUND when profile does not exist', async () => {
    mockProfileRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ userId: 'user-uuid-404' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      message: 'User profile not found',
    });
  });

  it('returns LoginResponseDTO when user profile is found', async () => {
    mockProfileRepository.findById.mockResolvedValue(mockProfile);

    const result = await useCase.execute({ userId: 'user-uuid-1', email: 'buyer@example.com' });

    expect(result.data.user.id).toBe('user-uuid-1');
    expect(result.data.user.email).toBe('buyer@example.com');
    expect(result.data.profile.username).toBe('buyer_test');
    expect(result.data.roles).toHaveLength(1);
    expect(result.data.roles[0].name).toBe('buyer');
    expect(result.meta.timestamp).toBeDefined();
  });

  it('falls back to profile.email when email is omitted in params', async () => {
    mockProfileRepository.findById.mockResolvedValue(mockProfile);

    const result = await useCase.execute({ userId: 'user-uuid-1' });

    expect(result.data.user.email).toBe('buyer@example.com');
  });
});
