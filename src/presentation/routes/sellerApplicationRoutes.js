import { Router } from 'express';
import { ApplyAsSellerUseCase } from '../../application/use-cases/ApplyAsSellerUseCase.js';
import { GetMySellerApplicationUseCase } from '../../application/use-cases/GetMySellerApplicationUseCase.js';
import { ProfileRepository } from '../../infrastructure/persistence/repositories/ProfileRepository.js';
import { SellerApplicationRepository } from '../../infrastructure/persistence/repositories/SellerApplicationRepository.js';
import { SellerApplicationController } from '../controllers/SellerApplicationController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { applySellerSchema } from '../validators/applySellerSchema.js';

export function createSellerApplicationRouter({
  sellerApplicationRepository = new SellerApplicationRepository(),
  profileRepository = new ProfileRepository(),
  applyAsSellerUseCase,
  getMySellerApplicationUseCase,
  sellerApplicationController,
} = {}) {
  const router = Router();

  const applyUC =
    applyAsSellerUseCase ||
    new ApplyAsSellerUseCase({
      sellerApplicationRepository,
      profileRepository,
    });

  const getMeUC =
    getMySellerApplicationUseCase ||
    new GetMySellerApplicationUseCase({
      sellerApplicationRepository,
    });

  const controller =
    sellerApplicationController ||
    new SellerApplicationController({
      applyAsSellerUseCase: applyUC,
      getMySellerApplicationUseCase: getMeUC,
    });

  router.get('/me', authMiddleware, (req, res, next) => controller.getMe(req, res, next));

  router.post(
    '/',
    authMiddleware,
    validateRequest(applySellerSchema, { source: 'body' }),
    (req, res, next) => controller.apply(req, res, next)
  );

  return router;
}

export const sellerApplicationRouter = createSellerApplicationRouter();
