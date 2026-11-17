import { Router } from 'express';
import { AdminListSellerApplicationsUseCase } from '../../application/use-cases/AdminListSellerApplicationUseCase.js';
import { AdminReviewSellerApplicationUseCase } from '../../application/use-cases/AdminReviewSellerApplicationUseCase.js';
import { SequelizeTransactionManager } from '../../infrastructure/persistence/SequelizeTransactionManager.js';
import { OutboxRepository } from '../../infrastructure/persistence/repositories/OutboxRepository.js';
import { ProfileRepository } from '../../infrastructure/persistence/repositories/ProfileRepository.js';
import { SellerApplicationRepository } from '../../infrastructure/persistence/repositories/SellerApplicationRepository.js';
import { AdminSellerApplicationController } from '../controllers/AdminSellerApplicationController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireAdminRole } from '../middleware/requireAdminRole.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  adminListSellerApplicationsQuerySchema,
  adminReviewSellerApplicationBodySchema,
  adminReviewSellerApplicationParamsSchema,
} from '../validators/adminSellerApplicationSchema.js';

export function createAdminSellerApplicationRouter({
  sellerApplicationRepository = new SellerApplicationRepository(),
  profileRepository = new ProfileRepository(),
  outboxRepository = new OutboxRepository(),
  transactionManager = new SequelizeTransactionManager(),
  adminListSellerApplicationsUseCase,
  adminReviewSellerApplicationUseCase,
  adminSellerApplicationController,
} = {}) {
  const router = Router();
  const adminOnly = requireAdminRole({ profileRepository });

  const listUC =
    adminListSellerApplicationsUseCase ||
    new AdminListSellerApplicationsUseCase({ sellerApplicationRepository });

  const reviewUC =
    adminReviewSellerApplicationUseCase ||
    new AdminReviewSellerApplicationUseCase({
      sellerApplicationRepository,
      profileRepository,
      outboxRepository,
      transactionManager,
    });

  const controller =
    adminSellerApplicationController ||
    new AdminSellerApplicationController({
      adminListSellerApplicationsUseCase: listUC,
      adminReviewSellerApplicationUseCase: reviewUC,
    });

  router.get(
    '/',
    authMiddleware,
    adminOnly,
    validateRequest(adminListSellerApplicationsQuerySchema, { source: 'query' }),
    (req, res, next) => controller.list(req, res, next)
  );

  router.patch(
    '/:applicationId',
    authMiddleware,
    adminOnly,
    validateRequest(adminReviewSellerApplicationParamsSchema, { source: 'params' }),
    validateRequest(adminReviewSellerApplicationBodySchema, { source: 'body' }),
    (req, res, next) => controller.review(req, res, next)
  );

  return router;
}

export const adminSellerApplicationRouter = createAdminSellerApplicationRouter();
