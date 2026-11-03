import { Router } from 'express';
import { CreateOrderUseCase } from '../../application/use-cases/CreateOrderUseCase.js';
import { GetOrderByIdUseCase } from '../../application/use-cases/GetOrderByIdUseCase.js';
import { ListOrdersUseCase } from '../../application/use-cases/ListOrdersUseCase.js';
import { InventoryService } from '../../domain/services/InventoryService.js';
import { OrderPricingService } from '../../domain/services/OrderPricingService.js';
import { SequelizeTransactionManager } from '../../infrastructure/persistence/SequelizeTransactionManager.js';
import { CartRepository } from '../../infrastructure/persistence/repositories/CartRepository.js';
import { OrderRepository } from '../../infrastructure/persistence/repositories/OrderRepository.js';
import { OutboxRepository } from '../../infrastructure/persistence/repositories/OutboxRepository.js';
import { PaymentRepository } from '../../infrastructure/persistence/repositories/PaymentRepository.js';
import { ProductRepository } from '../../infrastructure/persistence/repositories/ProductRepository.js';
import { OrderController } from '../controllers/OrderController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { createOrderSchema } from '../validators/createOrderSchema.js';
import { listOrdersSchema } from '../validators/listOrdersSchema.js';

export function createOrderRouter({
  orderRepository = new OrderRepository(),
  listOrdersUseCase,
  getOrderByIdUseCase,
  createOrderUseCase,
  orderController,
} = {}) {
  const router = Router();

  const listUC = listOrdersUseCase || new ListOrdersUseCase({ orderRepository });
  const getByIdUC = getOrderByIdUseCase || new GetOrderByIdUseCase({ orderRepository });
  const createUC = createOrderUseCase || buildDefaultCreateOrderUseCase({ orderRepository });

  const controller =
    orderController ||
    new OrderController({
      listOrdersUseCase: listUC,
      getOrderByIdUseCase: getByIdUC,
      createOrderUseCase: createUC,
    });

  // POST /v1/orders — checkout. Cookie-authenticated requests are also checked
  // by the global csrfMiddleware (X-CSRF-Token must match the csrf_token cookie).
  router.post('/', authMiddleware, validateRequest(createOrderSchema), (req, res, next) =>
    controller.createOrder(req, res, next)
  );

  router.get(
    '/',
    authMiddleware,
    validateRequest(listOrdersSchema, { source: 'query' }),
    (req, res, next) => controller.listOrders(req, res, next)
  );

  router.get('/:id', authMiddleware, (req, res, next) => controller.getOrderById(req, res, next));

  return router;
}

function buildDefaultCreateOrderUseCase({ orderRepository }) {
  return new CreateOrderUseCase({
    transactionManager: new SequelizeTransactionManager(),
    cartRepository: new CartRepository(),
    inventoryService: new InventoryService({ productRepository: new ProductRepository() }),
    pricingService: new OrderPricingService(),
    orderRepository,
    paymentRepository: new PaymentRepository(),
    outboxRepository: new OutboxRepository(),
  });
}

export const orderRouter = createOrderRouter();
