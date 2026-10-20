/**
 * @interface IProductRepository
 */
export class IProductRepository {
  /**
   * @param {Object} params
   * @param {number} params.page
   * @param {number} params.limit
   * @param {Object} [params.filters]
   * @param {string} [params.filters.search]
   * @param {string} [params.filters.categoryId]
   * @param {number} [params.filters.minPrice]
   * @param {number} [params.filters.maxPrice]
   * @param {string} [params.filters.sellerId]
   * @param {Object} [params.sort]
   * @param {string} [params.sort.field]
   * @param {'asc'|'desc'} [params.sort.order]
   * @returns {Promise<{ items: import('../entities/Product.js').Product[], total: number }>}
   */
  async findAll({ page, limit, filters, sort }) {
    throw new Error(
      `Method not implemented with ${JSON.stringify({ page, limit, filters, sort })}`
    );
  }
}
