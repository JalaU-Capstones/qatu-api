import { ROLES, ROLE_DEFINITIONS } from '../../domain/constants/roles.js';
import { Profile } from '../../domain/entities/Profile.js';
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

    const profile = new Profile({
      id: authResult.id,
      username: usernameVO,
      fullName: fullNameVO,
      full_name: fullNameVO.getValue(),
      email: emailVO.getValue(),
      avatar_path: null,
      bio: null,
      locale: 'en',
      role: ROLES.BUYER,
      roles: [buyerRole],
      createdAt: now,
      updatedAt: now,
    });

    const savedProfile = await this.profileRepository.create(profile);

    return new RegisterResponseDTO({
      user: {
        id: authResult.id,
        email: emailVO.getValue(),
        created_at: authResult.created_at || isoNow,
      },
      profile: {
        id: savedProfile.id,
        username: savedProfile.username,
        full_name: savedProfile.fullName || savedProfile.full_name,
        email: savedProfile.email || emailVO.getValue(),
        avatar_path: savedProfile.avatarPath || null,
        bio: savedProfile.bio || null,
        locale: savedProfile.locale || 'en',
        created_at: savedProfile.createdAt ? savedProfile.createdAt.toISOString() : isoNow,
        updated_at: savedProfile.updatedAt ? savedProfile.updatedAt.toISOString() : isoNow,
      },
      roles: [buyerRole],
      token: authResult.token,
      session: authResult.session,
      timestamp: isoNow,
    });
  }
}
