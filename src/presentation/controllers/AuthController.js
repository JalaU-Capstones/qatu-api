import { LoginRequestDTO } from '../../application/dtos/LoginDTO.js';
import { RegisterRequestDTO } from '../../application/dtos/RegisterDTO.js';
import { setSessionCookies } from '../../infrastructure/auth/cookieHelper.js';
import { generateCsrfToken } from '../../infrastructure/auth/csrfHelper.js';

export class AuthController {
  /**
   * @param {Object} dependencies
   * @param {import('../../application/use-cases/RegisterBuyerUseCase.js').RegisterBuyerUseCase} dependencies.registerBuyerUseCase
   * @param {import('../../application/use-cases/LoginUseCase.js').LoginUseCase} [dependencies.loginUseCase]
   */
  constructor({ registerBuyerUseCase, loginUseCase } = {}) {
    if (!registerBuyerUseCase) {
      throw new Error('registerBuyerUseCase is required');
    }
    this.registerBuyerUseCase = registerBuyerUseCase;
    this.loginUseCase = loginUseCase;
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
}
