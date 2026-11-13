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
   * Paginated list of products owned by a seller, optionally filtered by state.
   * @param {string} sellerId
   * @param {{ page?: number, limit?: number, status?: 'draft'|'published' }} options
   * @returns {Promise<{ items: Object[], total: number, page: number, limit: number }>}
   */
  async listBySeller(sellerId, options = {}) {
    throw new Error(`Method not implemented with ${JSON.stringify({ sellerId, options })}`);
  }

  /**
   * Creates a new product row and returns the inserted record.
   *
   * @param {Object} data
   * @param {Object} [options]
   * @param {import('sequelize').Transaction} [options.transaction]
   * @returns {Promise<Object>}
   */
  async create(data, options) {
    throw new Error(`Method not implemented with ${JSON.stringify({ data, options })}`);
  }

  /**
   * Atomically transitions a product owned by the seller from 'draft' to
   * 'published'. Returns the updated row, or null if no row matched (product
   * not found, wrong seller, or wrong source state). The `handle_product_published_at`
   * trigger sets `published_at = now()` on the transition.
   *
   * @param {{ productId: string, sellerId: string }} args
   * @param {Object} [options]
   * @param {import('sequelize').Transaction} [options.transaction]
   * @returns {Promise<Object|null>}
   */
  async publish(args, options) {
    throw new Error(`Method not implemented with ${JSON.stringify({ args, options })}`);
  }

  /**
   * Inserts a product image row.
   *
   * @param {{ productId: string, path: string, altText: string|null, position: number }} args
   * @param {Object} [options]
   * @param {import('sequelize').Transaction} [options.transaction]
   * @returns {Promise<Object|null>}
   */
  async addImage(args, options) {
    throw new Error(`Method not implemented with ${JSON.stringify({ args, options })}`);
  }

  /**
   * Counts non-deleted images for a product.
   *
   * @param {string} productId
   * @returns {Promise<number>}
   */
  async countImages(productId) {
    throw new Error(`Method not implemented with ${JSON.stringify({ productId })}`);
  }

  /**
   * Sets `products.primary_image_path` only if it is currently NULL.
   * Atomic; returns true if the row was updated.
   *
   * @param {{ productId: string, path: string }} args
   * @returns {Promise<boolean>}
   */
  async setPrimaryImageIfNull(args) {
    throw new Error(`Method not implemented with ${JSON.stringify({ args })}`);
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

  /**
   * One atomic `UPDATE ... WHERE stock >= qty` (never read-then-write or FOR UPDATE).
   * Returns the remaining stock, or null if it could not be reserved.
   */
  // eslint-disable-next-line no-unused-vars
  async decrementStockIfAvailable({ productId, quantity }, { transaction } = {}) {
    throw new Error('Method not implemented: decrementStockIfAvailable');
  }
}
