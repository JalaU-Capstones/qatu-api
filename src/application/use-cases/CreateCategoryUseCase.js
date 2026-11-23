import { slugify } from '../../domain/utils/slugify.js';
import { CategoryListItemDTO } from '../dtos/CategoryListDTO.js';

function createHttpError(statusCode, code, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export class CreateCategoryUseCase {
  /**
   * @param {Object} dependencies
   * @param {import('../../domain/repositories/ICategoryRepository.js').ICategoryRepository} dependencies.categoryRepository
   */
  constructor({ categoryRepository } = {}) {
    if (!categoryRepository) {
      throw new Error('categoryRepository is required');
    }
    this.categoryRepository = categoryRepository;
  }

  async execute({ name, slug, description = null, parent_id = null } = {}) {
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      throw createHttpError(
        400,
        'VALIDATION_ERROR',
        'Category name must be between 2 and 80 characters.'
      );
    }

    const existingByName = await this.categoryRepository.findByName(trimmedName);
    if (existingByName) {
      throw createHttpError(409, 'CONFLICT', 'A category with this name already exists');
    }

    let resolvedSlug;
    if (slug) {
      resolvedSlug = slug.trim().toLowerCase();
      const existingBySlug = await this.categoryRepository.findBySlug(resolvedSlug);
      if (existingBySlug) {
        throw createHttpError(409, 'CONFLICT', 'A category with this slug already exists');
      }
    } else {
      let baseSlug = slugify(trimmedName);
      if (baseSlug.length < 2) {
        baseSlug = `${baseSlug}-cat`;
      }
      resolvedSlug = baseSlug;
      let suffix = 2;
      while (await this.categoryRepository.findBySlug(resolvedSlug)) {
        const suffixStr = `-${suffix}`;
        resolvedSlug = `${baseSlug.slice(0, 100 - suffixStr.length)}${suffixStr}`;
        suffix += 1;
      }
    }

    if (parent_id) {
      const parent = await this.categoryRepository.findById(parent_id);
      if (!parent) {
        throw createHttpError(404, 'NOT_FOUND', 'Parent category not found');
      }
    }

    const created = await this.categoryRepository.create({
      name: trimmedName,
      slug: resolvedSlug,
      description: description ? description.trim() : null,
      parent_id: parent_id || null,
    });

    return {
      data: new CategoryListItemDTO(created).toJSON(),
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
