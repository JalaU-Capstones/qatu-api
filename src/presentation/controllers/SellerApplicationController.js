import { ApplyAsSellerRequestDTO } from '../../application/dtos/SellerApplicationDTO.js';

export class SellerApplicationController {
  constructor({ applyAsSellerUseCase, getMySellerApplicationUseCase } = {}) {
    if (!applyAsSellerUseCase) {
      throw new Error('applyAsSellerUseCase is required');
    }
    if (!getMySellerApplicationUseCase) {
      throw new Error('getMySellerApplicationUseCase is required');
    }
    this.applyAsSellerUseCase = applyAsSellerUseCase;
    this.getMySellerApplicationUseCase = getMySellerApplicationUseCase;
  }

  async apply(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        const err = new Error('Authentication failed');
        err.code = 'UNAUTHORIZED';
        err.statusCode = 401;
        throw err;
      }

      const body = req.validatedBody || req.body;
      const dto = new ApplyAsSellerRequestDTO({
        profileId: userId,
        business_name: body.business_name,
        business_description: body.business_description,
        contact_phone:
          body.country_code && body.phone_number
            ? `${body.country_code}${body.phone_number}`
            : body.contact_phone || null,
        contact_email: body.contact_email || null,
      });

      const result = await this.applyAsSellerUseCase.execute(dto);
      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getMe(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        const err = new Error('Authentication failed');
        err.code = 'UNAUTHORIZED';
        err.statusCode = 401;
        throw err;
      }

      const result = await this.getMySellerApplicationUseCase.execute({ profileId: userId });
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}
