import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RefreshSessionUseCase } from '../RefreshSessionUseCase.js';

describe('RefreshSessionUseCase', () => {
  let mockAuthService;
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
    mockAuthService = {
      refreshSession: vi.fn(),
    };
    mockProfileRepository = {
      findById: vi.fn(),
    };
    useCase = new RefreshSessionUseCase({
      authService: mockAuthService,
      profileRepository: mockProfileRepository,
    });
  });

  it('throws error when dependencies are missing in constructor', () => {
    expect(() => new RefreshSessionUseCase({ profileRepository: mockProfileRepository })).toThrow(
      'authService is required'
    );
    expect(() => new RefreshSessionUseCase({ authService: mockAuthService })).toThrow(
      'profileRepository is required'
    );
  });

  it('throws 401 REFRESH_TOKEN_REQUIRED when refreshToken is missing', async () => {
    await expect(useCase.execute({})).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_REQUIRED',
      statusCode: 401,
      message: 'Refresh token is required',
    });
  });

  it('throws 401 INVALID_REFRESH_TOKEN when authService.refreshSession fails', async () => {
    mockAuthService.refreshSession.mockRejectedValue(new Error('Invalid token'));

    await expect(useCase.execute({ refreshToken: 'bad-token' })).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
      statusCode: 401,
      message: 'Invalid token',
    });
  });

  it('throws 404 NOT_FOUND when user profile is not found', async () => {
    mockAuthService.refreshSession.mockResolvedValue({
      userId: 'user-uuid-1',
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    mockProfileRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ refreshToken: 'valid-token' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      message: 'User profile not found',
    });
  });

  it('returns response and session tokens on successful refresh', async () => {
    mockAuthService.refreshSession.mockResolvedValue({
      userId: 'user-uuid-1',
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    mockProfileRepository.findById.mockResolvedValue(mockProfile);

    const result = await useCase.execute({ refreshToken: 'valid-token' });

    expect(result.response.data.user.id).toBe('user-uuid-1');
    expect(result.response.data.profile.username).toBe('buyer_test');
    expect(result.session).toEqual({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
  });
});
