import { IStorageService } from '../../application/ports/IStorageService.js';
import { supabase } from '../config/supabase.js';

export const DEFAULT_AVATAR_BUCKET = 'avatars';

export class SupabaseStorageService extends IStorageService {
  /**
   * @param {Object} [options]
   * @param {import('@supabase/supabase-js').SupabaseClient} [options.client=supabase]
   * @param {string} [options.bucket=DEFAULT_AVATAR_BUCKET]
   */
  constructor({ client = supabase, bucket = DEFAULT_AVATAR_BUCKET } = {}) {
    super();
    this.client = client;
    this.bucket = bucket;
  }

  /**
   * Uploads an avatar buffer to Supabase Storage and returns the storage path.
   *
   * @param {Object} params
   * @param {string} params.userId
   * @param {Buffer} params.buffer
   * @param {string} params.mimeType
   * @param {string} params.extension
   * @returns {Promise<{ path: string }>}
   */
  async uploadAvatar({ userId, buffer, mimeType, extension } = {}) {
    if (!userId || !Buffer.isBuffer(buffer) || !mimeType || !extension) {
      const err = new Error('userId, buffer, mimeType, and extension are required');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    const cleanExt = extension.replace(/^\./, '').toLowerCase();
    const storagePath = `${this.bucket}/${userId}/avatar.${cleanExt}`;
    const objectKey = `${userId}/avatar.${cleanExt}`;

    if (this.client?.storage && typeof this.client.storage.from === 'function') {
      const { error } = await this.client.storage.from(this.bucket).upload(objectKey, buffer, {
        contentType: mimeType,
        upsert: true,
      });

      if (error) {
        const err = new Error(`Failed to upload avatar to storage: ${error.message}`);
        err.code = 'STORAGE_UPLOAD_ERROR';
        err.statusCode = 500;
        throw err;
      }
    }

    return { path: storagePath };
  }
}
