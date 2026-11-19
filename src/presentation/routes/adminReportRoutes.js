import { Router } from 'express';

import { GetAdminProductsReportUseCase } from '../../application/use-cases/GetAdminProductsReportUseCase.js';
import { GetAdminSalesReportUseCase } from '../../application/use-cases/GetAdminSalesReportUseCase.js';
import { GetAdminUsersReportUseCase } from '../../application/use-cases/GetAdminUsersReportUseCase.js';
import { AdminReportRepository } from '../../infrastructure/persistence/repositories/AdminReportRepository.js';
import { ProfileRepository } from '../../infrastructure/persistence/repositories/ProfileRepository.js';
import { AdminReportController } from '../controllers/AdminReportController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireAdminRole } from '../middleware/requireAdminRole.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  adminReportRangeQuerySchema,
  adminSalesReportQuerySchema,
} from '../validators/adminReportSchema.js';

export function createAdminReportRouter({
  adminReportRepository = new AdminReportRepository(),
  profileRepository = new ProfileRepository(),
  getSalesReportUseCase,
  getUsersReportUseCase,
  getProductsReportUseCase,
  adminReportController,
} = {}) {
  const router = Router();
  const adminOnly = requireAdminRole({ profileRepository });

  const salesUseCase =
    getSalesReportUseCase || new GetAdminSalesReportUseCase({ adminReportRepository });
  const usersUseCase =
    getUsersReportUseCase || new GetAdminUsersReportUseCase({ adminReportRepository });
  const productsUseCase =
    getProductsReportUseCase || new GetAdminProductsReportUseCase({ adminReportRepository });

  const controller =
    adminReportController ||
    new AdminReportController({
      getSalesReportUseCase: salesUseCase,
      getUsersReportUseCase: usersUseCase,
      getProductsReportUseCase: productsUseCase,
    });

  router.get(
    '/sales',
    authMiddleware,
    adminOnly,
    validateRequest(adminSalesReportQuerySchema, { source: 'query' }),
    (req, res, next) => controller.sales(req, res, next)
  );

  router.get(
    '/users',
    authMiddleware,
    adminOnly,
    validateRequest(adminReportRangeQuerySchema, { source: 'query' }),
    (req, res, next) => controller.users(req, res, next)
  );

  router.get(
    '/products',
    authMiddleware,
    adminOnly,
    validateRequest(adminReportRangeQuerySchema, { source: 'query' }),
    (req, res, next) => controller.products(req, res, next)
  );

  return router;
}

export const adminReportRouter = createAdminReportRouter();
