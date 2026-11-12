import { Router } from 'express';
import { CreateOrderUseCase } from '../../application/use-cases/CreateOrderUseCase.js';
import { GetOrderByIdUseCase } from '../../application/use-cases/GetOrderByIdUseCase.js';
import { ListOrdersUseCase } from '../../application/use-cases/ListOrdersUseCase.js';
import { UpdateOrderStatusUseCase } from '../../application/use-cases/UpdateOrderStatusUseCase.js';
import { InventoryService } from '../../domain/services/InventoryService.js';
import { OrderPricingService } from '../../domain/services/OrderPricingService.js';
import { SequelizeTransactionManager } from '../../infrastructure/persistence/SequelizeTransactionManager.js';
import { CartRepository } from '../../infrastructure/persistence/repositories/CartRepository.js';
import { OrderRepository } from '../../infrastructure/persistence/repositories/OrderRepository.js';
import { OutboxRepository } from '../../infrastructure/persistence/repositories/OutboxRepository.js';
import { PaymentRepository } from '../../infrastructure/persistence/repositories/PaymentRepository.js';
import { ProductRepository } from '../../infrastructure/persistence/repositories/ProductRepository.js';
import { ProfileRepository } from '../../infrastructure/persistence/repositories/ProfileRepository.js';
import { OrderController } from '../controllers/OrderController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { createOrderSchema } from '../validators/createOrderSchema.js';
import { listOrdersSchema } from '../validators/listOrdersSchema.js';
import { updateOrderStatusSchema } from '../validators/updateOrderStatusSchema.js';

export function createOrderRouter({
  orderRepository = new OrderRepository(),
  profileRepository = new ProfileRepository(),
  listOrdersUseCase,
  getOrderByIdUseCase,
  createOrderUseCase,
  updateOrderStatusUseCase,
  orderController,
} = {}) {
  const router = Router();

  const listUC = listOrdersUseCase || new ListOrdersUseCase({ orderRepository, profileRepository });
  const getByIdUC =
    getOrderByIdUseCase || new GetOrderByIdUseCase({ orderRepository, profileRepository });
  const createUC = createOrderUseCase || buildDefaultCreateOrderUseCase({ orderRepository });
  const updateStatusUC =
    updateOrderStatusUseCase ||
    new UpdateOrderStatusUseCase({
      orderRepository,
      outboxRepository: new OutboxRepository(),
      transactionManager: new SequelizeTransactionManager(),
      profileRepository,
    });

  const controller =
    orderController ||
    new OrderController({
      listOrdersUseCase: listUC,
      getOrderByIdUseCase: getByIdUC,
      createOrderUseCase: createUC,
      updateOrderStatusUseCase: updateStatusUC,
    });

  // POST /v1/orders — CSRF via global middleware for cookie sessions.
  router.post('/', authMiddleware, validateRequest(createOrderSchema), (req, res, next) =>
    controller.createOrder(req, res, next)
  );

  router.get(
    '/',
    authMiddleware,
    validateRequest(listOrdersSchema, { source: 'query' }),
    (req, res, next) => controller.listOrders(req, res, next)
  );

  router.patch(
    '/:id/status',
    authMiddleware,
    validateRequest(updateOrderStatusSchema),
    (req, res, next) => controller.updateOrderStatus(req, res, next)
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
