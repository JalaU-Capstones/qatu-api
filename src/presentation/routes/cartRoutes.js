import { Router } from 'express';
import { AddToCartUseCase } from '../../application/use-cases/AddToCartUseCase.js';
import { CartRepository } from '../../infrastructure/persistence/repositories/CartRepository.js';
import { ProductRepository } from '../../infrastructure/persistence/repositories/ProductRepository.js';
import { CartController } from '../controllers/CartController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { addToCartSchema } from '../validators/addToCartSchema.js';

export function createCartRouter({
  cartRepository = new CartRepository(),
  productRepository = new ProductRepository(),
  addToCartUseCase,
  cartController,
} = {}) {
  const router = Router();

  const addUC = addToCartUseCase || new AddToCartUseCase({ cartRepository, productRepository });

  const controller = cartController || new CartController({ addToCartUseCase: addUC });

  router.post(
    '/items',
    authMiddleware,
    validateRequest(addToCartSchema, { source: 'body' }),
    (req, res, next) => controller.addItem(req, res, next)
  );

  return router;
}

export const cartRouter = createCartRouter();
