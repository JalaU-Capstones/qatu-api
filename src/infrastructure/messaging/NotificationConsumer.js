import { logger as defaultLogger } from '../logging/logger.js';

/** Total processing attempts per message before it is dead-lettered. */
export const MAX_DELIVERY_ATTEMPTS = 3;
const RETRY_HEADER = 'x-retry-count';

/**
 * Consumes qatu.notifications with manual acks. Poison messages go to the DLQ; transient failures
 * are re-queued with `x-retry-count` (a plain requeue would loop forever) up to MAX_DELIVERY_ATTEMPTS.
 */
export class NotificationConsumer {
  constructor({
    createNotificationFromEventUseCase,
    queue,
    prefetch = 10,
    maxAttempts = MAX_DELIVERY_ATTEMPTS,
    logger = defaultLogger,
  } = {}) {
    if (!createNotificationFromEventUseCase) {
      throw new Error('createNotificationFromEventUseCase is required');
    }
    if (!queue) throw new Error('queue is required');

    this.createNotificationFromEventUseCase = createNotificationFromEventUseCase;
    this.queue = queue;
    this.prefetch = prefetch;
    this.maxAttempts = maxAttempts;
    this.logger = logger;

    this.channel = null;
    this._consumerTag = null;
  }

  async start(channel) {
    this.channel = channel;
    await channel.prefetch(this.prefetch);
    const { consumerTag } = await channel.consume(this.queue, (message) => this.handle(message), {
      noAck: false,
    });
    this._consumerTag = consumerTag;
    this.logger.info({ queue: this.queue }, 'NotificationConsumer started');
  }

  async stop() {
    if (this.channel && this._consumerTag) {
      try {
        await this.channel.cancel(this._consumerTag);
      } catch {
        // The channel may already be closed (connection lost); nothing to cancel.
      }
    }
    this._consumerTag = null;
    this.channel = null;
  }

  /** `message` is null when the broker cancels the consumer. */
  async handle(message) {
    if (!message) return;
    const channel = this.channel;
    const eventId = message.properties?.messageId;
    const routingKey = message.fields?.routingKey;

    let payload;
    try {
      payload = JSON.parse(message.content.toString('utf8'));
    } catch {
      this.logger.warn({ eventId, routingKey }, 'Poison message (invalid JSON) → DLQ');
      channel.nack(message, false, false);
      return;
    }

    try {
      const result = await this.createNotificationFromEventUseCase.execute({
        eventId,
        routingKey,
        payload,
      });
      channel.ack(message);
      this.logger.info({ eventId, routingKey, status: result?.status }, 'Event processed');
    } catch (error) {
      this._onFailure(message, error, { eventId, routingKey });
    }
  }

  _onFailure(message, error, meta) {
    const channel = this.channel;
    const headers = message.properties?.headers ?? {};
    const attempts = Number(headers['x-retry-count'] ?? 0) + 1;

    if (error?.permanent || attempts >= this.maxAttempts) {
      this.logger.error({ ...meta, attempts, err: error?.message }, 'Event rejected → DLQ');
      channel.nack(message, false, false);
      return;
    }

    try {
      channel.sendToQueue(this.queue, message.content, {
        persistent: true,
        messageId: message.properties.messageId,
        contentType: message.properties.contentType,
        headers: { ...headers, [RETRY_HEADER]: attempts },
      });
      channel.ack(message);
      this.logger.warn({ ...meta, attempts, err: error?.message }, 'Event failed; retry queued');
    } catch (republishError) {
      // Could not re-queue a copy: hand the original back to the broker.
      this.logger.error({ ...meta, err: republishError.message }, 'Retry republish failed');
      channel.nack(message, false, true);
    }
  }
}
