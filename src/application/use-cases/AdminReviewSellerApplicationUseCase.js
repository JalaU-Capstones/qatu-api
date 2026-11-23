import { ROLES } from '../../domain/constants/roles.js';
import { SELLER_APPLICATION_STATUS } from '../../domain/entities/SellerApplication.js';
import {
  buildSellerApprovedEvent,
  buildSellerRejectedEvent,
} from '../../domain/events/SellerApplicationReviewed.js';
import { SellerApplicationResponseDTO } from '../dtos/SellerApplicationDTO.js';

export class AdminReviewSellerApplicationUseCase {
  constructor({
    sellerApplicationRepository,
    profileRepository,
    outboxRepository,
    transactionManager,
  }) {
    if (!sellerApplicationRepository) throw new Error('sellerApplicationRepository is required');
    if (!profileRepository) throw new Error('profileRepository is required');
    if (!outboxRepository) throw new Error('outboxRepository is required');
    if (!transactionManager) throw new Error('transactionManager is required');

    this.sellerApplicationRepository = sellerApplicationRepository;
    this.profileRepository = profileRepository;
    this.outboxRepository = outboxRepository;
    this.transactionManager = transactionManager;
  }

  async execute({ applicationId, adminUserId, status, rejectionReason = null }) {
    const existing = await this.sellerApplicationRepository.findById(applicationId);
    if (!existing) {
      const err = new Error('Seller application not found');
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (existing.status !== SELLER_APPLICATION_STATUS.PENDING) {
      const err = new Error('This application has already been reviewed.');
      err.code = 'ALREADY_REVIEWED';
      err.statusCode = 422;
      throw err;
    }

    const updated = await this.transactionManager.run(async (transaction) => {
      const reviewed = await this.sellerApplicationRepository.review(
        {
          id: applicationId,
          status,
          reviewedBy: adminUserId,
          rejectionReason: status === SELLER_APPLICATION_STATUS.REJECTED ? rejectionReason : null,
        },
        { transaction }
      );

      if (!reviewed) {
        const err = new Error('This application has already been reviewed.');
        err.code = 'ALREADY_REVIEWED';
        err.statusCode = 422;
        throw err;
      }

      if (status === SELLER_APPLICATION_STATUS.APPROVED) {
        await this.profileRepository.assignRole(reviewed.profileId, ROLES.SELLER, {
          assignedBy: adminUserId,
          transaction,
        });

        await this.outboxRepository.enqueue(
          buildSellerApprovedEvent({
            application: reviewed,
            reviewedBy: adminUserId,
          }),
          { transaction }
        );
      } else {
        await this.outboxRepository.enqueue(
          buildSellerRejectedEvent({
            application: reviewed,
            reviewedBy: adminUserId,
            rejectionReason: reviewed.rejectionReason,
          }),
          { transaction }
        );
      }

      return reviewed;
    });

    return SellerApplicationResponseDTO.fromEntity(updated);
  }
}
