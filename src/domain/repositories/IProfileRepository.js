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
   * Returns role names assigned to the given user.
   * @param {string} userId
   * @returns {Promise<string[]>}
   */
  async getRoleNames(userId) {
    throw new Error(`Method not implemented with ${JSON.stringify({ userId })}`);
  }

  /**
   * @param {string} username
   * @returns {Promise<import('../entities/Profile.js').Profile|null>}
   */
  async findByUsername(username) {
    throw new Error(`Method not implemented with ${username}`);
  }

  /**
   * @param {string} id
   * @param {Object} fields
   * @returns {Promise<import('../entities/Profile.js').Profile|null>}
   */
  async update(id, fields) {
    throw new Error(`Method not implemented with ${id} and ${fields}`);
  }
}
