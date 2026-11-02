/**
 * Handles the OAuth token handoff from the frontend.
 *
 * Flow (per ADR-013 and OAuth-Flow.md):
 *   1. Verify the access token server-side via SupabaseAuthService.
 *   2. Load the profile and roles (created by the handle_new_user trigger).
 *   3. Return { user, profile, roles, accessToken, refreshToken } so the
 *      controller can set cookies.
 *
 * The trigger guarantees the profile exists before this use case runs
 * (handle_new_user fires on auth.users insert). If it does not, this is a
 * 500 (data integrity violation, not a user error).
 */
export class ExchangeOAuthTokenUseCase {
  constructor({ authService, profileRepository, userRoleRepository } = {}) {
    this.authService = authService;
    this.profileRepository = profileRepository;
    this.userRoleRepository = userRoleRepository;
  }

  async execute({ accessToken, refreshToken } = {}) {
    if (!accessToken || !refreshToken) {
      const err = new Error('access_token and refresh_token are required');
      err.status = 401;
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    const verified = await this.authService.exchangeOAuthToken(accessToken, refreshToken);
    if (!verified || !verified.user) {
      const err = new Error('Invalid or expired OAuth access token');
      err.status = 401;
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    const profile = await this.profileRepository.findById(verified.user.id);
    if (!profile) {
      const err = new Error('Profile not found for OAuth user (trigger did not fire)');
      err.status = 500;
      err.statusCode = 500;
      throw err;
    }

    const roles = this.userRoleRepository?.findByProfileId
      ? await this.userRoleRepository.findByProfileId(verified.user.id)
      : profile.roles || [];

    return {
      user: verified.user,
      profile,
      roles,
      accessToken: verified.accessToken,
      refreshToken: verified.refreshToken,
    };
  }
}
