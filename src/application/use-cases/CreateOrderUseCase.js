import { EmptyCartError, ProductUnavailableError } from '../../domain/errors/CheckoutErrors.js';
import { buildOrderPlacedEvent } from '../../domain/events/OrderPlaced.js';
import { OrderDetailDTO } from '../dtos/OrderDTO.js';

/**
 * Checkout: cart → order in one transaction (stock, payment, outbox event, empty cart).
 * Any failure rolls everything back and keeps the cart; RabbitMQ is never touched here.
 */
export class CreateOrderUseCase {
  constructor({
    transactionManager,
    cartRepository,
    inventoryService,
    pricingService,
    orderRepository,
    paymentRepository,
    outboxRepository,
  } = {}) {
    const dependencies = {
      transactionManager,
      cartRepository,
      inventoryService,
      pricingService,
      orderRepository,
      paymentRepository,
      outboxRepository,
    };
    for (const [name, dependency] of Object.entries(dependencies)) {
      if (!dependency) throw new Error(`${name} is required`);
    }

    this.transactionManager = transactionManager;
    this.cartRepository = cartRepository;
    this.inventoryService = inventoryService;
    this.pricingService = pricingService;
    this.orderRepository = orderRepository;
    this.paymentRepository = paymentRepository;
    this.outboxRepository = outboxRepository;
  }

  async execute(requestDto) {
    const order = await this.transactionManager.run(async (transaction) => {
      const lines = await this.cartRepository.findCheckoutLines(requestDto.buyerId, {
        transaction,
      });
      if (lines.length === 0) {
        throw new EmptyCartError();
      }

      const unavailable = lines.find((line) => !line.isAvailable);
      if (unavailable) {
        throw new ProductUnavailableError({
          productId: unavailable.productId,
          productName: unavailable.name,
        });
      }

      const pricing = this.pricingService.calculate(lines);

      await this.inventoryService.reserve(lines, { transaction });

      const created = await this.orderRepository.createWithItems(
        {
          buyerId: requestDto.buyerId,
          ...pricing,
          shippingAddress: requestDto.shippingAddress,
          notes: requestDto.notes,
          items: lines.map((line) => ({
            productId: line.productId,
            productName: line.name,
            productImagePath: line.imagePath,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
          })),
        },
        { transaction }
      );

      await this.paymentRepository.createPending(
        {
          orderId: created.id,
          amount: created.total,
          currency: created.currency,
          method: requestDto.paymentMethod,
        },
        { transaction }
      );

      await this.outboxRepository.enqueue(
        buildOrderPlacedEvent({ order: created, sellerIds: lines.map((line) => line.sellerId) }),
        { transaction }
      );

      await this.cartRepository.clearCart(requestDto.buyerId, { transaction });

      return created;
    });

    return {
      data: new OrderDetailDTO(order).toJSON(),
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
