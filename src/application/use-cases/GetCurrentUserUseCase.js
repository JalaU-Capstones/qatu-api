import { LoginResponseDTO } from '../dtos/LoginDTO.js';

export class GetCurrentUserUseCase {
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
   * Fetches the profile and roles for the authenticated user and builds LoginResponseDTO.
   *
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} [params.email]
   * @returns {Promise<LoginResponseDTO>}
   */
  async execute({ userId, email }) {
    if (!userId) {
      const err = new Error('User ID is required');
      err.code = 'UNAUTHORIZED';
      err.statusCode = 401;
      throw err;
    }

    const profile = await this.profileRepository.findById(userId);
    if (!profile) {
      const err = new Error('User profile not found');
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const userEmail = email || profile.email;

    return new LoginResponseDTO({
      user: {
        id: profile.id,
        email: userEmail,
        created_at: profile.createdAt
          ? new Date(profile.createdAt).toISOString()
          : new Date().toISOString(),
      },
      profile,
      roles: profile.roles || [],
    });
  }
}
