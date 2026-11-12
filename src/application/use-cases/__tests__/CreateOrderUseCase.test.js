import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Order } from '../../../domain/entities/Order.js';
import {
  EmptyCartError,
  InsufficientStockError,
  ProductUnavailableError,
} from '../../../domain/errors/CheckoutErrors.js';
import { InventoryService } from '../../../domain/services/InventoryService.js';
import { OrderPricingService } from '../../../domain/services/OrderPricingService.js';
import { CreateOrderRequestDTO } from '../../dtos/CreateOrderDTO.js';
import { CreateOrderUseCase } from '../CreateOrderUseCase.js';

const BUYER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ORDER_ID = '9d1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a';
const SELLER_1 = '11111111-1111-4111-8111-111111111111';
const SELLER_2 = '22222222-2222-4222-8222-222222222222';

const line = (overrides = {}) => ({
  cartItemId: 'ci-1',
  productId: 'p-1',
  sellerId: SELLER_1,
  name: 'Clean Code',
  unitPrice: 20,
  currency: 'USD',
  quantity: 2,
  imagePath: 'img/clean-code.webp',
  isAvailable: true,
  ...overrides,
});

const buildOrder = () =>
  new Order({
    id: ORDER_ID,
    orderNumber: 'ORD-00100042',
    buyerId: BUYER_ID,
    status: 'pending',
    currency: 'USD',
    subtotal: 40,
    shippingCost: 4.99,
    tax: 0,
    total: 44.99,
    shippingAddress: { street: '123 Main St', city: 'La Paz', country: 'BO' },
    items: [
      {
        id: 'oi-1',
        orderId: ORDER_ID,
        productId: 'p-1',
        productName: 'Clean Code',
        quantity: 2,
        unitPrice: 20,
      },
    ],
  });

describe('CreateOrderUseCase', () => {
  const transaction = { id: 'tx-1' };
  let deps;
  let useCase;
  let request;

  beforeEach(() => {
    deps = {
      transactionManager: { run: vi.fn(async (work) => work(transaction)) },
      cartRepository: {
        findCheckoutLines: vi.fn().mockResolvedValue([line()]),
        clearCart: vi.fn().mockResolvedValue(undefined),
      },
      productRepository: { decrementStockIfAvailable: vi.fn().mockResolvedValue(3) },
      orderRepository: { createWithItems: vi.fn().mockResolvedValue(buildOrder()) },
      paymentRepository: { createPending: vi.fn().mockResolvedValue({ id: 'pay-1' }) },
      outboxRepository: { enqueue: vi.fn().mockResolvedValue('evt-1') },
    };
    deps.inventoryService = new InventoryService({ productRepository: deps.productRepository });
    deps.pricingService = new OrderPricingService();

    useCase = new CreateOrderUseCase(deps);
    request = new CreateOrderRequestDTO({
      buyerId: BUYER_ID,
      shippingAddress: {
        full_name: 'Aaron Florez',
        phone: '71234567',
        street: '123 Main St',
        city: 'La Paz',
        country: 'BO',
      },
      notes: 'Leave at reception',
    });
  });

  it('requires every dependency', () => {
    expect(() => new CreateOrderUseCase({ ...deps, outboxRepository: undefined })).toThrow(
      'outboxRepository is required'
    );
    expect(() => new CreateOrderUseCase()).toThrow('transactionManager is required');
  });

  describe('Scenario: successful checkout', () => {
    it('creates the order, payment and outbox event and clears the cart in ONE transaction', async () => {
      const result = await useCase.execute(request);

      expect(deps.transactionManager.run).toHaveBeenCalledTimes(1);
      expect(deps.cartRepository.findCheckoutLines).toHaveBeenCalledWith(BUYER_ID, {
        transaction,
      });
      expect(deps.productRepository.decrementStockIfAvailable).toHaveBeenCalledWith(
        { productId: 'p-1', quantity: 2 },
        { transaction }
      );
      expect(deps.orderRepository.createWithItems).toHaveBeenCalledWith(
        {
          buyerId: BUYER_ID,
          currency: 'USD',
          subtotal: 40,
          shippingCost: 4.99,
          tax: 0,
          total: 44.99,
          shippingAddress: {
            full_name: 'Aaron Florez',
            phone: '71234567',
            street: '123 Main St',
            city: 'La Paz',
            state: null,
            postal_code: null,
            country: 'BO',
          },
          notes: 'Leave at reception',
          items: [
            {
              productId: 'p-1',
              productName: 'Clean Code',
              productImagePath: 'img/clean-code.webp',
              quantity: 2,
              unitPrice: 20,
            },
          ],
        },
        { transaction }
      );
      expect(deps.paymentRepository.createPending).toHaveBeenCalledWith(
        { orderId: ORDER_ID, amount: 44.99, currency: 'USD', method: 'simulated' },
        { transaction }
      );
      expect(deps.outboxRepository.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'OrderPlaced',
          routingKey: 'order.placed',
          aggregateId: ORDER_ID,
        }),
        { transaction }
      );
      expect(deps.cartRepository.clearCart).toHaveBeenCalledWith(BUYER_ID, { transaction });

      expect(result.data.id).toBe(ORDER_ID);
      expect(result.data.order_number).toBe('ORD-00100042');
      expect(result.data.status).toBe('pending');
      expect(result.data.total).toBe(44.99);
      expect(result.data.items).toHaveLength(1);
      expect(result.meta.timestamp).toEqual(expect.any(String));
    });

    it('creates the payment with the payment method chosen by the buyer', async () => {
      const cashRequest = new CreateOrderRequestDTO({
        buyerId: BUYER_ID,
        shippingAddress: {
          full_name: 'Aaron Florez',
          phone: '71234567',
          street: '123 Main St',
          city: 'La Paz',
          country: 'BO',
        },
        paymentMethod: 'cash_on_delivery',
      });

      await useCase.execute(cashRequest);

      expect(deps.paymentRepository.createPending).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'cash_on_delivery' }),
        { transaction }
      );
    });

    it('enqueues an OrderPlaced payload without PII and with de-duplicated sellers', async () => {
      deps.cartRepository.findCheckoutLines.mockResolvedValue([
        line({ productId: 'p-1', sellerId: SELLER_1 }),
        line({ productId: 'p-2', sellerId: SELLER_1, name: 'DDD' }),
        line({ productId: 'p-3', sellerId: SELLER_2, name: 'Refactoring' }),
      ]);

      await useCase.execute(request);

      const [event] = deps.outboxRepository.enqueue.mock.calls[0];
      expect(event.payload.seller_ids).toEqual([SELLER_1, SELLER_2]);
      expect(event.payload.buyer_id).toBe(BUYER_ID);
      expect(JSON.stringify(event.payload)).not.toMatch(/Main St|La Paz/);
    });

    it('applies free shipping from 50 using the same rule as the cart page', async () => {
      deps.cartRepository.findCheckoutLines.mockResolvedValue([line({ unitPrice: 30 })]);

      await useCase.execute(request);

      const [params] = deps.orderRepository.createWithItems.mock.calls[0];
      expect(params.subtotal).toBe(60);
      expect(params.shippingCost).toBe(0);
      expect(params.total).toBe(60);
    });
  });

  describe('Scenario: empty cart', () => {
    it('fails with 422 EMPTY_CART and touches nothing else', async () => {
      deps.cartRepository.findCheckoutLines.mockResolvedValue([]);

      const promise = useCase.execute(request);

      await expect(promise).rejects.toBeInstanceOf(EmptyCartError);
      await expect(promise).rejects.toMatchObject({
        statusCode: 422,
        code: 'EMPTY_CART',
        message: 'Your cart is empty',
      });
      expect(deps.productRepository.decrementStockIfAvailable).not.toHaveBeenCalled();
      expect(deps.orderRepository.createWithItems).not.toHaveBeenCalled();
      expect(deps.outboxRepository.enqueue).not.toHaveBeenCalled();
      expect(deps.cartRepository.clearCart).not.toHaveBeenCalled();
    });
  });

  describe('Scenario: insufficient stock', () => {
    it('rejects with the product name, creates nothing and does NOT clear the cart', async () => {
      deps.productRepository.decrementStockIfAvailable.mockResolvedValue(null);

      const promise = useCase.execute(request);

      await expect(promise).rejects.toBeInstanceOf(InsufficientStockError);
      await expect(promise).rejects.toMatchObject({
        statusCode: 422,
        code: 'INSUFFICIENT_STOCK',
        message: 'Insufficient stock for Clean Code',
      });
      expect(deps.orderRepository.createWithItems).not.toHaveBeenCalled();
      expect(deps.paymentRepository.createPending).not.toHaveBeenCalled();
      expect(deps.outboxRepository.enqueue).not.toHaveBeenCalled();
      expect(deps.cartRepository.clearCart).not.toHaveBeenCalled();
    });

    it('rejects a product that is no longer published before touching stock', async () => {
      deps.cartRepository.findCheckoutLines.mockResolvedValue([line({ isAvailable: false })]);

      await expect(useCase.execute(request)).rejects.toBeInstanceOf(ProductUnavailableError);
      expect(deps.productRepository.decrementStockIfAvailable).not.toHaveBeenCalled();
    });
  });

  describe('Scenario: transaction failure', () => {
    it.each([
      ['order insert', (d) => d.orderRepository.createWithItems],
      ['payment insert', (d) => d.paymentRepository.createPending],
      ['outbox insert', (d) => d.outboxRepository.enqueue],
      ['cart clearing', (d) => d.cartRepository.clearCart],
    ])('propagates a database error on %s so the transaction rolls back', async (_name, pick) => {
      const dbError = new Error('connection terminated unexpectedly');
      pick(deps).mockRejectedValue(dbError);

      await expect(useCase.execute(request)).rejects.toBe(dbError);
    });

    it('never publishes to a broker itself (only the outbox worker does)', async () => {
      await useCase.execute(request);

      // The use case has no messaging dependency at all: the event only goes to the outbox.
      expect(Object.keys(deps)).not.toContain('messageBroker');
      expect(deps.outboxRepository.enqueue).toHaveBeenCalledTimes(1);
    });
  });
});
