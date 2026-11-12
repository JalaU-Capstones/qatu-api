import { CategoryListItemDTO } from '../dtos/CategoryListDTO.js';

export class ListCategoriesUseCase {
  /**
   * @param {Object} [dependencies]
   * @param {import('../../domain/repositories/ICategoryRepository.js').ICategoryRepository} dependencies.categoryRepository
   */
  constructor({ categoryRepository } = {}) {
    if (!categoryRepository) {
      throw new Error('categoryRepository is required');
    }
    this.categoryRepository = categoryRepository;
  }

  /**
   * @param {import('../dtos/CategoryListDTO.js').ListCategoriesRequestDTO} requestDto
   * @returns {Promise<{ data: Object[], meta: { page: number, per_page: number, total: number, total_pages: number } }>}
   */
  async execute(requestDto) {
    const params = requestDto.toRepositoryParams();
    const { items, total } = await this.categoryRepository.findAll(params);
    const totalPages = total === 0 ? 0 : Math.ceil(total / params.limit);

    return {
      data: items.map((item) => new CategoryListItemDTO(item).toJSON()),
      meta: {
        page: params.page,
        per_page: params.limit,
        total,
        total_pages: totalPages,
      },
    };
  }
}
