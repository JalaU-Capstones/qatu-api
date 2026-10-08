/**
 * @interface IProfileRepository
 */
export class IProfileRepository {
  /**
   * @param {import('../entities/Profile.js').Profile} profile
   * @returns {Promise<import('../entities/Profile.js').Profile>}
   */
  async create(profile) {
    throw new Error(`Method not implemented with ${profile}`);
  }

  /**
   * @param {string} id
   * @returns {Promise<import('../entities/Profile.js').Profile|null>}
   */
  async findById(id) {
    throw new Error(`Method not implemented with ${id}`);
  }

  /**
   * @param {string} username
   * @returns {Promise<import('../entities/Profile.js').Profile|null>}
   */
  async findByUsername(username) {
    throw new Error(`Method not implemented with ${username}`);
  }
}
