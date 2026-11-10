import { describe, expect, it, vi } from 'vitest';
import { Order } from '../../../domain/entities/Order.js';
import { UpdateOrderStatusUseCase } from '../UpdateOrderStatusUseCase.js';

describe('UpdateOrderStatusUseCase', () => {
  const buyerId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const sellerId = 'b1ffcd88-8b1a-4fe7-aa5c-5aa8ac270b22';
  const otherSellerId = 'c2aad099-7c2b-5ef8-bb6d-7bb9bd380c33';
  const orderId = '9d1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a';

  const baseOrder = (status = 'confirmed') =>
    new Order({
      id: orderId,
      orderNumber: 'ORD-00100042',
      buyerId,
      status,
      currency: 'USD',
      total: 100,
    });

  function buildUseCase({
    order = baseOrder('confirmed'),
    sellerOwns = true,
    updated = null,
  } = {}) {
    const orderRepository = {
      findById: vi.fn().mockResolvedValue(order),
      sellerHasItemsOnOrder: vi.fn().mockResolvedValue(sellerOwns),
      updateStatus: vi.fn().mockResolvedValue(updated || baseOrder('shipped')),
    };
    const outboxRepository = {
      enqueue: vi.fn().mockResolvedValue('evt-1'),
    };
    const transactionManager = {
      run: vi.fn(async (work) => work({ id: 'tx' })),
    };
    const profileRepository = {
      findById: vi.fn().mockResolvedValue({
        roles: [{ name: 'seller' }],
      }),
    };

    return {
      useCase: new UpdateOrderStatusUseCase({
        orderRepository,
        outboxRepository,
        transactionManager,
        profileRepository,
      }),
      orderRepository,
      outboxRepository,
      transactionManager,
    };
  }

  it('requires dependencies', () => {
    expect(() => new UpdateOrderStatusUseCase()).toThrow('orderRepository is required');
  });

  it('Scenario: Update order status confirmed → shipped and enqueues outbox', async () => {
    const { useCase, orderRepository, outboxRepository } = buildUseCase();

    const result = await useCase.execute({
      orderId,
      userId: sellerId,
      nextStatus: 'shipped',
    });

    expect(result.data.status).toBe('shipped');
    expect(orderRepository.updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId,
        status: 'shipped',
        timestampColumn: 'shipped_at',
      })
    );
    expect(outboxRepository.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'OrderStatusChanged',
        routingKey: 'order.status_changed',
        payload: expect.objectContaining({
          order_id: orderId,
          from_status: 'confirmed',
          to_status: 'shipped',
          buyer_id: buyerId,
          changed_by: sellerId,
        }),
      }),
      expect.any(Object)
    );
  });

  it('Scenario: Invalid status transition delivered → pending', async () => {
    const { useCase, orderRepository, outboxRepository } = buildUseCase({
      order: baseOrder('delivered'),
    });

    await expect(
      useCase.execute({ orderId, userId: sellerId, nextStatus: 'pending' })
    ).rejects.toMatchObject({
      code: 'INVALID_STATUS_TRANSITION',
      statusCode: 422,
      message: 'Invalid status transition',
    });
    expect(orderRepository.updateStatus).not.toHaveBeenCalled();
    expect(outboxRepository.enqueue).not.toHaveBeenCalled();
  });

  it("Scenario: Update other seller's order → 403", async () => {
    const { useCase, orderRepository } = buildUseCase({ sellerOwns: false });

    await expect(
      useCase.execute({ orderId, userId: otherSellerId, nextStatus: 'shipped' })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
    expect(orderRepository.updateStatus).not.toHaveBeenCalled();
  });
});
