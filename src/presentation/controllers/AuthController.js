import { RegisterRequestDTO } from '../../application/dtos/RegisterDTO.js';

export class AuthController {
  /**
   * @param {Object} dependencies
   * @param {import('../../application/use-cases/RegisterBuyerUseCase.js').RegisterBuyerUseCase} dependencies.registerBuyerUseCase
   */
  constructor({ registerBuyerUseCase }) {
    if (!registerBuyerUseCase) {
      throw new Error('registerBuyerUseCase is required');
    }
    this.registerBuyerUseCase = registerBuyerUseCase;
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

      const result = await this.registerBuyerUseCase.execute(requestDto);

      return res.status(201).json({
        message: 'Buyer registered successfully',
        user: result.user,
        session: result.session,
      });
    } catch (error) {
      return next(error);
    }
  }
}
