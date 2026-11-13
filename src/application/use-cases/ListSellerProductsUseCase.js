import { ProductListItemDTO } from '../dtos/ProductListDTO.js';

export class ListSellerProductsUseCase {
  /**
   * @param {{ productRepository: import('../../domain/repositories/IProductRepository.js').IProductRepository }} deps
   */
  constructor({ productRepository } = {}) {
    if (!productRepository) {
      throw new Error('productRepository is required');
    }
    this.productRepository = productRepository;
  }

  /**
   * @param {string} sellerId
   * @param {{ page?: number, limit?: number, status?: 'draft'|'published' }} [options]
   * @returns {Promise<{ data: Object[], meta: { page: number, per_page: number, total: number, total_pages: number } }>}
   */
  async execute(sellerId, { page = 1, limit = 20, status } = {}) {
    if (!sellerId) {
      const err = new Error('sellerId is required');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    const safePage = Number.isFinite(Number(page)) && Number(page) >= 1 ? Number(page) : 1;
    const requestedLimit = Number.isFinite(Number(limit)) ? Number(limit) : 20;
    const safeLimit = Math.min(100, Math.max(1, requestedLimit));

    const { items, total } = await this.productRepository.listBySeller(sellerId, {
      page: safePage,
      limit: safeLimit,
      status,
    });

    const totalPages = total === 0 ? 0 : Math.ceil(total / safeLimit);

    return {
      data: items.map((item) => new ProductListItemDTO(item).toJSON()),
      meta: {
        page: safePage,
        per_page: safeLimit,
        total,
        total_pages: totalPages,
      },
    };
  }
}
