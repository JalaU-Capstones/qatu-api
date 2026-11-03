import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CreateNotificationFromEventUseCase,
  InvalidEventPayloadError,
} from '../CreateNotificationFromEventUseCase.js';

const EVENT_ID = 'e3b0c442-98fc-4c14-9afb-f4c8996fb924';
const payload = {
  order_id: '9d1e2f3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a',
  order_number: 'ORD-00100042',
  buyer_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  total: 44.99,
  currency: 'USD',
  item_count: 1,
  seller_ids: ['s1'],
};

describe('CreateNotificationFromEventUseCase', () => {
  let notificationRepository;
  let useCase;

  beforeEach(() => {
    notificationRepository = { createFromEvent: vi.fn().mockResolvedValue(true) };
    useCase = new CreateNotificationFromEventUseCase({ notificationRepository });
  });

  it('requires a notification repository', () => {
    expect(() => new CreateNotificationFromEventUseCase()).toThrow(
      'notificationRepository is required'
    );
  });

  it('creates an order_placed notification for the buyer keyed by the event id', async () => {
    const result = await useCase.execute({
      eventId: EVENT_ID,
      routingKey: 'order.placed',
      payload,
    });

    expect(result).toEqual({ status: 'created' });
    expect(notificationRepository.createFromEvent).toHaveBeenCalledWith({
      eventId: EVENT_ID,
      profileId: payload.buyer_id,
      type: 'order_placed',
      title: 'Pedido realizado',
      body: 'Tu pedido ORD-00100042 fue registrado correctamente.',
      actionUrl: '/orders',
      payload: {
        order_id: payload.order_id,
        order_number: 'ORD-00100042',
        total: 44.99,
        currency: 'USD',
      },
    });
  });

  it('reports a duplicate delivery instead of failing', async () => {
    notificationRepository.createFromEvent.mockResolvedValue(false);

    const result = await useCase.execute({
      eventId: EVENT_ID,
      routingKey: 'order.placed',
      payload,
    });

    expect(result).toEqual({ status: 'duplicate' });
  });

  it('acknowledges and ignores routing keys it does not handle yet', async () => {
    const result = await useCase.execute({
      eventId: EVENT_ID,
      routingKey: 'seller.approved',
      payload: {},
    });

    expect(result).toEqual({ status: 'ignored' });
    expect(notificationRepository.createFromEvent).not.toHaveBeenCalled();
  });

  it.each([
    ['missing event id', { routingKey: 'order.placed', payload }],
    ['missing payload', { eventId: EVENT_ID, routingKey: 'order.placed' }],
    [
      'missing buyer',
      { eventId: EVENT_ID, routingKey: 'order.placed', payload: { ...payload, buyer_id: '' } },
    ],
  ])(
    'marks a structurally invalid event (%s) as permanent so it goes to the DLQ',
    async (_n, input) => {
      const promise = useCase.execute(input);

      await expect(promise).rejects.toBeInstanceOf(InvalidEventPayloadError);
      await expect(promise).rejects.toMatchObject({ permanent: true });
      expect(notificationRepository.createFromEvent).not.toHaveBeenCalled();
    }
  );

  it('lets repository errors bubble up so the consumer can retry', async () => {
    notificationRepository.createFromEvent.mockRejectedValue(new Error('db down'));

    await expect(
      useCase.execute({ eventId: EVENT_ID, routingKey: 'order.placed', payload })
    ).rejects.toThrow('db down');
  });
});
