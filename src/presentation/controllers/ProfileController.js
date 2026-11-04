import {
  GetProfileByIdRequestDTO,
  UpdateProfileRequestDTO,
} from '../../application/dtos/ProfileDTO.js';

export class ProfileController {
  /**
   * @param {Object} deps
   * @param {import('../../application/use-cases/GetProfileByIdUseCase.js').GetProfileByIdUseCase} deps.getProfileByIdUseCase
   * @param {import('../../application/use-cases/UpdateProfileUseCase.js').UpdateProfileUseCase} deps.updateProfileUseCase
   */
  constructor({ getProfileByIdUseCase, updateProfileUseCase } = {}) {
    if (!getProfileByIdUseCase) {
      throw new Error('getProfileByIdUseCase is required');
    }
    if (!updateProfileUseCase) {
      throw new Error('updateProfileUseCase is required');
    }
    this.getProfileByIdUseCase = getProfileByIdUseCase;
    this.updateProfileUseCase = updateProfileUseCase;
  }

  /**
   * Handles GET /v1/profiles/:id
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async getById(req, res, next) {
    try {
      const params = req.validatedParams || req.params || {};
      const requestDto = new GetProfileByIdRequestDTO({ profileId: params.id });
      const result = await this.getProfileByIdUseCase.execute(requestDto);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Handles PATCH /v1/profiles/me
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async updateMe(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        const err = new Error('Authentication failed');
        err.code = 'UNAUTHORIZED';
        err.statusCode = 401;
        throw err;
      }

      const body = req.validatedBody || req.body;
      const requestDto = new UpdateProfileRequestDTO({
        userId,
        updates: body,
      });

      const result = await this.updateProfileUseCase.execute(requestDto);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}
