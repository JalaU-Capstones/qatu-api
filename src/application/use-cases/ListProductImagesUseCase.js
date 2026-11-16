import { ProductImageDTO } from '../dtos/ProductImageDTO.js';

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

export class ListProductImagesUseCase {
  constructor({ productRepository } = {}) {
    if (!productRepository) throw new Error('productRepository is required');
    this.productRepository = productRepository;
  }

  async execute({ productId } = {}) {
    if (!productId || typeof productId !== 'string') {
      throw validationError('productId is required');
    }
    if (!UUID_RE.test(productId)) {
      throw validationError('productId must be a valid UUID');
    }

    const product = await this.productRepository.findById(productId);
    if (!product) throw notFoundError();

    const images = await this.productRepository.listImages(productId);

    return {
      data: images.map((img) => new ProductImageDTO(img).toJSON()),
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
