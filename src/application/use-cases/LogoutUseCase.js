export class LogoutUseCase {
  /**
   * @param {Object} dependencies
   * @param {import('../../infrastructure/auth/SupabaseAuthService.js').SupabaseAuthService} dependencies.authService
   */
  constructor({ authService } = {}) {
    if (!authService) {
      throw new Error('authService is required');
    }
    this.authService = authService;
  }

  /**
   * Logs out user from Supabase if tokens are available, always succeeding.
   *
   * @param {Object} [params]
   * @param {string} [params.accessToken]
   * @param {string} [params.refreshToken]
   * @returns {Promise<{ success: true }>}
   */
  async execute({ accessToken, refreshToken } = {}) {
    await this.authService.logoutUser({ accessToken, refreshToken });
    return { success: true };
  }
}
