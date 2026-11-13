import { Router } from 'express';
import { ListSellerProductsUseCase } from '../../application/use-cases/ListSellerProductsUseCase.js';
import { ProductRepository } from '../../infrastructure/persistence/repositories/ProductRepository.js';
import { ProductController } from '../controllers/ProductController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireSellerRole } from '../middleware/requireSellerRole.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { listSellerProductsSchema } from '../validators/listSellerProductsSchema.js';

/**
 * Seller-scoped product routes (US-16).
 *
 * Mounted at `/v1/seller` in `app.js`, so:
 *   GET /v1/seller/products  →  router.get('/products', ...)
 *
 * Do NOT mount at `/v1/products` — the endpoint path is `/v1/seller/products`
 * per openapi.yaml (`/seller/products`).
 */
export function createSellerProductsRouter({
  productRepository = new ProductRepository(),
  listSellerProductsUseCase,
  productController,
} = {}) {
  const router = Router();

  const listSellerUC =
    listSellerProductsUseCase ||
    new ListSellerProductsUseCase({
      productRepository,
    });

  const controller =
    productController ||
    new ProductController({
      listProductsUseCase: null,
      listSellerProductsUseCase: listSellerUC,
      getProductByIdUseCase: null,
    });

  router.get(
    '/products',
    authMiddleware,
    requireSellerRole(),
    validateRequest(listSellerProductsSchema, { source: 'query' }),
    (req, res, next) => controller.listSellerProducts(req, res, next)
  );

  return router;
}

export const sellerProductsRouter = createSellerProductsRouter();
