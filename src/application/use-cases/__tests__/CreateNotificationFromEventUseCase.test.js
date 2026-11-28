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
      actionUrl: '/orders/ORD-00100042',
      payload: {
        order_id: payload.order_id,
        order_number: 'ORD-00100042',
        total: 44.99,
        currency: 'USD',
      },
    });
  });

  it('notifies every seller on a new order once, never the buyer twice', async () => {
    await useCase.execute({
      eventId: EVENT_ID,
      routingKey: 'order.placed',
      payload: { ...payload, seller_ids: ['s1', 's2', 's1', payload.buyer_id, ''] },
    });

    const recipients = notificationRepository.createFromEvent.mock.calls.map(
      ([call]) => call.profileId
    );
    expect(recipients).toEqual([payload.buyer_id, 's1', 's2']);
    expect(notificationRepository.createFromEvent).toHaveBeenCalledWith({
      eventId: EVENT_ID,
      profileId: 's2',
      type: 'order_placed',
      title: 'Nuevo pedido recibido',
      body: 'Recibiste el pedido ORD-00100042 con productos de tu tienda.',
      actionUrl: '/seller/orders',
      payload: { order_id: payload.order_id, order_number: 'ORD-00100042' },
    });
  });

  it('reports created when only some recipients were new', async () => {
    notificationRepository.createFromEvent.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const result = await useCase.execute({
      eventId: EVENT_ID,
      routingKey: 'order.placed',
      payload,
    });

    expect(result).toEqual({ status: 'created' });
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

  it('creates an order_status_changed notification for the buyer', async () => {
    const statusPayload = {
      order_id: payload.order_id,
      order_number: payload.order_number,
      buyer_id: payload.buyer_id,
      from_status: 'confirmed',
      to_status: 'shipped',
      changed_by: '00000000-0000-4000-8000-000000000002',
    };

    const result = await useCase.execute({
      eventId: EVENT_ID,
      routingKey: 'order.status_changed',
      payload: statusPayload,
    });

    expect(result).toEqual({ status: 'created' });
    expect(notificationRepository.createFromEvent).toHaveBeenCalledWith({
      eventId: EVENT_ID,
      profileId: payload.buyer_id,
      type: 'order_status_changed',
      title: 'Pedido enviado',
      body: 'Tu pedido ORD-00100042 ahora está enviado.',
      actionUrl: '/orders/ORD-00100042',
      payload: {
        order_id: payload.order_id,
        order_number: payload.order_number,
        from_status: 'confirmed',
        to_status: 'shipped',
        changed_by: '00000000-0000-4000-8000-000000000002',
      },
    });
  });

  it('notifies the buyer and the other sellers, never the seller who changed the status', async () => {
    const actor = 's1';
    await useCase.execute({
      eventId: EVENT_ID,
      routingKey: 'order.status_changed',
      payload: {
        order_id: payload.order_id,
        order_number: payload.order_number,
        buyer_id: payload.buyer_id,
        from_status: 'pending',
        to_status: 'confirmed',
        changed_by: actor,
        seller_ids: [actor, 's2'],
      },
    });

    const calls = notificationRepository.createFromEvent.mock.calls.map(([call]) => call);
    expect(calls.map((call) => call.profileId)).toEqual([payload.buyer_id, 's2']);
    expect(calls[0]).toMatchObject({
      title: 'Pedido confirmado',
      actionUrl: '/orders/ORD-00100042',
    });
    expect(calls[1]).toMatchObject({
      title: 'Pedido confirmado',
      body: 'El pedido ORD-00100042 ahora está confirmado.',
      actionUrl: '/seller/orders',
    });
  });

  it('tells the sellers when the buyer cancels, without notifying the buyer', async () => {
    await useCase.execute({
      eventId: EVENT_ID,
      routingKey: 'order.status_changed',
      payload: {
        order_id: payload.order_id,
        order_number: payload.order_number,
        buyer_id: payload.buyer_id,
        from_status: 'pending',
        to_status: 'cancelled',
        changed_by: payload.buyer_id,
        seller_ids: ['s1'],
      },
    });

    expect(notificationRepository.createFromEvent).toHaveBeenCalledTimes(1);
    expect(notificationRepository.createFromEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 's1',
        title: 'Pedido cancelado',
        body: 'El comprador canceló el pedido ORD-00100042.',
      })
    );
  });

  it('ignores a status change with nobody left to notify', async () => {
    const result = await useCase.execute({
      eventId: EVENT_ID,
      routingKey: 'order.status_changed',
      payload: {
        order_id: payload.order_id,
        buyer_id: payload.buyer_id,
        from_status: 'pending',
        to_status: 'cancelled',
        changed_by: payload.buyer_id,
      },
    });

    expect(result).toEqual({ status: 'ignored' });
    expect(notificationRepository.createFromEvent).not.toHaveBeenCalled();
  });

  it.each([
    ['p-1', 'uno de tus productos'],
    [null, 'tu tienda'],
  ])(
    'creates a rating_received notification for the seller (product %j)',
    async (productId, target) => {
      const result = await useCase.execute({
        eventId: EVENT_ID,
        routingKey: 'rating.received',
        payload: {
          rating_id: 'r-1',
          seller_id: 's1',
          product_id: productId,
          order_id: 'o-1',
          score: 4,
        },
      });

      expect(result).toEqual({ status: 'created' });
      expect(notificationRepository.createFromEvent).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        profileId: 's1',
        type: 'rating_received',
        title: 'Nueva calificación recibida',
        body: `Recibiste una calificación de 4 de 5 estrellas para ${target}.`,
        actionUrl: null,
        payload: { rating_id: 'r-1', product_id: productId, order_id: 'o-1', score: 4 },
      });
    }
  );

  it.each([
    [{ seller_id: 's1', score: 4 }],
    [{ rating_id: 'r-1', score: 4 }],
    [{ rating_id: 'r-1', seller_id: 's1', score: 6 }],
    [{ rating_id: 'r-1', seller_id: 's1', score: 2.5 }],
    [undefined],
  ])('marks an invalid rating.received payload %j as permanent', async (eventPayload) => {
    await expect(
      useCase.execute({ eventId: EVENT_ID, routingKey: 'rating.received', payload: eventPayload })
    ).rejects.toMatchObject({ permanent: true, message: 'rating.received payload is incomplete' });
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

  it('marks an incomplete order.status_changed payload as permanent', async () => {
    await expect(
      useCase.execute({
        eventId: EVENT_ID,
        routingKey: 'order.status_changed',
        payload: { order_id: payload.order_id },
      })
    ).rejects.toMatchObject({
      name: 'InvalidEventPayloadError',
      permanent: true,
      message: 'order.status_changed payload is incomplete',
    });
    expect(notificationRepository.createFromEvent).not.toHaveBeenCalled();
  });

  it('creates a seller_approved notification for the applicant', async () => {
    const result = await useCase.execute({
      eventId: EVENT_ID,
      routingKey: 'seller_application.approved',
      payload: { application_id: 'app-1', profile_id: 'profile-1' },
    });

    expect(result).toEqual({ status: 'created' });
    expect(notificationRepository.createFromEvent).toHaveBeenCalledWith({
      eventId: EVENT_ID,
      profileId: 'profile-1',
      type: 'seller_approved',
      title: 'Solicitud de vendedor aprobada',
      body: '¡Felicitaciones! Tu solicitud para vender en Qatu fue aprobada. Ya puedes publicar productos.',
      actionUrl: '/seller/products',
      payload: { application_id: 'app-1' },
    });
  });

  it('marks an incomplete seller_application.approved payload as permanent', async () => {
    await expect(
      useCase.execute({
        eventId: EVENT_ID,
        routingKey: 'seller_application.approved',
        payload: { application_id: 'app-1' },
      })
    ).rejects.toMatchObject({
      permanent: true,
      message: 'seller_application.approved payload is incomplete',
    });
  });

  it.each([
    [
      'Datos incompletos',
      'Tu solicitud para convertirte en vendedor no fue aprobada. Motivo: Datos incompletos',
      'Datos incompletos',
    ],
    [null, 'Tu solicitud para convertirte en vendedor no fue aprobada.', null],
  ])(
    'creates a seller_rejected notification with reason %j',
    async (rejectionReason, expectedBody, expectedReason) => {
      const result = await useCase.execute({
        eventId: EVENT_ID,
        routingKey: 'seller_application.rejected',
        payload: {
          application_id: 'app-1',
          profile_id: 'profile-1',
          rejection_reason: rejectionReason,
        },
      });

      expect(result).toEqual({ status: 'created' });
      expect(notificationRepository.createFromEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-1',
          type: 'seller_rejected',
          body: expectedBody,
          actionUrl: '/seller/apply',
          payload: { application_id: 'app-1', rejection_reason: expectedReason },
        })
      );
    }
  );

  it('marks an incomplete seller_application.rejected payload as permanent', async () => {
    await expect(
      useCase.execute({
        eventId: EVENT_ID,
        routingKey: 'seller_application.rejected',
        payload: { profile_id: 'profile-1' },
      })
    ).rejects.toMatchObject({
      permanent: true,
      message: 'seller_application.rejected payload is incomplete',
    });
  });

  it.each([
    ['order.status_changed', 'order.status_changed payload is incomplete'],
    ['seller_application.approved', 'seller_application.approved payload is incomplete'],
    ['seller_application.rejected', 'seller_application.rejected payload is incomplete'],
    ['message.sent', 'message.sent payload is incomplete'],
  ])('treats a missing payload for %s as permanent', async (routingKey, message) => {
    await expect(useCase.execute({ eventId: EVENT_ID, routingKey })).rejects.toMatchObject({
      permanent: true,
      message,
    });
    expect(notificationRepository.createFromEvent).not.toHaveBeenCalled();
  });

  it('uses the raw status and omits the order number when they are absent', async () => {
    await useCase.execute({
      eventId: EVENT_ID,
      routingKey: 'order.status_changed',
      payload: {
        order_id: payload.order_id,
        order_number: null,
        buyer_id: payload.buyer_id,
        from_status: 'confirmed',
        to_status: 'processing',
      },
    });

    expect(notificationRepository.createFromEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Tu pedido ahora está processing.',
        payload: expect.objectContaining({ to_status: 'processing' }),
      })
    );
  });

  it.each([
    [
      'order.status_changed',
      {
        order_id: payload.order_id,
        buyer_id: payload.buyer_id,
        from_status: 'confirmed',
        to_status: 'shipped',
      },
    ],
    ['seller_application.approved', { application_id: 'app-1', profile_id: 'profile-1' }],
    ['seller_application.rejected', { application_id: 'app-1', profile_id: 'profile-1' }],
  ])(
    'reports a duplicate when the repository already stored %s',
    async (routingKey, eventPayload) => {
      notificationRepository.createFromEvent.mockResolvedValue(false);

      await expect(
        useCase.execute({ eventId: EVENT_ID, routingKey, payload: eventPayload })
      ).resolves.toEqual({ status: 'duplicate' });
    }
  );
});
