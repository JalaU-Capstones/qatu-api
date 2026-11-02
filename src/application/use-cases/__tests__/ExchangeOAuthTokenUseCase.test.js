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

  it('throws 500 when the trigger did not create a profile', async () => {
    authService.exchangeOAuthToken.mockResolvedValue({
      user: { id: 'u1' },
      accessToken: 'at',
      refreshToken: 'rt',
    });
    profileRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ accessToken: 'at', refreshToken: 'rt' })).rejects.toMatchObject({
      status: 500,
    });
  });
});
