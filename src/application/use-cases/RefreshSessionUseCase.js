import { LoginResponseDTO } from '../dtos/LoginDTO.js';

export class RefreshSessionUseCase {
  /**
   * @param {Object} dependencies
   * @param {import('../../infrastructure/auth/SupabaseAuthService.js').SupabaseAuthService} dependencies.authService
   * @param {import('../../domain/repositories/IProfileRepository.js').IProfileRepository} dependencies.profileRepository
   */
  constructor({ authService, profileRepository } = {}) {
    if (!authService) {
      throw new Error('authService is required');
    }
    if (!profileRepository) {
      throw new Error('profileRepository is required');
    }
    this.authService = authService;
    this.profileRepository = profileRepository;
  }

  /**
   * Refreshes a Supabase session using the refresh token, re-fetches profile, and returns DTO + new session tokens.
   *
   * @param {Object} params
   * @param {string} params.refreshToken
   * @returns {Promise<{ response: LoginResponseDTO, session: { accessToken: string, refreshToken: string } }>}
   */
  async execute({ refreshToken }) {
    if (!refreshToken) {
      const err = new Error('Refresh token is required');
      err.code = 'REFRESH_TOKEN_REQUIRED';
      err.statusCode = 401;
      throw err;
    }

    let authResult;
    try {
      authResult = await this.authService.refreshSession(refreshToken);
    } catch (error) {
      const err = new Error(error.message || 'Invalid or expired refresh token');
      err.code = 'INVALID_REFRESH_TOKEN';
      err.statusCode = 401;
      throw err;
    }

    const user = authResult.user || authResult.session?.user || { id: authResult.userId };
    const userId = user.id || authResult.userId;
    const profile = await this.profileRepository.findById(userId);
    if (!profile) {
      const err = new Error('User profile not found');
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const response = new LoginResponseDTO({
      user: {
        id: userId,
        email: user.email || profile.email,
        created_at:
          user.created_at ||
          (profile.createdAt
            ? new Date(profile.createdAt).toISOString()
            : new Date().toISOString()),
      },
      profile,
      roles: profile.roles || [],
    });

    return {
      response,
      session: {
        accessToken: authResult.accessToken || authResult.session?.access_token,
        refreshToken: authResult.refreshToken || authResult.session?.refresh_token,
      },
    };
  }
}
