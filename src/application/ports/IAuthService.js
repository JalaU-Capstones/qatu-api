/**
 * @interface IAuthService
 */
export class IAuthService {
  /**
   * Registers a new user account with external auth provider (Supabase Auth).
   * @param {Object} params
   * @param {string} params.email
   * @param {string} params.password
   * @param {string} params.role
   * @param {Object} [params.metadata]
   * @returns {Promise<{ id: string, email: string, session?: Object }>}
   */
  async registerUser(params) {
    throw new Error(`Method not implemented with ${params}`);
  }

  /**
   * Checks if an email is already registered.
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  async emailExists(email) {
    throw new Error(`Method not implemented with ${email}`);
  }
}
