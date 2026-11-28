import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CreateNotificationFromEventUseCase,
  InvalidEventPayloadError,
} from '../CreateNotificationFromEventUseCase.js';

const EVENT_ID = 'e3b0c442-98fc-4c14-9afb-f4c8996fb924';
const MESSAGE_ID = 'a6eecd55-6c61-4ef4-db2f-2b15bc946a77';
const CONVERSATION_ID = 'e4ccaa33-4a4f-4cd2-bf0d-0ff3fa724e55';
const SENDER_ID = 'b1ffcd00-1d1c-4fa9-8c7a-7cc0ce491b22';
const RECIPIENT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const PRODUCT_ID = 'd3bbff22-3f3e-4bc1-ae9c-9ee2ef613d44';

function makePayload(overrides = {}) {
  return {
    message_id: MESSAGE_ID,
    conversation_id: CONVERSATION_ID,
    sender_id: SENDER_ID,
    recipient_id: RECIPIENT_ID,
    product_id: PRODUCT_ID,
    ...overrides,
  };
}

describe('CreateNotificationFromEventUseCase — message.sent', () => {
  let notificationRepository;
  let useCase;

  beforeEach(() => {
    notificationRepository = {
      createFromEvent: vi.fn().mockResolvedValue(true),
    };
    useCase = new CreateNotificationFromEventUseCase({ notificationRepository });
  });

  it('requires a notification repository', () => {
    expect(() => new CreateNotificationFromEventUseCase()).toThrow(
      'notificationRepository is required'
    );
  });

  it('creates a message_received notification for the recipient', async () => {
    const result = await useCase.execute({
      eventId: EVENT_ID,
      routingKey: 'message.sent',
      payload: makePayload(),
    });

    expect(result).toEqual({ status: 'created' });
    expect(notificationRepository.createFromEvent).toHaveBeenCalledTimes(1);
    expect(notificationRepository.createFromEvent).toHaveBeenCalledWith({
      eventId: EVENT_ID,
      profileId: RECIPIENT_ID,
      type: 'message_received',
      title: 'Nuevo mensaje recibido',
      body: 'Tienes un mensaje nuevo en tus conversaciones de Qatu.',
      actionUrl: `/conversations?active=${CONVERSATION_ID}`,
      payload: {
        message_id: MESSAGE_ID,
        conversation_id: CONVERSATION_ID,
        sender_id: SENDER_ID,
        product_id: PRODUCT_ID,
      },
    });
  });

  it('nulls product_id when the event has no associated product', async () => {
    await useCase.execute({
      eventId: EVENT_ID,
      routingKey: 'message.sent',
      payload: makePayload({ product_id: undefined }),
    });

    expect(notificationRepository.createFromEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ product_id: null }),
      })
    );
  });

  it('reports a duplicate delivery without failing (idempotent on eventId)', async () => {
    notificationRepository.createFromEvent.mockResolvedValue(false);

    const result = await useCase.execute({
      eventId: EVENT_ID,
      routingKey: 'message.sent',
      payload: makePayload(),
    });

    expect(result).toEqual({ status: 'duplicate' });
    expect(notificationRepository.createFromEvent).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['message_id', { message_id: undefined }],
    ['message_id blank', { message_id: '   ' }],
    ['conversation_id', { conversation_id: undefined }],
    ['conversation_id blank', { conversation_id: '' }],
    ['sender_id', { sender_id: undefined }],
    ['sender_id blank', { sender_id: null }],
    ['recipient_id', { recipient_id: undefined }],
    ['recipient_id blank', { recipient_id: '  ' }],
  ])('throws a permanent InvalidEventPayloadError when %s is missing', async (_label, patch) => {
    const error = await useCase
      .execute({
        eventId: EVENT_ID,
        routingKey: 'message.sent',
        payload: makePayload(patch),
      })
      .catch((err) => err);

    expect(error).toBeInstanceOf(InvalidEventPayloadError);
    expect(error.permanent).toBe(true);
    expect(error.message).toBe('message.sent payload is incomplete');
    expect(notificationRepository.createFromEvent).not.toHaveBeenCalled();
  });

  it('rejects a missing eventId before inspecting the payload', async () => {
    const error = await useCase
      .execute({ routingKey: 'message.sent', payload: makePayload() })
      .catch((err) => err);

    expect(error).toBeInstanceOf(InvalidEventPayloadError);
    expect(error.permanent).toBe(true);
    expect(notificationRepository.createFromEvent).not.toHaveBeenCalled();
  });
});
