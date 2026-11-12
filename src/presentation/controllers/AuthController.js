import { LoginRequestDTO } from '../../application/dtos/LoginDTO.js';
import { RegisterRequestDTO } from '../../application/dtos/RegisterDTO.js';
import { clearSessionCookies, setSessionCookies } from '../../infrastructure/auth/cookieHelper.js';
import { generateCsrfToken } from '../../infrastructure/auth/csrfHelper.js';

export class AuthController {
  /**
   * @param {Object} dependencies
   * @param {import('../../application/use-cases/RegisterBuyerUseCase.js').RegisterBuyerUseCase} dependencies.registerBuyerUseCase
   * @param {import('../../application/use-cases/LoginUseCase.js').LoginUseCase} [dependencies.loginUseCase]
   * @param {import('../../application/use-cases/GetCurrentUserUseCase.js').GetCurrentUserUseCase} [dependencies.getCurrentUserUseCase]
   * @param {import('../../application/use-cases/RefreshSessionUseCase.js').RefreshSessionUseCase} [dependencies.refreshSessionUseCase]
   * @param {import('../../application/use-cases/LogoutUseCase.js').LogoutUseCase} [dependencies.logoutUseCase]
   */
  constructor({
    registerBuyerUseCase,
    loginUseCase,
    getCurrentUserUseCase,
    refreshSessionUseCase,
    logoutUseCase,
  } = {}) {
    if (!registerBuyerUseCase) {
      throw new Error('registerBuyerUseCase is required');
    }
    this.registerBuyerUseCase = registerBuyerUseCase;
    this.loginUseCase = loginUseCase;
    this.getCurrentUserUseCase = getCurrentUserUseCase;
    this.refreshSessionUseCase = refreshSessionUseCase;
    this.logoutUseCase = logoutUseCase;
  }

  /**
   * Handles POST /v1/auth/register
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async register(req, res, next) {
    try {
      const payload = req.validatedBody || req.body;
      const requestDto = new RegisterRequestDTO(payload);

      const { response, session } = await this.registerBuyerUseCase.execute(requestDto);

      const csrfToken = generateCsrfToken();
      setSessionCookies(res, {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        csrfToken,
      });

      return res.status(201).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Handles POST /v1/auth/login
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async login(req, res, next) {
    try {
      if (!this.loginUseCase) {
        throw new Error('loginUseCase is not configured');
      }

      const payload = req.validatedBody || req.body;
      const requestDto = new LoginRequestDTO(payload);

      const { response, session } = await this.loginUseCase.execute(requestDto);

      const csrfToken = generateCsrfToken();
      setSessionCookies(res, {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        csrfToken,
      });

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Handles GET /v1/auth/me
   * Requires authMiddleware (req.user populated).
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async me(req, res, next) {
    try {
      if (!this.getCurrentUserUseCase) {
        throw new Error('getCurrentUserUseCase is not configured');
      }

      const userId = req.user?.id;
      const email = req.user?.email;

      const response = await this.getCurrentUserUseCase.execute({ userId, email });

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Handles POST /v1/auth/refresh
   * Reads refresh token from cookie or JSON body. Rotates tokens.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async refresh(req, res, next) {
    try {
      if (!this.refreshSessionUseCase) {
        throw new Error('refreshSessionUseCase is not configured');
      }

      const refreshToken = req.cookies?.refresh_token || null;
      if (!refreshToken) {
        const err = new Error('Refresh token is required');
        err.code = 'UNAUTHORIZED';
        err.statusCode = 401;
        throw err;
      }

      const { response, session } = await this.refreshSessionUseCase.execute({
        refreshToken,
      });

      const csrfToken = generateCsrfToken();
      setSessionCookies(res, {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        csrfToken,
      });

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Handles POST /v1/auth/logout
   * Clears cookies and attempts Supabase signOut. Always returns 204 No Content.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async logout(req, res, next) {
    try {
      const accessToken = req.cookies?.access_token;
      const refreshToken = req.cookies?.refresh_token;

      if (this.logoutUseCase) {
        try {
          await this.logoutUseCase.execute({ accessToken, refreshToken });
        } catch {
          // Fire-and-forget per ADR-012 decision A3: cookie clearing MUST succeed
        }
      }

      clearSessionCookies(res);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }
}
