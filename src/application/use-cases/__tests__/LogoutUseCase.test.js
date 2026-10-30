import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogoutUseCase } from '../LogoutUseCase.js';

describe('LogoutUseCase', () => {
  let mockAuthService;
  let useCase;

  beforeEach(() => {
    mockAuthService = {
      logoutUser: vi.fn(),
    };
    useCase = new LogoutUseCase({ authService: mockAuthService });
  });

  it('throws error when authService is missing in constructor', () => {
    expect(() => new LogoutUseCase()).toThrow('authService is required');
  });

  it('calls authService.logoutUser with provided tokens and returns success', async () => {
    mockAuthService.logoutUser.mockResolvedValue({ success: true });

    const result = await useCase.execute({
      accessToken: 'acc-token',
      refreshToken: 'ref-token',
    });

    expect(mockAuthService.logoutUser).toHaveBeenCalledWith({
      accessToken: 'acc-token',
      refreshToken: 'ref-token',
    });
    expect(result).toEqual({ success: true });
  });

  it('works with empty arguments', async () => {
    mockAuthService.logoutUser.mockResolvedValue({ success: true });

    const result = await useCase.execute();

    expect(mockAuthService.logoutUser).toHaveBeenCalledWith({
      accessToken: undefined,
      refreshToken: undefined,
    });
    expect(result).toEqual({ success: true });
  });
});
