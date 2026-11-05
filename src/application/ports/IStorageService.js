/**
 * @interface IStorageService
 */
export class IStorageService {
  /**
   * Uploads a user's avatar image to object storage and returns the stored path.
   *
   * @param {Object} params
   * @param {string} params.userId
   * @param {Buffer} params.buffer
   * @param {string} params.mimeType
   * @param {string} params.extension
   * @returns {Promise<{ path: string }>}
   */
  async uploadAvatar(params) {
    throw new Error(`Method not implemented with ${params}`);
  }
}
