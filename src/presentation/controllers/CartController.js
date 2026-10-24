import { AddToCartRequestDTO } from '../../application/dtos/AddToCartDTO.js';

export class CartController {
  /**
   * @param {Object} deps
   * @param {import('../../application/use-cases/AddToCartUseCase.js').AddToCartUseCase} deps.addToCartUseCase
   */
  constructor({ addToCartUseCase } = {}) {
    if (!addToCartUseCase) throw new Error('addToCartUseCase is required');
    this.addToCartUseCase = addToCartUseCase;
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
}
