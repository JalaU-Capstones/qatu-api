import { GetProfileByIdRequestDTO, ProfileResponseDTO } from '../dtos/ProfileDTO.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class GetProfileByIdUseCase {
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
   * Retrieves a profile by its UUID.
   * Throws 404 NOT_FOUND if the ID is not a valid UUID or the profile does not exist.
   *
   * @param {string | { id?: string, profileId?: string }} input
   * @returns {Promise<{ data: Object, meta: { timestamp: string } }>}
   */
  async execute(input) {
    const dto =
      input instanceof GetProfileByIdRequestDTO ? input : new GetProfileByIdRequestDTO(input);
    const { profileId } = dto;

    if (!profileId || !UUID_REGEX.test(profileId)) {
      throw this._createNotFoundError();
    }

    const profile = await this.profileRepository.findById(profileId);
    if (!profile) {
      throw this._createNotFoundError();
    }

    return new ProfileResponseDTO(profile).toJSON();
  }

  /**
   * @returns {Error & { code: string, statusCode: number }}
   * @private
   */
  _createNotFoundError() {
    const err = new Error('Profile not found');
    err.code = 'NOT_FOUND';
    err.statusCode = 404;
    return err;
  }
}
