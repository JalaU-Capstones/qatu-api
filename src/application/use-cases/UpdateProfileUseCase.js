import { FullName } from '../../domain/value-objects/FullName.js';
import { ProfileResponseDTO, UpdateProfileRequestDTO } from '../dtos/ProfileDTO.js';

const MAX_BIO_LENGTH = 500;
const MAX_AVATAR_PATH_LENGTH = 500;
const MIN_LOCALE_LENGTH = 2;
const MAX_LOCALE_LENGTH = 10;

export class UpdateProfileUseCase {
  /**
   * @param {Object} dependencies
   * @param {import('../../domain/repositories/IProfileRepository.js').IProfileRepository} dependencies.profileRepository
   */
  constructor({ profileRepository } = {}) {
    if (!profileRepository) {
      throw new Error('profileRepository is required');
    }
    this.profileRepository = profileRepository;
  }

  /**
   * Partially updates the authenticated user's profile.
   *
   * @param {UpdateProfileRequestDTO | Object} input
   * @returns {Promise<{ data: Object, meta: { timestamp: string } }>}
   */
  async execute(input) {
    const dto =
      input instanceof UpdateProfileRequestDTO ? input : new UpdateProfileRequestDTO(input);
    const { userId, updates } = dto;

    if (!userId) {
      const err = new Error('Authentication failed');
      err.code = 'UNAUTHORIZED';
      err.statusCode = 401;
      throw err;
    }

    const validatedUpdates = {};

    if (updates.full_name !== undefined) {
      try {
        const fullNameVO = new FullName(updates.full_name);
        validatedUpdates.full_name = fullNameVO.getValue();
      } catch (err) {
        const validationErr = new Error(err.message);
        validationErr.code = 'VALIDATION_ERROR';
        validationErr.statusCode = 400;
        throw validationErr;
      }
    }

    if (updates.bio !== undefined) {
      if (updates.bio !== null && typeof updates.bio !== 'string') {
        throw this._createValidationError('Bio must be a string.');
      }
      if (typeof updates.bio === 'string' && updates.bio.length > MAX_BIO_LENGTH) {
        throw this._createValidationError(`Bio must be at most ${MAX_BIO_LENGTH} characters long.`);
      }
      validatedUpdates.bio = updates.bio;
    }

    if (updates.avatar_path !== undefined) {
      if (updates.avatar_path !== null && typeof updates.avatar_path !== 'string') {
        throw this._createValidationError('Avatar path must be a string.');
      }
      if (
        typeof updates.avatar_path === 'string' &&
        updates.avatar_path.length > MAX_AVATAR_PATH_LENGTH
      ) {
        throw this._createValidationError(
          `Avatar path must be at most ${MAX_AVATAR_PATH_LENGTH} characters long.`
        );
      }
      validatedUpdates.avatar_path = updates.avatar_path;
    }

    if (updates.locale !== undefined) {
      if (
        typeof updates.locale !== 'string' ||
        updates.locale.length < MIN_LOCALE_LENGTH ||
        updates.locale.length > MAX_LOCALE_LENGTH
      ) {
        throw this._createValidationError(
          `Locale must be between ${MIN_LOCALE_LENGTH} and ${MAX_LOCALE_LENGTH} characters long.`
        );
      }
      validatedUpdates.locale = updates.locale;
    }

    if (Object.keys(validatedUpdates).length === 0) {
      throw this._createValidationError('At least one profile field must be provided');
    }

    const updatedProfile = await this.profileRepository.update(userId, validatedUpdates);
    if (!updatedProfile) {
      const err = new Error('Profile not found');
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    return new ProfileResponseDTO(updatedProfile).toJSON();
  }

  /**
   * @param {string} message
   * @returns {Error & { code: string, statusCode: number }}
   * @private
   */
  _createValidationError(message) {
    const err = new Error(message);
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 400;
    return err;
  }
}
