import { ROLES } from '../../domain/constants/roles.js';
import {
  SELLER_APPLICATION_STATUS,
  SellerApplication,
} from '../../domain/entities/SellerApplication.js';
import { SellerApplicationResponseDTO } from '../dtos/SellerApplicationDTO.js';

export class ApplyAsSellerUseCase {
  constructor({ sellerApplicationRepository, profileRepository }) {
    if (!sellerApplicationRepository) {
      throw new Error('sellerApplicationRepository is required');
    }
    if (!profileRepository) {
      throw new Error('profileRepository is required');
    }
    this.sellerApplicationRepository = sellerApplicationRepository;
    this.profileRepository = profileRepository;
  }

  async execute(requestDto) {
    const { profileId, businessName, businessDescription, contactPhone, contactEmail } = requestDto;

    const roleNames = await this.profileRepository.getRoleNames(profileId);
    if (roleNames.includes(ROLES.ADMIN)) {
      const err = new Error('Administrators cannot submit seller applications');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    if (roleNames.includes(ROLES.SELLER)) {
      const err = new Error('You are already a seller');
      err.code = 'ALREADY_SELLER';
      err.statusCode = 409;
      throw err;
    }

    const existingPending =
      await this.sellerApplicationRepository.findPendingByProfileId(profileId);
    if (existingPending) {
      const err = new Error('You already have a pending application');
      err.code = 'DUPLICATE_APPLICATION';
      err.statusCode = 409;
      throw err;
    }

    const entity = new SellerApplication({
      profileId,
      businessName,
      businessDescription,
      contactPhone,
      contactEmail,
      status: SELLER_APPLICATION_STATUS.PENDING,
    });

    const created = await this.sellerApplicationRepository.create(entity);
    return SellerApplicationResponseDTO.fromEntity(created);
  }
}
