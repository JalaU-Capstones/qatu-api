import { Router } from 'express';
import { CreateProductUseCase } from '../../application/use-cases/CreateProductUseCase.js';
import { GetProductByIdUseCase } from '../../application/use-cases/GetProductByIdUseCase.js';
import { ListProductsUseCase } from '../../application/use-cases/ListProductsUseCase.js';
import { ProductRepository } from '../../infrastructure/persistence/repositories/ProductRepository.js';
import { ProductController } from '../controllers/ProductController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireSellerRole } from '../middleware/requireSellerRole.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { createProductSchema } from '../validators/createProductSchema.js';
import { listProductsSchema } from '../validators/listProductsSchema.js';

export function createProductRouter({
  productRepository = new ProductRepository(),
  listProductsUseCase,
  getProductByIdUseCase,
  createProductUseCase,
  productController,
} = {}) {
  const router = Router();

  const listUC =
    listProductsUseCase ||
    new ListProductsUseCase({
      productRepository,
    });

  const getByIdUC =
    getProductByIdUseCase ||
    new GetProductByIdUseCase({
      productRepository,
    });

  const createUC =
    createProductUseCase ||
    new CreateProductUseCase({
      productRepository,
    });

  const controller =
    productController ||
    new ProductController({
      listProductsUseCase: listUC,
      getProductByIdUseCase: getByIdUC,
      createProductUseCase: createUC,
    });

  router.post(
    '/',
    authMiddleware,
    requireSellerRole(),
    validateRequest(createProductSchema, { source: 'body' }),
    (req, res, next) => controller.create(req, res, next)
  );

  router.get('/', validateRequest(listProductsSchema, { source: 'query' }), (req, res, next) =>
    controller.list(req, res, next)
  );

  router.get('/:id', (req, res, next) => controller.getById(req, res, next));

  return router;
}

export const productRouter = createProductRouter();
