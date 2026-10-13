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
    const fullNameVO = new FullName(request.fullName);

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
      role: 'buyer',
      metadata: {
        username: usernameVO.getValue(),
        fullName: fullNameVO.getValue(),
      },
    });

    const profile = new Profile({
      id: authResult.id,
      username: usernameVO,
      fullName: fullNameVO,
      role: 'buyer',
    });

    const savedProfile = await this.profileRepository.create(profile);

    return new RegisterResponseDTO({
      user: {
        id: savedProfile.id,
        email: emailVO.getValue(),
        username: savedProfile.username,
        fullName: savedProfile.fullName,
        role: savedProfile.role,
      },
      session: authResult.session || null,
    });
  }
}
