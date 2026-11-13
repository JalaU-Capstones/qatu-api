import { ProductDetailDTO } from '../dtos/ProductDetailDTO.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validationError = (message) => {
  const err = new Error(message);
  err.code = 'VALIDATION_ERROR';
  err.statusCode = 400;
  return err;
};

const notFoundError = () => {
  const err = new Error('Product not found');
  err.code = 'PRODUCT_NOT_FOUND';
  err.statusCode = 404;
  return err;
};

const forbiddenError = () => {
  const err = new Error('You do not own this product');
  err.code = 'FORBIDDEN';
  err.statusCode = 403;
  return err;
};

const invalidStateError = (currentState) => {
  const err = new Error(`Cannot publish a product in state '${currentState}'`);
  err.code = 'INVALID_STATE_TRANSITION';
  err.statusCode = 409;
  return err;
};

export class PublishProductUseCase {
  constructor({ productRepository } = {}) {
    if (!productRepository) throw new Error('productRepository is required');
    this.productRepository = productRepository;
  }

  async execute({ productId, sellerId } = {}) {
    if (!productId || typeof productId !== 'string') {
      throw validationError('productId is required');
    }
    if (!UUID_RE.test(productId)) {
      throw validationError('productId must be a valid UUID');
    }
    if (!sellerId || typeof sellerId !== 'string') {
      throw validationError('sellerId is required');
    }

    const product = await this.productRepository.findById(productId);
    if (!product) throw notFoundError();

    if (product.seller_id !== sellerId) throw forbiddenError();

    if (product.state !== 'draft') throw invalidStateError(product.state);

    if (!product.primary_image_path) {
      const err = new Error('A product must have at least one image before being published');
      err.code = 'IMAGE_REQUIRED';
      err.statusCode = 422;
      throw err;
    }

    const updated = await this.productRepository.publish({ productId, sellerId });
    if (!updated) {
      throw invalidStateError('published');
    }

    return {
      data: new ProductDetailDTO(updated).toJSON(),
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
