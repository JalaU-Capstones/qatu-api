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
   * Atomically transitions a product owned by the seller from 'published'
   * to 'unpublished'. Returns the updated row, or null if no row matched
   * (product not found, wrong seller, wrong source state, or soft-deleted).
   * Does NOT modify `published_at` — the timestamp is preserved across
   * unpublish/republish cycles per ADR policy.
   *
   * @param {{ productId: string, sellerId: string }} args
   * @param {Object} [options]
   * @param {import('sequelize').Transaction} [options.transaction]
   * @returns {Promise<Object|null>}
   */
  async unpublish(args, options) {
    throw new Error(`Method not implemented with ${JSON.stringify({ args, options })}`);
  }

  /**
   * Atomically updates the provided fields on a product owned by the seller.
   * Does NOT touch `slug`, `state`, `seller_id`, `published_at`, or any
   * timestamp column. At least one field MUST be provided. Returns the
   * updated row, or null if no row matched (product not found, wrong seller,
   * archived state, or soft-deleted).
   *
   * Throws SequelizeForeignKeyConstraintError (Postgres 23503) if
   * `category_id` references a non-existent category — callers must map
   * this to INVALID_CATEGORY.
   *
   * @param {{ productId: string, sellerId: string, fields: Object }} args
   * @param {Object} [options]
   * @param {import('sequelize').Transaction} [options.transaction]
   * @returns {Promise<Object|null>}
   */
  async update(args, options) {
    throw new Error(`Method not implemented with ${JSON.stringify({ args, options })}`);
  }

  /**
   * Atomically soft-deletes a product owned by the seller by setting
   * `deleted_at = now()`. Does NOT touch `product_images` rows, Supabase
   * Storage files, `state`, or `published_at` — soft-delete is reversible
   * and hard delete is out of scope. Works in ALL states
   * (draft|published|unpublished|archived). Returns the updated row, or
   * null if no row matched (product not found, wrong seller, or already
   * soft-deleted).
   *
   * @param {{ productId: string, sellerId: string }} args
   * @param {Object} [options]
   * @param {import('sequelize').Transaction} [options.transaction]
   * @returns {Promise<Object|null>}
   */
  async softDelete(args, options) {
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
   * Lists all images for a product, ordered by position then created_at.
   *
   * @param {string} productId
   * @param {Object} [options]
   * @param {import('sequelize').Transaction} [options.transaction]
   * @returns {Promise<Object[]>}
   */
  async listImages(productId, options) {
    throw new Error(`Method not implemented with ${JSON.stringify({ productId, options })}`);
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
   * Returns the product_images row for `imageId`, or null. Does NOT filter
   * by product ownership — caller must verify `product_id` matches the
   * URL param.
   * @param {string} imageId
   * @returns {Promise<{ id: string, product_id: string, path: string, position: number, alt_text: string|null, created_at: Date }|null>}
   */
  async findImageById(imageId) {
    throw new Error(`Method not implemented with ${JSON.stringify({ imageId })}`);
  }

  /**
   * Deletes the product_images row by `id` and returns the deleted row
   * (`RETURNING *`), or null if it did not exist.
   * @param {string} imageId
   * @param {Object} [options]
   * @param {import('sequelize').Transaction} [options.transaction]
   * @returns {Promise<Object|null>}
   */
  async deleteImage(imageId, options) {
    throw new Error(`Method not implemented with ${JSON.stringify({ imageId, options })}`);
  }

  /**
   * If `products.primary_image_path` currently points to a path that no
   * longer exists in `product_images`, promote the next image by
   * `(position ASC, created_at ASC)`, or set it to NULL if none. Only
   * touches `primary_image_path` and `updated_at`. Returns the updated
   * row (products) or null.
   * @param {string} productId
   * @param {Object} [options]
   * @param {import('sequelize').Transaction} [options.transaction]
   * @returns {Promise<Object|null>}
   */
  async recomputePrimaryImage(productId, options) {
    throw new Error(`Method not implemented with ${JSON.stringify({ productId, options })}`);
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
