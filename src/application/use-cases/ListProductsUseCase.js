import { ProductListItemDTO } from '../dtos/ProductListDTO.js';

export class ListProductsUseCase {
  /**
   * @param {Object} [dependencies]
   * @param {import('../../domain/repositories/IProductRepository.js').IProductRepository} dependencies.productRepository
   */
  constructor({ productRepository } = {}) {
    if (!productRepository) {
      throw new Error('productRepository is required');
    }
    this.productRepository = productRepository;
  }

  /**
   * @param {import('../dtos/ProductListDTO.js').ListProductsRequestDTO} requestDto
   * @returns {Promise<{ data: Object[], meta: { page: number, per_page: number, total: number, total_pages: number } }>}
   */
  async execute(requestDto) {
    const params = requestDto.toRepositoryParams();
    const { items, total } = await this.productRepository.findAll(params);
    const totalPages = total === 0 ? 0 : Math.ceil(total / params.limit);

    return {
      data: items.map((item) => new ProductListItemDTO(item).toJSON()),
      meta: {
        page: params.page,
        per_page: params.limit,
        total,
        total_pages: totalPages,
      },
    };
  }
}
