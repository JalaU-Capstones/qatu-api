import { ProductDetailDTO } from '../dtos/ProductDetailDTO.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_FIELDS = [
  'name',
  'description',
  'price',
  'stock',
  'currency',
  'category_id',
  'attributes',
];

const FORBIDDEN_FIELDS = [
  'slug',
  'state',
  'id',
  'seller_id',
  'published_at',
  'deleted_at',
  'created_at',
  'updated_at',
];

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
  const err = new Error(`Cannot edit a product in state '${currentState}'`);
  err.code = 'INVALID_STATE_TRANSITION';
  err.statusCode = 409;
  return err;
};

const invalidCategoryError = () => {
  const err = new Error('Category does not exist');
  err.code = 'INVALID_CATEGORY';
  err.statusCode = 422;
  return err;
};

export class UpdateProductUseCase {
  constructor({ productRepository } = {}) {
    if (!productRepository) throw new Error('productRepository is required');
    this.productRepository = productRepository;
  }

  async execute({ productId, sellerId, fields } = {}) {
    if (!productId || typeof productId !== 'string') {
      throw validationError('productId is required');
    }
    if (!UUID_RE.test(productId)) {
      throw validationError('productId must be a valid UUID');
    }
    if (!sellerId || typeof sellerId !== 'string') {
      throw validationError('sellerId is required');
    }

    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      throw validationError('At least one field is required');
    }

    for (const key of FORBIDDEN_FIELDS) {
      if (key in fields) {
        throw validationError(`Cannot edit field: ${key}`);
      }
    }

    const hasAllowedField = ALLOWED_FIELDS.some((key) => key in fields);
    if (!hasAllowedField) {
      throw validationError('At least one field is required');
    }

    const product = await this.productRepository.findById(productId);
    if (!product) throw notFoundError();

    if (product.seller_id !== sellerId) throw forbiddenError();

    if (product.state === 'archived') throw invalidStateError('archived');

    if (
      product.state === 'published' &&
      fields.currency !== undefined &&
      fields.currency !== product.currency
    ) {
      const err = new Error('Cannot change currency on a published product. Unpublish it first.');
      err.code = 'CANNOT_CHANGE_CURRENCY_ON_PUBLISHED';
      err.statusCode = 409;
      throw err;
    }

    let updated;
    try {
      updated = await this.productRepository.update({ productId, sellerId, fields });
    } catch (error) {
      if (this._isPostgresForeignKeyViolation(error)) {
        throw invalidCategoryError();
      }
      throw error;
    }

    if (!updated) {
      throw notFoundError();
    }

    const detailed = await this.productRepository.findByIdWithDetails(productId);

    return {
      data: new ProductDetailDTO(detailed ?? updated).toJSON(),
      meta: { timestamp: new Date().toISOString() },
    };
  }

  _isPostgresForeignKeyViolation(error) {
    return (
      error?.parent?.code === '23503' ||
      error?.original?.code === '23503' ||
      error?.code === '23503' ||
      error?.name === 'SequelizeForeignKeyConstraintError'
    );
  }
}
