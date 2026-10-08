export class Profile {
  /**
   * @param {Object} params
   * @param {string} params.id
   * @param {string} params.username
   * @param {string} params.fullName
   * @param {string} [params.role='buyer']
   * @param {Date} [params.createdAt]
   * @param {Date} [params.updatedAt]
   */
  constructor({ id, username, fullName, role = 'buyer', createdAt, updatedAt }) {
    if (!id) {
      throw new Error('Profile id is required');
    }
    if (!username) {
      throw new Error('Profile username is required');
    }
    if (!fullName) {
      throw new Error('Profile full name is required');
    }

    this.id = id;
    this.username = typeof username === 'string' ? username : username.getValue();
    this.fullName = typeof fullName === 'string' ? fullName : fullName.getValue();
    this.role = role;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
  }

  isBuyer() {
    return this.role === 'buyer';
  }
}
