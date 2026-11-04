import { Router } from 'express';
import { GetProfileByIdUseCase } from '../../application/use-cases/GetProfileByIdUseCase.js';
import { UpdateProfileUseCase } from '../../application/use-cases/UpdateProfileUseCase.js';
import { ProfileRepository } from '../../infrastructure/persistence/repositories/ProfileRepository.js';
import { ProfileController } from '../controllers/ProfileController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { updateProfileSchema } from '../validators/updateProfileSchema.js';

export function createProfileRouter({
  profileRepository = new ProfileRepository(),
  getProfileByIdUseCase,
  updateProfileUseCase,
  profileController,
} = {}) {
  const router = Router();

  const getByIdUC =
    getProfileByIdUseCase ||
    new GetProfileByIdUseCase({
      profileRepository,
    });

  const updateMeUC =
    updateProfileUseCase ||
    new UpdateProfileUseCase({
      profileRepository,
    });

  const controller =
    profileController ||
    new ProfileController({
      getProfileByIdUseCase: getByIdUC,
      updateProfileUseCase: updateMeUC,
    });

  router.patch(
    '/me',
    authMiddleware,
    validateRequest(updateProfileSchema, { source: 'body' }),
    (req, res, next) => controller.updateMe(req, res, next)
  );

  router.get('/:id', (req, res, next) => controller.getById(req, res, next));

  return router;
}

export const profileRouter = createProfileRouter();
