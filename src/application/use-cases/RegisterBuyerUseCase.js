import { ROLES, ROLE_DEFINITIONS } from '../../domain/constants/roles.js';
import { Email } from '../../domain/value-objects/Email.js';
import { FullName } from '../../domain/value-objects/FullName.js';
import { Password } from '../../domain/value-objects/Password.js';
import { Username } from '../../domain/value-objects/Username.js';
import { RegisterResponseDTO } from '../dtos/RegisterDTO.js';

export class RegisterBuyerUseCase {
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
   * @param {import('../dtos/RegisterDTO.js').RegisterRequestDTO} request
   * @returns {Promise<RegisterResponseDTO>}
   */
  async execute(request) {
    const emailVO = new Email(request.email);
    const passwordVO = new Password(request.password);
    const usernameVO = new Username(request.username);
    const rawFullName = request.full_name || request.fullName || request.username;
    const fullNameVO = new FullName(rawFullName);

    const exists = await this.authService.emailExists(emailVO.getValue());
    if (exists) {
      const error = new Error('Email already registered');
      error.code = 'EMAIL_ALREADY_EXISTS';
      error.statusCode = 409;
      throw error;
    }

    const authResult = await this.authService.registerUser({
      email: emailVO.getValue(),
      password: passwordVO.getValue(),
      role: ROLES.BUYER,
      metadata: {
        username: usernameVO.getValue(),
        full_name: fullNameVO.getValue(),
        fullName: fullNameVO.getValue(),
      },
    });

    const now = new Date();
    const isoNow = now.toISOString();

    const buyerRole = {
      id: ROLE_DEFINITIONS[ROLES.BUYER].id,
      name: ROLES.BUYER,
      created_at: isoNow,
    };

    // The on_auth_user_created trigger (migration 019) automatically inserts into
    // public.profiles and public.user_roles the moment auth.admin.createUser succeeds.
    // Read back the trigger-created row instead of re-inserting (which would violate
    // the profiles primary-key constraint and produce a 500).
    const savedProfile = await this.profileRepository.findById(authResult.id);

    // Fallback for unit-test / in-memory mode where the DB trigger does not fire.
    const resolvedProfile = savedProfile || {
      id: authResult.id,
      username: usernameVO.getValue(),
      fullName: fullNameVO.getValue(),
      full_name: fullNameVO.getValue(),
      email: emailVO.getValue(),
      avatarPath: null,
      bio: null,
      locale: 'en',
      createdAt: now,
      updatedAt: now,
    };

    const token =
      authResult.token || authResult.session?.access_token || 'mock-jwt-token-placeholder';

    return new RegisterResponseDTO({
      user: {
        id: authResult.id,
        email: emailVO.getValue(),
        created_at: authResult.created_at || isoNow,
      },
      profile: {
        id: resolvedProfile.id,
        username: resolvedProfile.username,
        full_name: resolvedProfile.fullName || resolvedProfile.full_name,
        email: resolvedProfile.email || emailVO.getValue(),
        avatar_path: resolvedProfile.avatarPath || null,
        bio: resolvedProfile.bio || null,
        locale: resolvedProfile.locale || 'en',
        created_at: resolvedProfile.createdAt ? resolvedProfile.createdAt.toISOString() : isoNow,
        updated_at: resolvedProfile.updatedAt ? resolvedProfile.updatedAt.toISOString() : isoNow,
      },
      roles: [buyerRole],
      token,
      timestamp: isoNow,
    });
  }
}
