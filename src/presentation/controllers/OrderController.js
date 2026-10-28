import { ListOrdersRequestDTO } from '../../application/dtos/OrderDTO.js';

export class OrderController {
  /**
   * @param {Object} deps
   * @param {import('../../application/use-cases/ListOrdersUseCase.js').ListOrdersUseCase} deps.listOrdersUseCase
   * @param {import('../../application/use-cases/GetOrderByIdUseCase.js').GetOrderByIdUseCase} [deps.getOrderByIdUseCase]
   */
  constructor({ listOrdersUseCase, getOrderByIdUseCase } = {}) {
    if (!listOrdersUseCase) {
      throw new Error('listOrdersUseCase is required');
    }
    this.listOrdersUseCase = listOrdersUseCase;
    this.getOrderByIdUseCase = getOrderByIdUseCase;
  }

  /**
   * Handles GET /v1/orders
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async listOrders(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        const err = new Error('Authentication failed');
        err.code = 'UNAUTHORIZED';
        err.statusCode = 401;
        throw err;
      }

      const query = req.validatedQuery || req.query || {};
      const requestDto = new ListOrdersRequestDTO({
        buyerId: userId,
        page: query.page,
        limit: query.limit,
        status: query.status,
      });

      const result = await this.listOrdersUseCase.execute(requestDto);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Handles GET /v1/orders/:id
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async getOrderById(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        const err = new Error('Authentication failed');
        err.code = 'UNAUTHORIZED';
        err.statusCode = 401;
        throw err;
      }

      if (!this.getOrderByIdUseCase) {
        const err = new Error('getOrderByIdUseCase is not configured');
        err.statusCode = 500;
        throw err;
      }

      const orderId = req.params.id;
      const result = await this.getOrderByIdUseCase.execute({
        orderId,
        userId,
        userRole: req.user?.role,
      });

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}

