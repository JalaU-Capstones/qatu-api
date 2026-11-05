import { ProfileResponseDTO, UploadAvatarRequestDTO } from '../dtos/ProfileDTO.js';

export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB per SP-10

export const ALLOWED_AVATAR_MIME_TYPES = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
});

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

export class UploadAvatarUseCase {
  /**
   * @param {Object} dependencies
   * @param {import('../../domain/repositories/IProfileRepository.js').IProfileRepository} dependencies.profileRepository
   * @param {import('../ports/IStorageService.js').IStorageService} dependencies.storageService
   */
  constructor({ profileRepository, storageService } = {}) {
    if (!profileRepository) {
      throw new Error('profileRepository is required');
    }
    if (!storageService) {
      throw new Error('storageService is required');
    }
    this.profileRepository = profileRepository;
    this.storageService = storageService;
  }

  /**
   * Validates, stores in Supabase Storage, and updates the authenticated user's avatar_path.
   *
   * @param {UploadAvatarRequestDTO | Object} input
   * @returns {Promise<{ data: Object, meta: { timestamp: string } }>}
   */
  async execute(input) {
    const dto = input instanceof UploadAvatarRequestDTO ? input : new UploadAvatarRequestDTO(input);
    const { userId, targetUserId, requestingUserId, buffer, mimeType, originalName, size } = dto;
    const resolvedTargetId = targetUserId || userId;

    if (!resolvedTargetId || !requestingUserId) {
      const err = new Error('Authentication failed');
      err.code = 'UNAUTHORIZED';
      err.statusCode = 401;
      throw err;
    }

    if (requestingUserId !== resolvedTargetId) {
      const err = new Error('You do not have permission to update this profile');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    if (!buffer || size <= 0 || buffer.length === 0) {
      const err = new Error('Avatar image file is required');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    if (size > MAX_AVATAR_SIZE_BYTES || buffer.length > MAX_AVATAR_SIZE_BYTES) {
      const err = new Error('The image exceeds the maximum size of 2 MB.');
      err.code = 'FILE_TOO_LARGE';
      err.statusCode = 422;
      throw err;
    }

    // eslint-disable-next-line security/detect-object-injection
    const mappedExt = ALLOWED_AVATAR_MIME_TYPES[mimeType];
    if (!mappedExt || !this._hasValidExtension(originalName)) {
      const err = new Error('Only JPEG, PNG, and WebP images are accepted.');
      err.code = 'INVALID_FILE_FORMAT';
      err.statusCode = 422;
      throw err;
    }

    const { path: avatarPath } = await this.storageService.uploadAvatar({
      userId: resolvedTargetId,
      buffer,
      mimeType,
      extension: mappedExt,
    });

    const updatedProfile = await this.profileRepository.update(resolvedTargetId, {
      avatar_path: avatarPath,
    });

    if (!updatedProfile) {
      const err = new Error('Profile not found');
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    return new ProfileResponseDTO(updatedProfile).toJSON();
  }

  /**
   * Validates the file extension when originalName includes one.
   *
   * @param {string} originalName
   * @returns {boolean}
   * @private
   */
  _hasValidExtension(originalName) {
    if (!originalName || !originalName.includes('.')) {
      return true;
    }
    const ext = originalName.split('.').pop().toLowerCase();
    return ALLOWED_EXTENSIONS.has(ext);
  }
}
