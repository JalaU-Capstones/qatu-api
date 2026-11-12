import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvalidEventPayloadError } from '../../../application/use-cases/CreateNotificationFromEventUseCase.js';
import { MAX_DELIVERY_ATTEMPTS, NotificationConsumer } from '../NotificationConsumer.js';

const silentLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const QUEUE = 'qatu.notifications';

const message = ({ body, messageId = 'evt-1', routingKey = 'order.placed', headers } = {}) => ({
  content: Buffer.from(body ?? JSON.stringify({ order_id: 'o-1' })),
  fields: { routingKey },
  properties: { messageId, contentType: 'application/json', headers },
});

describe('NotificationConsumer', () => {
  let channel;
  let useCase;
  let consumer;

  beforeEach(() => {
    vi.clearAllMocks();
    channel = {
      prefetch: vi.fn().mockResolvedValue(undefined),
      consume: vi.fn().mockResolvedValue({ consumerTag: 'tag-1' }),
      cancel: vi.fn().mockResolvedValue(undefined),
      ack: vi.fn(),
      nack: vi.fn(),
      sendToQueue: vi.fn(),
    };
    useCase = { execute: vi.fn().mockResolvedValue({ status: 'created' }) };
    consumer = new NotificationConsumer({
      createNotificationFromEventUseCase: useCase,
      queue: QUEUE,
      logger: silentLogger,
    });
  });

  it('requires its dependencies', () => {
    expect(() => new NotificationConsumer({})).toThrow(
      'createNotificationFromEventUseCase is required'
    );
    expect(() => new NotificationConsumer({ createNotificationFromEventUseCase: useCase })).toThrow(
      'queue is required'
    );
  });

  it('starts with prefetch 10 and MANUAL acknowledgements (noAck: false)', async () => {
    await consumer.start(channel);

    expect(channel.prefetch).toHaveBeenCalledWith(10);
    expect(channel.consume).toHaveBeenCalledWith(QUEUE, expect.any(Function), { noAck: false });
  });

  it('acks only after the notification was stored', async () => {
    await consumer.start(channel);
    const msg = message();

    await consumer.handle(msg);

    expect(useCase.execute).toHaveBeenCalledWith({
      eventId: 'evt-1',
      routingKey: 'order.placed',
      payload: { order_id: 'o-1' },
    });
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('acks duplicate deliveries too (idempotent skip)', async () => {
    await consumer.start(channel);
    useCase.execute.mockResolvedValue({ status: 'duplicate' });
    const msg = message();

    await consumer.handle(msg);

    expect(channel.ack).toHaveBeenCalledWith(msg);
  });

  it('sends poison messages (invalid JSON) to the DLQ without requeue and keeps working', async () => {
    await consumer.start(channel);
    const poison = message({ body: 'not-json' });

    await consumer.handle(poison);
    expect(channel.nack).toHaveBeenCalledWith(poison, false, false);
    expect(useCase.execute).not.toHaveBeenCalled();

    // The next message is still processed.
    const next = message({ messageId: 'evt-2' });
    await consumer.handle(next);
    expect(channel.ack).toHaveBeenCalledWith(next);
  });

  it('dead-letters permanently invalid events immediately (no retry loop)', async () => {
    await consumer.start(channel);
    useCase.execute.mockRejectedValue(new InvalidEventPayloadError('bad payload'));
    const msg = message();

    await consumer.handle(msg);

    expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
    expect(channel.sendToQueue).not.toHaveBeenCalled();
  });

  it('re-queues a failed message with an incremented x-retry-count and acks the original', async () => {
    await consumer.start(channel);
    useCase.execute.mockRejectedValue(new Error('db down'));
    const msg = message();

    await consumer.handle(msg);

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      QUEUE,
      msg.content,
      expect.objectContaining({
        persistent: true,
        messageId: 'evt-1',
        headers: { 'x-retry-count': 1 },
      })
    );
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it(`dead-letters after ${MAX_DELIVERY_ATTEMPTS} total attempts`, async () => {
    await consumer.start(channel);
    useCase.execute.mockRejectedValue(new Error('db down'));
    const lastAttempt = message({ headers: { 'x-retry-count': MAX_DELIVERY_ATTEMPTS - 1 } });

    await consumer.handle(lastAttempt);

    expect(channel.nack).toHaveBeenCalledWith(lastAttempt, false, false);
    expect(channel.sendToQueue).not.toHaveBeenCalled();
  });

  it('hands the message back to the broker if the retry copy cannot be published', async () => {
    await consumer.start(channel);
    useCase.execute.mockRejectedValue(new Error('db down'));
    channel.sendToQueue.mockImplementation(() => {
      throw new Error('channel closed');
    });
    const msg = message();

    await consumer.handle(msg);

    expect(channel.nack).toHaveBeenCalledWith(msg, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('ignores the null message the broker sends when it cancels the consumer', async () => {
    await consumer.start(channel);

    await expect(consumer.handle(null)).resolves.toBeUndefined();
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('stop() cancels the consumer and tolerates an already closed channel', async () => {
    await consumer.start(channel);
    await consumer.stop();
    expect(channel.cancel).toHaveBeenCalledWith('tag-1');

    await consumer.start(channel);
    channel.cancel.mockRejectedValue(new Error('channel closed'));
    await expect(consumer.stop()).resolves.toBeUndefined();
  });
});
