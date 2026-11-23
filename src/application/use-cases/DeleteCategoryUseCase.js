function createHttpError(statusCode, code, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export class DeleteCategoryUseCase {
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

  async execute({ categoryId } = {}) {
    const existing = await this.categoryRepository.findById(categoryId);
    if (!existing) {
      throw createHttpError(404, 'NOT_FOUND', 'Category not found');
    }

    const inUse = await this.categoryRepository.hasProducts(categoryId);
    if (inUse) {
      throw createHttpError(409, 'CATEGORY_IN_USE', 'Category in use');
    }

    await this.categoryRepository.delete(categoryId);
  }
}
