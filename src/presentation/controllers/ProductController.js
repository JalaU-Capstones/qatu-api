import { ListProductsRequestDTO } from '../../application/dtos/ProductListDTO.js';

export class ProductController {
  /**
   * @param {Object} dependencies
   * @param {import('../../application/use-cases/ListProductsUseCase.js').ListProductsUseCase} dependencies.listProductsUseCase
   */
  constructor({ listProductsUseCase } = {}) {
    if (!listProductsUseCase) {
      throw new Error('listProductsUseCase is required');
    }
    this.listProductsUseCase = listProductsUseCase;
  }

  /**
   * Handles GET /v1/products
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async list(req, res, next) {
    try {
      const query = req.validatedQuery || req.query;
      const requestDto = new ListProductsRequestDTO(query);

      const result = await this.listProductsUseCase.execute(requestDto);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}
