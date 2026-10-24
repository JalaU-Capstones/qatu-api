import { ListProductsRequestDTO } from '../../application/dtos/ProductListDTO.js';

export class ProductController {
  /**
   * @param {Object} dependencies
   * @param {import('../../application/use-cases/ListProductsUseCase.js').ListProductsUseCase} dependencies.listProductsUseCase
   * @param {import('../../application/use-cases/GetProductByIdUseCase.js').GetProductByIdUseCase} [dependencies.getProductByIdUseCase]
   */
  constructor({ listProductsUseCase, getProductByIdUseCase } = {}) {
    if (!listProductsUseCase) {
      throw new Error('listProductsUseCase is required');
    }
    this.listProductsUseCase = listProductsUseCase;
    this.getProductByIdUseCase = getProductByIdUseCase || null;
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

  /**
   * Handles GET /v1/products/:id
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async getById(req, res, next) {
    try {
      if (!this.getProductByIdUseCase) {
        throw new Error('getProductByIdUseCase is required');
      }

      const params = req.validatedParams || req.params;
      const productId = params.id ?? params.productId;

      const result = await this.getProductByIdUseCase.execute(productId);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}
