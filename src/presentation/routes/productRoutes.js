import { Router } from 'express';
import { ListProductsUseCase } from '../../application/use-cases/ListProductsUseCase.js';
import { ProductRepository } from '../../infrastructure/persistence/repositories/ProductRepository.js';
import { ProductController } from '../controllers/ProductController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { listProductsSchema } from '../validators/listProductsSchema.js';

export function createProductRouter({
  productRepository = new ProductRepository(),
  listProductsUseCase,
  productController,
} = {}) {
  const router = Router();

  const listUC =
    listProductsUseCase ||
    new ListProductsUseCase({
      productRepository,
    });

  const controller =
    productController ||
    new ProductController({
      listProductsUseCase: listUC,
    });

  router.get('/', validateRequest(listProductsSchema, { source: 'query' }), (req, res, next) =>
    controller.list(req, res, next)
  );

  return router;
}

export const productRouter = createProductRouter();
