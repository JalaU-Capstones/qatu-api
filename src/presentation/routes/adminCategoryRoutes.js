import { Router } from 'express';
import { CreateCategoryUseCase } from '../../application/use-cases/CreateCategoryUseCase.js';
import { DeleteCategoryUseCase } from '../../application/use-cases/DeleteCategoryUseCase.js';
import { UpdateCategoryUseCase } from '../../application/use-cases/UpdateCategoryUseCase.js';
import { CategoryRepository } from '../../infrastructure/persistence/repositories/CategoryRepository.js';
import { ProfileRepository } from '../../infrastructure/persistence/repositories/ProfileRepository.js';
import { AdminCategoryController } from '../controllers/AdminCategoryController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireAdminRole } from '../middleware/requireAdminRole.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  adminCategoryParamsSchema,
  adminCreateCategoryBodySchema,
  adminUpdateCategoryBodySchema,
} from '../validators/adminCategorySchema.js';

export function createAdminCategoryRouter({
  categoryRepository = new CategoryRepository(),
  profileRepository = new ProfileRepository(),
  createCategoryUseCase,
  updateCategoryUseCase,
  deleteCategoryUseCase,
  adminCategoryController,
} = {}) {
  const router = Router();
  const adminOnly = requireAdminRole({ profileRepository });

  const createUC = createCategoryUseCase || new CreateCategoryUseCase({ categoryRepository });

  const updateUC = updateCategoryUseCase || new UpdateCategoryUseCase({ categoryRepository });

  const deleteUC = deleteCategoryUseCase || new DeleteCategoryUseCase({ categoryRepository });

  const controller =
    adminCategoryController ||
    new AdminCategoryController({
      createCategoryUseCase: createUC,
      updateCategoryUseCase: updateUC,
      deleteCategoryUseCase: deleteUC,
    });

  router.post(
    '/',
    authMiddleware,
    adminOnly,
    validateRequest(adminCreateCategoryBodySchema, { source: 'body' }),
    (req, res, next) => controller.create(req, res, next)
  );

  router.patch(
    '/:categoryId',
    authMiddleware,
    adminOnly,
    validateRequest(adminCategoryParamsSchema, { source: 'params' }),
    validateRequest(adminUpdateCategoryBodySchema, { source: 'body' }),
    (req, res, next) => controller.update(req, res, next)
  );

  router.delete(
    '/:categoryId',
    authMiddleware,
    adminOnly,
    validateRequest(adminCategoryParamsSchema, { source: 'params' }),
    (req, res, next) => controller.delete(req, res, next)
  );

  return router;
}

export const adminCategoryRouter = createAdminCategoryRouter();
