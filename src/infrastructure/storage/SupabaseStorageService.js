import { v4 as uuidv4 } from 'uuid';
import { IStorageService } from '../../application/ports/IStorageService.js';
import {
  ALLOWED_AVATAR_MIME_TYPES,
  MAX_AVATAR_SIZE_BYTES,
} from '../../application/use-cases/UploadAvatarUseCase.js';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';

export const DEFAULT_AVATAR_BUCKET = env.SUPABASE_STORAGE_BUCKET || 'avatars';

/** Exported for UploadProductImageUseCase and uploadProductImage in prompt 2D.2. */
export const DEFAULT_PRODUCT_IMAGES_BUCKET = 'product-images';
export const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_PRODUCT_IMAGE_MIME_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

export class SupabaseStorageService extends IStorageService {
  /**
   * @param {Object} [options]
   * @param {import('@supabase/supabase-js').SupabaseClient} [options.client=supabase]
   * @param {string} [options.bucket=DEFAULT_AVATAR_BUCKET]
   * @param {string} [options.storageUrl=env.SUPABASE_STORAGE_PUBLIC_URL]
   * @param {Function} [options.uuidGenerator=uuidv4]
   */
  constructor({
    client = supabase,
    bucket = DEFAULT_AVATAR_BUCKET,
    storageUrl = env.SUPABASE_STORAGE_PUBLIC_URL,
    uuidGenerator = uuidv4,
  } = {}) {
    super();
    this.client = client;
    this.bucket = bucket;
    this.storageUrl =
      storageUrl ||
      env.SUPABASE_STORAGE_PUBLIC_URL ||
      `${(env.SUPABASE_URL || 'http://localhost:54321').replace(/\/$/, '')}/storage/v1/object/public`;
    this.uuidGenerator = uuidGenerator;
  }

  /**
   * Builds the public URL for an object stored in Supabase Storage.
   *
   * ADR-019 (SP-18) phased rollout:
   *   - When `env.PUBLIC_APP_URL` is empty/unset, returns the Supabase direct
   *     URL: `{storageBase}/{bucket}/{objectKey}`.
   *   - When `env.PUBLIC_APP_URL` is set, returns the SPA-origin URL:
   *     `{publicAppUrl}/{bucket}/{objectKey}`.
   *     (Requires the client nginx proxy to forward `/avatars/*` and
   *     `/product-images/*` to Supabase Storage — frontend branch.)
   *
   * @param {string} bucket - Storage bucket name (e.g. 'avatars', 'product-images').
   * @param {string} objectKey - Object key inside the bucket (e.g. '{uuid}.webp').
   * @returns {string} Full public URL.
   */
  getPublicUrl(bucket, objectKey) {
    if (!bucket || !objectKey) {
      const err = new Error('getPublicUrl requires bucket and objectKey');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    const cleanBase = this.storageUrl.replace(/\/$/, '');
    const supabaseUrl = `${cleanBase}/${bucket}/${objectKey}`;

    const publicAppUrl = (env.PUBLIC_APP_URL || '').trim();
    if (!publicAppUrl) {
      return supabaseUrl;
    }

    return `${publicAppUrl.replace(/\/$/, '')}/${bucket}/${objectKey}`;
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
   *
   * ⚠️ ADR-019 phased rollout: the returned path respects `env.PUBLIC_APP_URL`.
   * When unset (default), returns the Supabase direct URL. When set, returns
   * `{PUBLIC_APP_URL}/avatars/...` which requires the frontend nginx proxy
   * (Phase 2, deferred). Until Phase 2 ships, `PUBLIC_APP_URL` should stay
   * empty in environments where avatars must render.
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

    await this._uploadToStorage({
      bucket: this.bucket,
      objectKey,
      buffer,
      contentType: normalizedMime,
      upsert: true,
      uploadType: 'avatar',
    });

    return { path: this.getPublicUrl(this.bucket, objectKey) };
  }

  /**
   * Uploads a product image to the `product-images` bucket and returns both
   * the relative path (per ADR-010) and the public URL (per ADR-019).
   *
   * Mirrors `uploadAvatar` validation but uses `upsert: false` (product images
   * are append-only; duplicates use distinct UUIDs).
   *
   * @param {Object} params
   * @param {string} params.productId - Owner product UUID (used as folder).
   * @param {Buffer} params.buffer - Image bytes.
   * @param {string} params.mimeType - Image MIME type.
   * @param {string} [params.extension] - Optional file extension hint.
   * @param {string} [params.originalName] - Original filename for extension check.
   * @param {number} [params.size] - Optional size hint.
   * @returns {Promise<{ bucket: string, path: string, publicUrl: string }>}
   */
  async uploadProductImage({ productId, buffer, mimeType, extension, originalName, size } = {}) {
    if (!productId || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      const err = new Error('productId and a non-empty buffer are required');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    const byteSize = typeof size === 'number' ? size : buffer.length;
    if (byteSize > MAX_PRODUCT_IMAGE_SIZE_BYTES || buffer.length > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
      const err = new Error('The image exceeds the maximum size of 5 MB.');
      err.code = 'FILE_TOO_LARGE';
      err.statusCode = 422;
      throw err;
    }

    const normalizedMime = typeof mimeType === 'string' ? mimeType.trim().toLowerCase() : '';
    // eslint-disable-next-line security/detect-object-injection
    const mappedExt = ALLOWED_PRODUCT_IMAGE_MIME_TYPES[normalizedMime];
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

    const bucket = DEFAULT_PRODUCT_IMAGES_BUCKET;
    const fileUuid = this.uuidGenerator();
    const objectKey = `${productId}/${fileUuid}.${mappedExt}`;

    await this._uploadToStorage({
      bucket,
      objectKey,
      buffer,
      contentType: normalizedMime,
      upsert: false,
      uploadType: 'product image',
    });

    return {
      bucket,
      path: `${bucket}/${objectKey}`,
      publicUrl: this.getPublicUrl(bucket, objectKey),
    };
  }

  async _uploadToStorage({ bucket, objectKey, buffer, contentType, upsert, uploadType }) {
    if (this.client?.storage && typeof this.client.storage.from === 'function') {
      const bucketClient = this.client.storage.from(bucket);
      const { error } = await bucketClient.upload(objectKey, buffer, { contentType, upsert });

      if (error) {
        const err = new Error(`Failed to upload ${uploadType} to storage: ${error.message}`);
        err.code = 'STORAGE_UPLOAD_ERROR';
        err.statusCode = 500;
        throw err;
      }
    }
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
