import path from 'node:path';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_IMAGES = 5;

const errors = {
  validationError: (msg) => {
    const err = new Error(msg);
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 400;
    return err;
  },
  notFoundError: () => {
    const err = new Error('Product not found');
    err.code = 'PRODUCT_NOT_FOUND';
    err.statusCode = 404;
    return err;
  },
  forbiddenError: () => {
    const err = new Error('You do not own this product');
    err.code = 'FORBIDDEN';
    err.statusCode = 403;
    return err;
  },
  imageLimitError: () => {
    const err = new Error(`A product can have at most ${MAX_IMAGES} images`);
    err.code = 'IMAGE_LIMIT_REACHED';
    err.statusCode = 422;
    return err;
  },
};

export class UploadProductImageUseCase {
  constructor({ productRepository, storageService } = {}) {
    if (!productRepository) throw new Error('productRepository is required');
    if (!storageService) throw new Error('storageService is required');
    this.productRepository = productRepository;
    this.storageService = storageService;
  }

  async execute({ productId, sellerId, file, altText = null, position = null } = {}) {
    if (!productId || !UUID_RE.test(productId)) {
      throw errors.validationError('productId must be a valid UUID');
    }
    if (!sellerId) {
      throw errors.validationError('sellerId is required');
    }
    if (!file || !file.buffer || !file.size) {
      throw errors.validationError('image file is required');
    }

    const product = await this.productRepository.findById(productId);
    if (!product) throw errors.notFoundError();
    if (product.seller_id !== sellerId) throw errors.forbiddenError();
    if (product.state === 'archived') {
      throw errors.validationError('Cannot upload images to an archived product');
    }

    const existingCount = await this.productRepository.countImages(productId);
    if (existingCount >= MAX_IMAGES) {
      throw errors.imageLimitError();
    }

    const extension = this.#extensionFromMime(file.mimeType, file.originalName);

    let upload;
    try {
      upload = await this.storageService.uploadProductImage({
        productId,
        buffer: file.buffer,
        mimeType: file.mimeType,
        extension,
        originalName: file.originalName,
        size: file.size,
      });
    } catch (error) {
      if (!(error instanceof Error)) {
        throw new Error(`Failed to upload product image for ${productId}`, { cause: error });
      }
      throw error;
    }

    const effectivePosition =
      position !== null && position !== undefined ? Number(position) : existingCount;
    const image = await this.productRepository.addImage({
      productId,
      path: upload.path,
      altText,
      position: effectivePosition,
    });

    await this.productRepository.setPrimaryImageIfNull({ productId, path: upload.path });

    return {
      data: image,
      meta: { timestamp: new Date().toISOString() },
      location: `/v1/products/${productId}/images/${image.id}`,
    };
  }

  #extensionFromMime(mimeType, originalName) {
    const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    // mimeType is validated by the storage service against the bucket
    // allowlist (JPEG/PNG/WebP); `map` is a locally-built object with
    // known string keys.
    // eslint-disable-next-line security/detect-object-injection
    const fromMime = map[mimeType];
    if (fromMime) return fromMime;
    const fromName = originalName ? path.extname(originalName).replace('.', '').toLowerCase() : '';
    if (['jpg', 'jpeg', 'png', 'webp'].includes(fromName)) return fromName;
    return 'jpg';
  }
}
