import { GetProductDetailRequestDTO } from '../../application/dtos/ProductDetailDTO.js';
import { ListProductsRequestDTO } from '../../application/dtos/ProductListDTO.js';

export class ProductController {
  constructor({ listProductsUseCase, listSellerProductsUseCase, getProductByIdUseCase } = {}) {
    if (!listProductsUseCase && !listSellerProductsUseCase) {
      throw new Error('at least one product use case is required');
    }
    this.listProductsUseCase = listProductsUseCase || null;
    this.listSellerProductsUseCase = listSellerProductsUseCase || null;
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

  async listSellerProducts(req, res, next) {
    try {
      if (!this.listSellerProductsUseCase) {
        const err = new Error('listSellerProductsUseCase is required');
        err.statusCode = 500;
        throw err;
      }

      const userId = req.user?.id;
      if (!userId) {
        const err = new Error('Authentication failed');
        err.code = 'UNAUTHORIZED';
        err.statusCode = 401;
        throw err;
      }

      // Role verified by requireSellerRole middleware; req.user.roles is a string[].
      const roleNames = Array.isArray(req.user?.roles) ? req.user.roles : [];
      if (!roleNames.includes('seller')) {
        const err = new Error('Seller role required');
        err.code = 'FORBIDDEN';
        err.statusCode = 403;
        throw err;
      }

      const query = req.validatedQuery || req.query || {};
      const result = await this.listSellerProductsUseCase.execute(userId, {
        page: query.page,
        limit: query.limit,
        status: query.status,
      });

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
