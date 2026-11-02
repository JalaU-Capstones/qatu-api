import { setSessionCookies } from '../../infrastructure/auth/cookieHelper.js';
import { generateCsrfToken } from '../../infrastructure/auth/csrfHelper.js';

export class OAuthController {
  constructor({ exchangeOAuthTokenUseCase } = {}) {
    this.exchangeOAuthTokenUseCase = exchangeOAuthTokenUseCase;
  }

  async exchange(req, res, next) {
    try {
      const { access_token, refresh_token } = req.validatedBody || req.body || {};

      const result = await this.exchangeOAuthTokenUseCase.execute({
        accessToken: access_token,
        refreshToken: refresh_token,
      });

      // Same cookies as /auth/login (per ADR-012)
      const csrfToken = generateCsrfToken();
      setSessionCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        csrfToken,
      });

      return res.status(200).json({
        data: {
          user: result.user,
          profile: result.profile,
          roles: result.roles,
        },
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      return next(err);
    }
  }
}
