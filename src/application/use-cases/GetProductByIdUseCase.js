import { ProductListItemDTO } from '../dtos/ProductListDTO.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class GetProductByIdUseCase {
  /**
   * @param {Object} [dependencies]
   * @param {import('../../domain/repositories/IProductRepository.js').IProductRepository} dependencies.productRepository
   */
  constructor({ productRepository } = {}) {
    if (!productRepository) {
      throw new Error('productRepository is required');
    }
    this.productRepository = productRepository;
  }

  /**
   * Retrieves a single published product by its UUID.
   * Throws 404 PRODUCT_NOT_FOUND if the ID is not a valid UUID, does not exist,
   * or the product is not in 'published' state.
   *
   * @param {string | { id?: string, productId?: string }} input
   * @returns {Promise<{ data: Object, meta: { timestamp: string } }>}
   */
  async execute(input) {
    const rawId = typeof input === 'string' ? input : (input?.id ?? input?.productId ?? '');
    const productId = typeof rawId === 'string' ? rawId.trim() : '';

    if (!productId || !UUID_REGEX.test(productId)) {
      throw this._createNotFoundError();
    }

    const product = await this.productRepository.findById(productId);

    if (!product || product.state !== 'published') {
      throw this._createNotFoundError();
    }

    return {
      data: new ProductListItemDTO(product).toJSON(),
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * @returns {Error & { code: string, statusCode: number }}
   * @private
   */
  _createNotFoundError() {
    const err = new Error('Product not found');
    err.code = 'PRODUCT_NOT_FOUND';
    err.statusCode = 404;
    return err;
  }
}
