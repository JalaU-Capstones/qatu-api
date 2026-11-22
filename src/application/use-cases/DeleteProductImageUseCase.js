const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validationError = (message) => {
  const err = new Error(message);
  err.code = 'VALIDATION_ERROR';
  err.statusCode = 400;
  return err;
};

const notFoundError = (message = 'Product image not found') => {
  const err = new Error(message);
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

const invalidStateError = (message) => {
  const err = new Error(message);
  err.code = 'INVALID_STATE_TRANSITION';
  err.statusCode = 409;
  return err;
};

const unauthorizedError = (message = 'Session token not available for storage upload') => {
  const err = new Error(message);
  err.code = 'UNAUTHORIZED';
  err.statusCode = 401;
  return err;
};

export class DeleteProductImageUseCase {
  constructor({ productRepository, storageService } = {}) {
    if (!productRepository) throw new Error('productRepository is required');
    if (!storageService) throw new Error('storageService is required');
    this.productRepository = productRepository;
    this.storageService = storageService;
  }

  async execute({ productId, imageId, sellerId, accessToken } = {}) {
    if (!productId || typeof productId !== 'string') {
      throw validationError('productId is required');
    }
    if (!UUID_RE.test(productId)) {
      throw validationError('productId must be a valid UUID');
    }
    if (!imageId || typeof imageId !== 'string') {
      throw validationError('imageId is required');
    }
    if (!UUID_RE.test(imageId)) {
      throw validationError('imageId must be a valid UUID');
    }
    if (!sellerId || typeof sellerId !== 'string') {
      throw validationError('sellerId is required');
    }
    if (!accessToken || typeof accessToken !== 'string') {
      throw unauthorizedError('Session token not available for storage upload');
    }

    const product = await this.productRepository.findById(productId);
    if (!product) throw notFoundError('Product not found');

    if (product.seller_id !== sellerId) throw forbiddenError();

    const image = await this.productRepository.findImageById(imageId);
    if (!image) throw notFoundError('Product image not found');

    if (image.product_id !== productId) {
      throw notFoundError('Product image not found');
    }

    if (product.state === 'published') {
      const count = await this.productRepository.countImages(productId);
      if (count === 1) {
        throw invalidStateError(
          'Cannot delete the last image of a published product. Unpublish it first.'
        );
      }
    }

    const deleted = await this.productRepository.deleteImage(imageId);
    if (!deleted) {
      throw notFoundError('Product image not found');
    }

    try {
      await this.productRepository.recomputePrimaryImage(productId);
    } catch (recomputeError) {
      // eslint-disable-next-line no-console
      console.error('[deleteProductImage] recomputePrimaryImage failed:', recomputeError);
    }

    try {
      const result = await this.storageService.deleteProductImage(accessToken, image.path);
      if (result && result.deleted === false) {
        // eslint-disable-next-line no-console
        console.error('[deleteProductImage] storage delete failed:', result.error);
      }
    } catch (storageError) {
      // eslint-disable-next-line no-console
      console.error('[deleteProductImage] storage delete threw:', storageError);
    }

    return {
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
