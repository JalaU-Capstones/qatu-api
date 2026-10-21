/**
 * @interface ICategoryRepository
 */
export class ICategoryRepository {
  /**
   *Lists active categories ordered by position and name
   *
   * @param {Object} params
   * @param {number} params.page
   * @param {number} params.limit
   * @returns {Promise<{ items: import('../entities/Category.js').Category[], total: number }>}
   */
  async findAll({ page, limit }) {
    throw new Error(`Method not implemented with ${JSON.stringify({ page, limit })}`);
  }
}
