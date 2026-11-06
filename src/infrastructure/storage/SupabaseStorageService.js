import { v4 as uuidv4 } from 'uuid';
import { IStorageService } from '../../application/ports/IStorageService.js';
import {
  ALLOWED_AVATAR_MIME_TYPES,
  MAX_AVATAR_SIZE_BYTES,
} from '../../application/use-cases/UploadAvatarUseCase.js';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';

export const DEFAULT_AVATAR_BUCKET = env.SUPABASE_STORAGE_BUCKET || 'avatars';
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

export class SupabaseStorageService extends IStorageService {
  /**
   * @param {Object} [options]
   * @param {import('@supabase/supabase-js').SupabaseClient} [options.client=supabase]
   * @param {string} [options.bucket=DEFAULT_AVATAR_BUCKET]
   * @param {string} [options.storageUrl=env.SUPABASE_STORAGE_URL]
   * @param {Function} [options.uuidGenerator=uuidv4]
   */
  constructor({
    client = supabase,
    bucket = DEFAULT_AVATAR_BUCKET,
    storageUrl = env.SUPABASE_STORAGE_URL,
    uuidGenerator = uuidv4,
  } = {}) {
    super();
    this.client = client;
    this.bucket = bucket;
    this.storageUrl =
      storageUrl ||
      `${(env.SUPABASE_URL || 'http://localhost:54321').replace(/\/$/, '')}/storage/v1/object/public`;
    this.uuidGenerator = uuidGenerator;
  }

  /**
   * Validates constraints, uploads an avatar buffer to Supabase Storage,
   * and returns the full public URL (ADR-010 Option A).
   *
   * @param {Object} params
   * @param {string} params.userId
   * @param {Buffer} params.buffer
   * @param {string} params.mimeType
   * @param {string} [params.extension]
   * @param {string} [params.originalName]
   * @param {number} [params.size]
   * @returns {Promise<{ path: string }>}
   */
  async uploadAvatar({ userId, buffer, mimeType, extension, originalName, size } = {}) {
    if (!userId || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      const err = new Error('userId and a non-empty buffer are required');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    const byteSize = typeof size === 'number' ? size : buffer.length;
    if (byteSize > MAX_AVATAR_SIZE_BYTES || buffer.length > MAX_AVATAR_SIZE_BYTES) {
      const err = new Error('The image exceeds the maximum size of 2 MB.');
      err.code = 'FILE_TOO_LARGE';
      err.statusCode = 422;
      throw err;
    }

    const normalizedMime = typeof mimeType === 'string' ? mimeType.trim().toLowerCase() : '';
    // eslint-disable-next-line security/detect-object-injection
    const mappedExt = ALLOWED_AVATAR_MIME_TYPES[normalizedMime];
    const rawExt = (extension || mappedExt || '').replace(/^\./, '').toLowerCase();

    if (
      !mappedExt ||
      !ALLOWED_EXTENSIONS.has(rawExt) ||
      !this._hasValidOriginalName(originalName)
    ) {
      const err = new Error('Only JPEG, PNG, and WebP images are accepted.');
      err.code = 'INVALID_FILE_FORMAT';
      err.statusCode = 422;
      throw err;
    }

    const cleanExt = mappedExt;
    const fileUuid = this.uuidGenerator();
    const objectKey = `${userId}/${fileUuid}.${cleanExt}`;

    let publicUrl = '';

    if (this.client?.storage && typeof this.client.storage.from === 'function') {
      const bucketClient = this.client.storage.from(this.bucket);
      const { error } = await bucketClient.upload(objectKey, buffer, {
        contentType: normalizedMime,
        upsert: true,
      });

      if (error) {
        const err = new Error(`Failed to upload avatar to storage: ${error.message}`);
        err.code = 'STORAGE_UPLOAD_ERROR';
        err.statusCode = 500;
        throw err;
      }

      if (typeof bucketClient.getPublicUrl === 'function') {
        const publicUrlResult = bucketClient.getPublicUrl(objectKey);
        publicUrl = publicUrlResult?.data?.publicUrl || '';
      }
    }

    if (!publicUrl) {
      const cleanBase = this.storageUrl.replace(/\/$/, '');
      publicUrl = `${cleanBase}/${this.bucket}/${objectKey}`;
    }

    return { path: publicUrl };
  }

  /**
   * Explicitly rejects disallowed extensions (e.g., .exe, .svg, .gif) when originalName is provided.
   *
   * @param {string} [originalName]
   * @returns {boolean}
   * @private
   */
  _hasValidOriginalName(originalName) {
    if (!originalName || typeof originalName !== 'string' || !originalName.includes('.')) {
      return true;
    }
    const ext = originalName.split('.').pop().trim().toLowerCase();
    return ALLOWED_EXTENSIONS.has(ext);
  }
}
