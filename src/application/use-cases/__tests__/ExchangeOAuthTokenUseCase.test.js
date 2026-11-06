import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExchangeOAuthTokenUseCase } from '../ExchangeOAuthTokenUseCase.js';

describe('ExchangeOAuthTokenUseCase', () => {
  let authService;
  let profileRepository;
  let userRoleRepository;
  let useCase;

  beforeEach(() => {
    authService = { exchangeOAuthToken: vi.fn() };
    profileRepository = { findById: vi.fn() };
    userRoleRepository = { findByProfileId: vi.fn() };
    useCase = new ExchangeOAuthTokenUseCase({
      authService,
      profileRepository,
      userRoleRepository,
    });
  });

  it('returns user + profile + roles on valid tokens', async () => {
    const user = { id: 'u1', email: 'a@b.com' };
    const profile = { id: 'u1', username: 'a_xxxx' };
    const roles = [{ id: 1, name: 'buyer' }];
    authService.exchangeOAuthToken.mockResolvedValue({
      user,
      accessToken: 'at',
      refreshToken: 'rt',
    });
    profileRepository.findById.mockResolvedValue(profile);
    userRoleRepository.findByProfileId.mockResolvedValue(roles);

    const result = await useCase.execute({ accessToken: 'at', refreshToken: 'rt' });

    expect(authService.exchangeOAuthToken).toHaveBeenCalledWith('at', 'rt');
    expect(profileRepository.findById).toHaveBeenCalledWith('u1');
    expect(result).toEqual({
      user,
      profile,
      roles,
      accessToken: 'at',
      refreshToken: 'rt',
    });
  });

  it('throws 401 when access token is rejected by Supabase', async () => {
    const err = new Error('Invalid');
    err.status = 401;
    authService.exchangeOAuthToken.mockRejectedValue(err);

    await expect(useCase.execute({ accessToken: 'bad', refreshToken: 'rt' })).rejects.toMatchObject(
      { status: 401 }
    );
  });

  it('throws 401 when tokens are missing', async () => {
    await expect(useCase.execute({ accessToken: null, refreshToken: 'rt' })).rejects.toMatchObject({
      status: 401,
    });
    await expect(useCase.execute({ accessToken: 'at', refreshToken: null })).rejects.toMatchObject({
      status: 401,
    });
  });

  it('finds the profile on a retry (transaction visibility delay)', async () => {
    const profile = { id: 'u1', username: 'a_xxxx', roles: [] };
    authService.exchangeOAuthToken.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com' },
      accessToken: 'at',
      refreshToken: 'rt',
    });
    profileRepository.findById.mockResolvedValueOnce(null).mockResolvedValueOnce(profile);

    const result = await useCase.execute({ accessToken: 'at', refreshToken: 'rt' });

    expect(profileRepository.findById).toHaveBeenCalledTimes(2);
    expect(result.profile).toBe(profile);
  });

  it('creates the profile in-process as fallback when the trigger did not fire', async () => {
    const user = {
      id: 'u1',
      email: 'gabriel.sandoval@gmail.com',
      user_metadata: { name: 'Gabriel Sandoval', picture: 'https://pic' },
    };
    authService.exchangeOAuthToken.mockResolvedValue({
      user,
      accessToken: 'at',
      refreshToken: 'rt',
    });
    profileRepository.findById.mockResolvedValue(null);
    profileRepository.findByUsername = vi.fn().mockResolvedValue(null);
    profileRepository.create = vi.fn().mockImplementation(async (entity) => entity);

    const result = await useCase.execute({ accessToken: 'at', refreshToken: 'rt' });

    expect(profileRepository.create).toHaveBeenCalledTimes(1);
    const created = profileRepository.create.mock.calls[0][0];
    expect(created.id).toBe('u1');
    expect(created.username).toMatch(/^gabrielsandoval_[0-9a-f]{4}$/);
    expect(created.fullName).toBe('Gabriel Sandoval');
    expect(created.avatarPath).toBe('https://pic');
    expect(result.profile).toBe(created);
  });

  it('prefers metadata username and falls back to user_<uuid> when too short', async () => {
    const user = {
      id: '113a5c17-d1d4-4a11-bd3c-208bf569614b',
      email: 'a@b.com',
      user_metadata: {},
    };
    authService.exchangeOAuthToken.mockResolvedValue({
      user,
      accessToken: 'at',
      refreshToken: 'rt',
    });
    profileRepository.findById.mockResolvedValue(null);
    profileRepository.findByUsername = vi.fn();
    profileRepository.create = vi.fn().mockImplementation(async (entity) => entity);

    await useCase.execute({ accessToken: 'at', refreshToken: 'rt' });

    const created = profileRepository.create.mock.calls[0][0];
    expect(created.username).toBe('user_113a5c17d1');
  });

  it('throws 503 with a user-friendly message when profile recovery fails', async () => {
    authService.exchangeOAuthToken.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com' },
      accessToken: 'at',
      refreshToken: 'rt',
    });
    profileRepository.findById.mockResolvedValue(null);
    profileRepository.create = undefined;

    await expect(useCase.execute({ accessToken: 'at', refreshToken: 'rt' })).rejects.toMatchObject({
      status: 503,
      statusCode: 503,
      code: 'PROFILE_SETUP_IN_PROGRESS',
      message: 'Account created but profile setup is in progress. Please try again.',
    });
  });
});
