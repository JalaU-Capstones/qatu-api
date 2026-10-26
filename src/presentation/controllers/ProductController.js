import { GetProductDetailRequestDTO } from '../../application/dtos/ProductDetailDTO.js';
import { ListProductsRequestDTO } from '../../application/dtos/ProductListDTO.js';

export class ProductController {
  constructor({ listProductsUseCase, getProductByIdUseCase } = {}) {
    if (!listProductsUseCase) {
      throw new Error('listProductsUseCase is required');
    }
    this.listProductsUseCase = listProductsUseCase;
    this.getProductByIdUseCase = getProductByIdUseCase || null;
  }

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

  async getById(req, res, next) {
    try {
      if (!this.getProductByIdUseCase) {
        throw new Error('getProductByIdUseCase is required');
      }

      const params = req.validatedParams || req.params || {};
      const productId = params.id ?? params.productId;
      const currentUserId = req.user?.id || null;

      const requestDto = new GetProductDetailRequestDTO({ productId, currentUserId });
      const result = await this.getProductByIdUseCase.execute(requestDto);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}
