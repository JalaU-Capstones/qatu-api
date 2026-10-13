export class RegisterRequestDTO {
  /**
   * @param {Object} data
   * @param {string} data.email
   * @param {string} data.password
   * @param {string} data.username
   * @param {string} data.fullName
   */
  constructor({ email, password, username, fullName }) {
    this.email = email;
    this.password = password;
    this.username = username;
    this.fullName = fullName;
  }
}

export class RegisterResponseDTO {
  /**
   * @param {Object} data
   * @param {Object} data.user
   * @param {string} data.user.id
   * @param {string} data.user.email
   * @param {string} data.user.username
   * @param {string} data.user.fullName
   * @param {string} data.user.role
   * @param {Object} [data.session]
   */
  constructor({ user, session = null }) {
    this.user = user;
    this.session = session;
  }
}
