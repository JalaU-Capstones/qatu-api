/**
 * @interface ICategoryRepository
 */
export class ICategoryRepository {
  /**
   * Lists active categories ordered by position and name.
   *
   * @param {Object} params
   * @param {number} params.page
   * @param {number} params.limit
   * @returns {Promise<{ items: import('../entities/Category.js').Category[], total: number }>}
   */
  async findAll({ page, limit }) {
    throw new Error(`Method not implemented with ${JSON.stringify({ page, limit })}`);
  }

  /**
   * @param {string} id
   * @returns {Promise<import('../entities/Category.js').Category|null>}
   */
  async findById(id) {
    throw new Error(`Method not implemented with ${id}`);
  }

  /**
   * @param {string} name
   * @returns {Promise<import('../entities/Category.js').Category|null>}
   */
  async findByName(name) {
    throw new Error(`Method not implemented with ${name}`);
  }

  /**
   * @param {string} slug
   * @returns {Promise<import('../entities/Category.js').Category|null>}
   */
  async findBySlug(slug) {
    throw new Error(`Method not implemented with ${slug}`);
  }

  /**
   * @param {Object} data
   * @returns {Promise<import('../entities/Category.js').Category>}
   */
  async create(data) {
    throw new Error(`Method not implemented with ${JSON.stringify(data)}`);
  }

  /**
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<import('../entities/Category.js').Category|null>}
   */
  async update(id, updates) {
    throw new Error(`Method not implemented with ${JSON.stringify({ id, updates })}`);
  }

  /**
   * Checks whether at least one non-deleted product belongs to the category.
   *
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async hasProducts(id) {
    throw new Error(`Method not implemented with ${id}`);
  }

  /**
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error(`Method not implemented with ${id}`);
  }
}
