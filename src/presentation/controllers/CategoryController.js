import { ListCategoriesRequestDTO } from '../../application/dtos/CategoryListDTO.js';

export class CategoryController {
  /**
   * @param {Object} dependencies
   * @param {import('../../application/use-cases/ListCategoriesUseCase.js').ListCategoriesUseCase} dependencies.listCategoriesUseCase
   */
  constructor({ listCategoriesUseCase } = {}) {
    if (!listCategoriesUseCase) {
      throw new Error('listCategoriesUseCase is required');
    }
    this.listCategoriesUseCase = listCategoriesUseCase;
  }

  /**
   * Handles GET /v1/categories
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async list(req, res, next) {
    try {
      const query = req.validatedQuery || req.query;
      const requestDto = new ListCategoriesRequestDTO(query);

      const result = await this.listCategoriesUseCase.execute(requestDto);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}
