import { slugify } from '../../domain/utils/slugify.js';
import { CreateProductRequestDTO } from '../dtos/CreateProductDTO.js';
import { ProductDetailDTO } from '../dtos/ProductDetailDTO.js';

const createValidationError = (message) => {
  const err = new Error(message);
  err.code = 'VALIDATION_ERROR';
  err.statusCode = 400;
  return err;
};

const createSlugAlreadyExistsError = () => {
  const err = new Error('Slug already exists');
  err.code = 'SLUG_ALREADY_EXISTS';
  err.statusCode = 409;
  return err;
};

const createInvalidCategoryError = () => {
  const err = new Error('Category does not exist');
  err.code = 'INVALID_CATEGORY';
  err.statusCode = 422;
  return err;
};

export class CreateProductUseCase {
  /**
   * @param {{ productRepository: import('../../domain/repositories/IProductRepository.js').IProductRepository }} deps
   */
  constructor({ productRepository } = {}) {
    if (!productRepository) {
      throw new Error('productRepository is required');
    }

    this.productRepository = productRepository;
  }

  async execute(dto) {
    const requestDto =
      dto instanceof CreateProductRequestDTO ? dto : new CreateProductRequestDTO(dto ?? {});

    if (!requestDto.sellerId) {
      throw createValidationError('sellerId is required');
    }

    const clientProvidedSlug =
      typeof requestDto.slug === 'string' && requestDto.slug.trim() !== ''
        ? requestDto.slug.trim()
        : null;

    const candidates = clientProvidedSlug
      ? [clientProvidedSlug]
      : this._buildSlugCandidates(requestDto.name);

    let lastError;
    for (let index = 0; index < candidates.length; index += 1) {
      // Index comes from a for-loop over a locally-built array; not user-controlled.
      // eslint-disable-next-line security/detect-object-injection
      const candidate = candidates[index];

      try {
        const row = await this.productRepository.create({
          sellerId: requestDto.sellerId,
          categoryId: requestDto.categoryId,
          name: requestDto.name,
          slug: candidate,
          description: requestDto.description ?? null,
          price: Number(requestDto.price),
          currency: requestDto.currency || 'USD',
          stock: Number(requestDto.stock ?? 0),
          attributes: requestDto.attributes ?? {},
        });

        return {
          data: new ProductDetailDTO(row).toJSON(),
          meta: { timestamp: new Date().toISOString() },
        };
      } catch (error) {
        lastError = error;

        if (this._isPostgresUniqueViolation(error)) {
          if (clientProvidedSlug || this._isSlugUniqueViolation(error)) {
            if (clientProvidedSlug || index === candidates.length - 1) {
              throw createSlugAlreadyExistsError();
            }
            continue;
          }
        }

        if (this._isPostgresForeignKeyViolation(error)) {
          throw createInvalidCategoryError();
        }

        throw error;
      }
    }

    if (lastError) {
      throw createSlugAlreadyExistsError();
    }

    throw lastError ?? new Error('Product creation failed');
  }

  _buildSlugCandidates(name) {
    const base = slugify(name);
    const candidates = [base];

    for (let suffix = 2; suffix <= 5; suffix += 1) {
      candidates.push(`${base}-${suffix}`);
    }

    return candidates;
  }

  _isPostgresUniqueViolation(error) {
    return (
      error?.parent?.code === '23505' ||
      error?.original?.code === '23505' ||
      error?.code === '23505' ||
      error?.name === 'SequelizeUniqueConstraintError'
    );
  }

  _isPostgresForeignKeyViolation(error) {
    return (
      error?.parent?.code === '23503' ||
      error?.original?.code === '23503' ||
      error?.code === '23503' ||
      error?.name === 'SequelizeForeignKeyConstraintError'
    );
  }

  _isSlugUniqueViolation(error) {
    const text = [
      error?.message,
      error?.parent?.constraint,
      error?.constraint,
      error?.original?.constraint,
    ]
      .filter(Boolean)
      .join(' ');

    return /slug/i.test(text) || /products_seller_id_slug_key/i.test(text);
  }
}
