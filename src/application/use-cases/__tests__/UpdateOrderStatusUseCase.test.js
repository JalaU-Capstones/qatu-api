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
    roles = ['seller'],
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
        roles: roles.map((name) => ({ name })),
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

  describe('ownership (seller needs ≥1 own line item)', () => {
    it('checks line-item ownership against the order and the authenticated seller', async () => {
      const { useCase, orderRepository } = buildUseCase();

      await useCase.execute({ orderId, userId: sellerId, nextStatus: 'shipped' });

      expect(orderRepository.sellerHasItemsOnOrder).toHaveBeenCalledWith(orderId, sellerId);
    });

    it('a seller with no items on the order changes nothing and emits no event', async () => {
      const { useCase, orderRepository, outboxRepository, transactionManager } = buildUseCase({
        sellerOwns: false,
      });

      await expect(
        useCase.execute({ orderId, userId: otherSellerId, nextStatus: 'shipped' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });

      expect(transactionManager.run).not.toHaveBeenCalled();
      expect(orderRepository.updateStatus).not.toHaveBeenCalled();
      expect(outboxRepository.enqueue).not.toHaveBeenCalled();
    });

    it('returns 404 when the order does not exist (not 403)', async () => {
      const { useCase, orderRepository } = buildUseCase();
      orderRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ orderId, userId: sellerId, nextStatus: 'shipped' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('lets the buyer cancel a pending order they placed', async () => {
      const { useCase, orderRepository } = buildUseCase({
        order: baseOrder('pending'),
        sellerOwns: false,
        roles: ['buyer'],
        updated: baseOrder('cancelled'),
      });

      const result = await useCase.execute({ orderId, userId: buyerId, nextStatus: 'cancelled' });

      expect(result.data.status).toBe('cancelled');
      expect(orderRepository.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ timestampColumn: 'cancelled_at', itemsSellerId: null })
      );
    });
  });

  describe('terminal states are immutable for every actor', () => {
    it.each([
      ['delivered', 'seller', 'cancelled'],
      ['cancelled', 'seller', 'confirmed'],
      ['delivered', 'admin', 'shipped'],
      ['cancelled', 'admin', 'pending'],
      ['delivered', 'buyer', 'cancelled'],
      ['cancelled', 'buyer', 'pending'],
    ])('%s order: %s cannot move it to %s', async (from, actor, to) => {
      const isBuyer = actor === 'buyer';
      const { useCase, orderRepository, outboxRepository } = buildUseCase({
        order: baseOrder(from),
        sellerOwns: actor === 'seller',
        roles: [actor],
      });

      await expect(
        useCase.execute({ orderId, userId: isBuyer ? buyerId : sellerId, nextStatus: to })
      ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION', statusCode: 422 });

      expect(orderRepository.updateStatus).not.toHaveBeenCalled();
      expect(outboxRepository.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('role trust', () => {
    it('ignores a caller-supplied role claim: only user_roles decides (no privilege escalation)', async () => {
      const { useCase, orderRepository } = buildUseCase({
        sellerOwns: false,
        roles: ['buyer'],
      });

      // Stranger (not the buyer, owns no items) forging `admin` must still get 403.
      await expect(
        useCase.execute({
          orderId,
          userId: otherSellerId,
          nextStatus: 'shipped',
          userRole: 'admin',
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
      expect(orderRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('multi-seller visibility in the response', () => {
    it("scopes the returned items to the acting seller's own line items", async () => {
      const { useCase, orderRepository } = buildUseCase();

      await useCase.execute({ orderId, userId: sellerId, nextStatus: 'shipped' });

      expect(orderRepository.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ itemsSellerId: sellerId })
      );
    });

    it('does not scope items for an admin (full order)', async () => {
      const { useCase, orderRepository } = buildUseCase({ sellerOwns: false, roles: ['admin'] });

      await useCase.execute({ orderId, userId: otherSellerId, nextStatus: 'shipped' });

      expect(orderRepository.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ itemsSellerId: null })
      );
    });
  });

  it('enqueues a PII-free OrderStatusChanged payload', async () => {
    const { useCase, outboxRepository } = buildUseCase();

    await useCase.execute({ orderId, userId: sellerId, nextStatus: 'shipped' });

    const [event] = outboxRepository.enqueue.mock.calls[0];
    expect(Object.keys(event.payload).sort()).toEqual([
      'buyer_id',
      'changed_by',
      'from_status',
      'order_id',
      'order_number',
      'to_status',
    ]);
  });
});
