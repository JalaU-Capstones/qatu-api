/**
 * @interface IProductRepository
 */
export class IProductRepository {
  /**
   * Find a single, non-deleted product by its UUID.
   * Does NOT filter by `state` — the caller decides whether unpublished products are acceptable
   * (e.g. `AddToCartUseCase` returns 404 for unknown, 422 for "exists but not published").
   *
   * @param {string} productId
   * @returns {Promise<import('../entities/Product.js').Product | null>}
   */
  // eslint-disable-next-line no-unused-vars
  async findById(productId) {
    throw new Error('Method not implemented: findById');
  }

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

  /**
   * Find a single, non-deleted product with full relational details.
   *
   * @param {string} productId
   * @returns {Promise<Object|null>}
   */
  // eslint-disable-next-line no-unused-vars
  async findByIdWithDetails(productId) {
    throw new Error('Method not implemented: findByIdWithDetails');
  }
}
