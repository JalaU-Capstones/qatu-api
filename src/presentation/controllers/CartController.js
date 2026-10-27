import { AddToCartRequestDTO } from '../../application/dtos/AddToCartDTO.js';

export class CartController {
  /**
   * @param {Object} deps
   * @param {import('../../application/use-cases/AddToCartUseCase.js').AddToCartUseCase} deps.addToCartUseCase
   * @param {import('../../application/use-cases/UpdateCartItemUseCase.js').UpdateCartItemUseCase} [deps.updateCartItemUseCase]
   * @param {import('../../application/use-cases/RemoveCartItemUseCase.js').RemoveCartItemUseCase} [deps.removeCartItemUseCase]
   * @param {import('../../application/use-cases/ClearCartUseCase.js').ClearCartUseCase} [deps.clearCartUseCase]
   */
  constructor({
    addToCartUseCase,
    updateCartItemUseCase,
    removeCartItemUseCase,
    clearCartUseCase,
  } = {}) {
    if (!addToCartUseCase) throw new Error('addToCartUseCase is required');
    this.addToCartUseCase = addToCartUseCase;
    this.updateCartItemUseCase = updateCartItemUseCase;
    this.removeCartItemUseCase = removeCartItemUseCase;
    this.clearCartUseCase = clearCartUseCase;
  }

  /**
   * Handles POST /v1/cart/items
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async addItem(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        const err = new Error('Authentication failed');
        err.code = 'UNAUTHORIZED';
        err.statusCode = 401;
        throw err;
      }

      const body = req.validatedBody || req.body;
      const requestDto = new AddToCartRequestDTO({
        userId,
        productId: body.product_id,
        quantity: body.quantity,
      });

      const result = await this.addToCartUseCase.execute(requestDto);

      return res.status(201).json({
        data: result.toJSON(),
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Handles PATCH /v1/cart/items/:id
   * Invokes UpdateCartItemUseCase to validate ownership, product availability,
   * and apply the quantity update.
   * @returns 200 OK with the updated CartItem schema.
   */
  async updateItem(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        const err = new Error('Authentication failed');
        err.code = 'UNAUTHORIZED';
        err.statusCode = 401;
        throw err;
      }

      const { id: cartItemId } = req.params;
      const body = req.validatedBody || req.body;

      const item = await this.updateCartItemUseCase.execute({
        userId,
        cartItemId,
        quantity: body.quantity,
      });

      return res.status(200).json({
        data: item ? item.toJSON() : null,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Handles DELETE /v1/cart/items/:id
   * Invokes RemoveCartItemUseCase to verify item ownership and remove it from the cart.
   * @returns 204 No Content.
   */
  async removeItem(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        const err = new Error('Authentication failed');
        err.code = 'UNAUTHORIZED';
        err.statusCode = 401;
        throw err;
      }

      const { id: cartItemId } = req.params;
      await this.removeCartItemUseCase.execute({ userId, cartItemId });

      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }

  async clearCart(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        const err = new Error('Authentication failed');
        err.code = 'UNAUTHORIZED';
        err.statusCode = 401;
        throw err;
      }

      await this.clearCartUseCase.execute({ userId });

      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }
}
