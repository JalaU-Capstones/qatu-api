import { Router } from 'express';
import { ListCategoriesUseCase } from '../../application/use-cases/ListCategoriesUseCase.js';
import { CategoryRepository } from '../../infrastructure/persistence/repositories/CategoryRepository.js';
import { CategoryController } from '../controllers/CategoryController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { listCategoriesSchema } from '../validators/listCategoriesSchema.js';

export function createCategoryRouter({
  categoryRepository = new CategoryRepository(),
  listCategoriesUseCase,
  categoryController,
} = {}) {
  const router = Router();

  const listUC =
    listCategoriesUseCase ||
    new ListCategoriesUseCase({
      categoryRepository,
    });

  const controller =
    categoryController ||
    new CategoryController({
      listCategoriesUseCase: listUC,
    });

  router.get('/', validateRequest(listCategoriesSchema, { source: 'query' }), (req, res, next) =>
    controller.list(req, res, next)
  );

  return router;
}

export const categoryRouter = createCategoryRouter();
