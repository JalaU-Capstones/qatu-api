import { ROLES, ROLE_DEFINITIONS } from '../../domain/constants/roles.js';
import { Email } from '../../domain/value-objects/Email.js';
import { LoginResponseDTO } from '../dtos/LoginDTO.js';

export class LoginUseCase {
  /**
   * @param {Object} dependencies
   * @param {import('../ports/IAuthService.js').IAuthService} dependencies.authService
   * @param {import('../../domain/repositories/IProfileRepository.js').IProfileRepository} dependencies.profileRepository
   */
  constructor({ authService, profileRepository }) {
    if (!authService) throw new Error('authService is required');
    if (!profileRepository) throw new Error('profileRepository is required');
    this.authService = authService;
    this.profileRepository = profileRepository;
  }

  /**
   * @param {import('../dtos/LoginDTO.js').LoginRequestDTO} request
   * @returns {Promise<LoginResponseDTO>}
   */
  async execute(request) {
    if (!request?.email) {
      const err = new Error('Email is required');
      err.statusCode = 400;
      throw err;
    }

    if (!request?.password || typeof request.password !== 'string') {
      const err = new Error('Password is required');
      err.statusCode = 400;
      throw err;
    }

    const emailVO = new Email(request.email);

    const authResult = await this.authService.loginUser({
      email: emailVO.getValue(),
      password: request.password,
    });

    const isoNow = new Date().toISOString();
    const existingProfile = await this.profileRepository.findById(authResult.id);

    const defaultRole = {
      id: ROLE_DEFINITIONS[ROLES.BUYER].id,
      name: ROLES.BUYER,
      created_at: isoNow,
    };

    const roles =
      existingProfile?.roles && existingProfile.roles.length > 0
        ? existingProfile.roles.map((r) => ({
            id: r.id,
            name: r.name,
            created_at: r.created_at || isoNow,
          }))
        : [defaultRole];

    const fallbackUsername = authResult.user_metadata?.username || emailVO.getValue().split('@')[0];

    const profileData = existingProfile
      ? {
          id: existingProfile.id,
          username: existingProfile.username,
          full_name: existingProfile.fullName || existingProfile.full_name || fallbackUsername,
          email: existingProfile.email || authResult.email,
          avatar_path: existingProfile.avatarPath ?? existingProfile.avatar_path ?? null,
          bio: existingProfile.bio ?? null,
          locale: existingProfile.locale || 'en',
          created_at: existingProfile.createdAt
            ? existingProfile.createdAt.toISOString()
            : authResult.created_at || isoNow,
          updated_at: existingProfile.updatedAt
            ? existingProfile.updatedAt.toISOString()
            : authResult.created_at || isoNow,
        }
      : {
          id: authResult.id,
          username: fallbackUsername,
          full_name: authResult.user_metadata?.full_name || fallbackUsername,
          email: authResult.email,
          avatar_path: null,
          bio: null,
          locale: 'en',
          created_at: authResult.created_at || isoNow,
          updated_at: authResult.created_at || isoNow,
        };

    return new LoginResponseDTO({
      user: {
        id: authResult.id,
        email: authResult.email,
        created_at: authResult.created_at || isoNow,
      },
      profile: profileData,
      roles,
      token: authResult.token,
      timestamp: isoNow,
    });
  }
}
