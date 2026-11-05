import { Router } from 'express';
import { GetProfileByIdUseCase } from '../../application/use-cases/GetProfileByIdUseCase.js';
import { UpdateProfileUseCase } from '../../application/use-cases/UpdateProfileUseCase.js';
import { UploadAvatarUseCase } from '../../application/use-cases/UploadAvatarUseCase.js';
import { ProfileRepository } from '../../infrastructure/persistence/repositories/ProfileRepository.js';
import { SupabaseStorageService } from '../../infrastructure/storage/SupabaseStorageService.js';
import { ProfileController } from '../controllers/ProfileController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { multipartAvatarMiddleware } from '../middleware/multipartAvatarMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { updateProfileSchema } from '../validators/updateProfileSchema.js';

export function createProfileRouter({
  profileRepository = new ProfileRepository(),
  storageService = new SupabaseStorageService(),
  getProfileByIdUseCase,
  updateProfileUseCase,
  uploadAvatarUseCase,
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

  const uploadAvatarUC =
    uploadAvatarUseCase ||
    new UploadAvatarUseCase({
      profileRepository,
      storageService,
    });

  const controller =
    profileController ||
    new ProfileController({
      getProfileByIdUseCase: getByIdUC,
      updateProfileUseCase: updateMeUC,
      uploadAvatarUseCase: uploadAvatarUC,
    });

  router.patch(
    '/me',
    authMiddleware,
    validateRequest(updateProfileSchema, { source: 'body' }),
    (req, res, next) => controller.updateMe(req, res, next)
  );

  router.post('/me/avatar', authMiddleware, multipartAvatarMiddleware, (req, res, next) =>
    controller.uploadAvatar(req, res, next)
  );

  router.get('/:id', (req, res, next) => controller.getById(req, res, next));

  return router;
}

export const profileRouter = createProfileRouter();
