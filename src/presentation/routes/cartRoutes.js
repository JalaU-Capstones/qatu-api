import { Router } from 'express';
import { AddToCartUseCase } from '../../application/use-cases/AddToCartUseCase.js';
import { ClearCartUseCase } from '../../application/use-cases/ClearCartUseCase.js';
import { RemoveCartItemUseCase } from '../../application/use-cases/RemoveCartItemUseCase.js';
import { UpdateCartItemUseCase } from '../../application/use-cases/UpdateCartItemUseCase.js';
import { CartRepository } from '../../infrastructure/persistence/repositories/CartRepository.js';
import { ProductRepository } from '../../infrastructure/persistence/repositories/ProductRepository.js';
import { CartController } from '../controllers/CartController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { addToCartSchema } from '../validators/addToCartSchema.js';
import { updateCartItemSchema } from '../validators/updateCartItemSchema.js';

export function createCartRouter({
  cartRepository = new CartRepository(),
  productRepository = new ProductRepository(),
  addToCartUseCase,
  updateCartItemUseCase,
  removeCartItemUseCase,
  clearCartUseCase,
  cartController,
} = {}) {
  const router = Router();

  const addUC = addToCartUseCase || new AddToCartUseCase({ cartRepository, productRepository });
  const updateUC =
    updateCartItemUseCase || new UpdateCartItemUseCase({ cartRepository, productRepository });
  const removeUC = removeCartItemUseCase || new RemoveCartItemUseCase({ cartRepository });
  const clearUC = clearCartUseCase || new ClearCartUseCase({ cartRepository });

  const controller =
    cartController ||
    new CartController({
      addToCartUseCase: addUC,
      updateCartItemUseCase: updateUC,
      removeCartItemUseCase: removeUC,
      clearCartUseCase: clearUC,
    });

  router.post(
    '/items',
    authMiddleware,
    validateRequest(addToCartSchema, { source: 'body' }),
    (req, res, next) => controller.addItem(req, res, next)
  );

  router.patch(
    '/items/:productId',
    authMiddleware,
    validateRequest(updateCartItemSchema, { source: 'body' }),
    (req, res, next) => controller.updateItem(req, res, next)
  );

  router.delete('/items/:productId', authMiddleware, (req, res, next) =>
    controller.removeItem(req, res, next)
  );

  router.delete('/', authMiddleware, (req, res, next) => controller.clearCart(req, res, next));

  return router;
}

export const cartRouter = createCartRouter();
