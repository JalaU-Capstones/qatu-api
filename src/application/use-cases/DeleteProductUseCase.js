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

export class DeleteProductUseCase {
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

    const deleted = await this.productRepository.softDelete({ productId, sellerId });
    if (!deleted) {
      throw notFoundError();
    }

    return {
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
