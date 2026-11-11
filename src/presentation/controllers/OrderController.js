import { CreateOrderRequestDTO } from '../../application/dtos/CreateOrderDTO.js';
import { ListOrdersRequestDTO } from '../../application/dtos/OrderDTO.js';

export class OrderController {
  /** @param {{ listOrdersUseCase: object, getOrderByIdUseCase?: object, createOrderUseCase?: object, updateOrderStatusUseCase?: object }} deps */
  constructor({
    listOrdersUseCase,
    getOrderByIdUseCase,
    createOrderUseCase,
    updateOrderStatusUseCase,
  } = {}) {
    if (!listOrdersUseCase) {
      throw new Error('listOrdersUseCase is required');
    }
    this.listOrdersUseCase = listOrdersUseCase;
    this.getOrderByIdUseCase = getOrderByIdUseCase;
    this.createOrderUseCase = createOrderUseCase;
    this.updateOrderStatusUseCase = updateOrderStatusUseCase;
  }

  /** POST /v1/orders — buyer from session only. */
  async createOrder(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        const err = new Error('Authentication failed');
        err.code = 'UNAUTHORIZED';
        err.statusCode = 401;
        throw err;
      }

      if (!this.createOrderUseCase) {
        const err = new Error('createOrderUseCase is not configured');
        err.statusCode = 500;
        throw err;
      }

      const body = req.validatedBody || req.body || {};
      const requestDto = new CreateOrderRequestDTO({
        buyerId: userId,
        shippingAddress: body.shipping_address,
        paymentMethod: body.payment_method,
        notes: body.notes,
      });

      const result = await this.createOrderUseCase.execute(requestDto);
      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  }

  /** GET /v1/orders */
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
        userId,
        page: query.page,
        limit: query.limit,
        status: query.status,
        view: query.view,
      });

      const result = await this.listOrdersUseCase.execute(requestDto);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  /** GET /v1/orders/:id */
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
      const result = await this.getOrderByIdUseCase.execute({ orderId, userId });

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  /** PATCH /v1/orders/:id/status */
  async updateOrderStatus(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        const err = new Error('Authentication failed');
        err.code = 'UNAUTHORIZED';
        err.statusCode = 401;
        throw err;
      }

      if (!this.updateOrderStatusUseCase) {
        const err = new Error('updateOrderStatusUseCase is not configured');
        err.statusCode = 500;
        throw err;
      }

      const body = req.validatedBody || req.body || {};
      const result = await this.updateOrderStatusUseCase.execute({
        orderId: req.params.id,
        userId,
        nextStatus: body.status,
      });

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}
