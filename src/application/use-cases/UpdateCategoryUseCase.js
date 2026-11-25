import { CategoryListItemDTO } from '../dtos/CategoryListDTO.js';

function createHttpError(statusCode, code, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export class UpdateCategoryUseCase {
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

  async execute({ categoryId, name, slug, description, parent_id } = {}) {
    const existing = await this.categoryRepository.findById(categoryId);
    if (!existing) {
      throw createHttpError(404, 'NOT_FOUND', 'Category not found');
    }

    const updates = {};

    if (name !== undefined) {
      const trimmedName = typeof name === 'string' ? name.trim() : '';
      if (trimmedName.length < 2 || trimmedName.length > 80) {
        throw createHttpError(
          400,
          'VALIDATION_ERROR',
          'Category name must be between 2 and 80 characters.'
        );
      }
      const duplicateName = await this.categoryRepository.findByName(trimmedName);
      if (duplicateName && duplicateName.id !== categoryId) {
        throw createHttpError(409, 'CONFLICT', 'A category with this name already exists');
      }
      updates.name = trimmedName;
    }

    if (slug !== undefined) {
      const normalizedSlug = slug.trim().toLowerCase();
      const duplicateSlug = await this.categoryRepository.findBySlug(normalizedSlug);
      if (duplicateSlug && duplicateSlug.id !== categoryId) {
        throw createHttpError(409, 'CONFLICT', 'A category with this slug already exists');
      }
      updates.slug = normalizedSlug;
    }

    if (description !== undefined) {
      updates.description = description ? description.trim() : null;
    }

    if (parent_id !== undefined) {
      if (parent_id === categoryId) {
        throw createHttpError(422, 'UNPROCESSABLE_ENTITY', 'A category cannot be its own parent');
      }
      if (parent_id !== null) {
        const parent = await this.categoryRepository.findById(parent_id);
        if (!parent) {
          throw createHttpError(404, 'NOT_FOUND', 'Parent category not found');
        }
      }
      updates.parent_id = parent_id;
    }

    const updated = await this.categoryRepository.update(categoryId, updates);

    return {
      data: new CategoryListItemDTO(updated).toJSON(),
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
