import { Router } from 'express';
import { GetOrderByIdUseCase } from '../../application/use-cases/GetOrderByIdUseCase.js';
import { ListOrdersUseCase } from '../../application/use-cases/ListOrdersUseCase.js';
import { OrderRepository } from '../../infrastructure/persistence/repositories/OrderRepository.js';
import { OrderController } from '../controllers/OrderController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { listOrdersSchema } from '../validators/listOrdersSchema.js';

export function createOrderRouter({
  orderRepository = new OrderRepository(),
  listOrdersUseCase,
  getOrderByIdUseCase,
  orderController,
} = {}) {
  const router = Router();

  const listUC = listOrdersUseCase || new ListOrdersUseCase({ orderRepository });
  const getByIdUC = getOrderByIdUseCase || new GetOrderByIdUseCase({ orderRepository });

  const controller =
    orderController ||
    new OrderController({
      listOrdersUseCase: listUC,
      getOrderByIdUseCase: getByIdUC,
    });

  router.get(
    '/',
    authMiddleware,
    validateRequest(listOrdersSchema, { source: 'query' }),
    (req, res, next) => controller.listOrders(req, res, next)
  );

  router.get('/:id', authMiddleware, (req, res, next) => controller.getOrderById(req, res, next));

  return router;
}

export const orderRouter = createOrderRouter();
