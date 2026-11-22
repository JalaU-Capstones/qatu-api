import { SellerApplicationResponseDTO } from '../dtos/SellerApplicationDTO.js';

export class GetMySellerApplicationUseCase {
  constructor({ sellerApplicationRepository }) {
    if (!sellerApplicationRepository) {
      throw new Error('sellerApplicationRepository is required');
    }
    this.sellerApplicationRepository = sellerApplicationRepository;
  }

  async execute({ profileId }) {
    const application = await this.sellerApplicationRepository.findLatestByProfileId(profileId);
    if (!application) {
      const err = new Error('Seller application not found');
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    return SellerApplicationResponseDTO.fromEntity(application);
  }
}
