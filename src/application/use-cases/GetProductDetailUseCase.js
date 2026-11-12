import { ProductDetailDTO } from '../dtos/ProductDetailDTO.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class GetProductDetailUseCase {
  /**
   * @param {Object} dependencies
   * @param {import('../../domain/repositories/IProductRepository.js').IProductRepository} dependencies.productRepository
   */
  constructor({ productRepository } = {}) {
    if (!productRepository) {
      throw new Error('productRepository is required');
    }
    this.productRepository = productRepository;
  }

  /**
   * @param {import('../dtos/ProductDetailDTO.js').GetProductDetailRequestDTO} requestDto
   * @returns {Promise<{ data: Object, meta: { timestamp: string } }>}
   */
  async execute(requestDto) {
    const { productId, currentUserId } = requestDto;

    if (!productId || !UUID_REGEX.test(productId)) {
      throw this._createNotFoundError();
    }

    const product = await this.productRepository.findByIdWithDetails(productId);

    if (!product) {
      throw this._createNotFoundError();
    }

    if (product.state !== 'published') {
      const isOwner = currentUserId && String(currentUserId) === String(product.seller_id);
      if (!isOwner) {
        throw this._createNotFoundError();
      }
    }

    const detailDto = new ProductDetailDTO(product);

    return {
      data: detailDto.toJSON(),
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  _createNotFoundError() {
    const err = new Error('Product not found');
    err.code = 'PRODUCT_NOT_FOUND';
    err.statusCode = 404;
    return err;
  }
}
