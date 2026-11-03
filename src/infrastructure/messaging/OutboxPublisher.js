/* global setInterval, clearInterval */
import { logger as defaultLogger } from '../logging/logger.js';

/**
 * The only place that publishes to RabbitMQ. Each poll claims, publishes (waiting for the broker
 * confirm) and marks events in one transaction, so SKIP LOCKED really guards the rows.
 */
export class OutboxPublisher {
  constructor({
    outboxRepository,
    transactionManager,
    exchange,
    intervalMs = 2000,
    maxAttempts = 3,
    batchSize = 50,
    confirmTimeoutMs = 5000,
    logger = defaultLogger,
  } = {}) {
    if (!outboxRepository) throw new Error('outboxRepository is required');
    if (!transactionManager) throw new Error('transactionManager is required');
    if (!exchange) throw new Error('exchange is required');

    this.outboxRepository = outboxRepository;
    this.transactionManager = transactionManager;
    this.exchange = exchange;
    this.intervalMs = intervalMs;
    this.maxAttempts = maxAttempts;
    this.batchSize = batchSize;
    this.confirmTimeoutMs = confirmTimeoutMs;
    this.logger = logger;

    this.channel = null;
    this._timer = null;
    this._polling = false;
  }

  /** While detached, polling is a no-op and events just wait in the outbox. */
  attach(channel) {
    this.channel = channel;
  }

  detach() {
    this.channel = null;
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      void this.pollOnce();
    }, this.intervalMs);
    // Never keep the process alive only for the poller.
    this._timer.unref?.();
    this.logger.info({ intervalMs: this.intervalMs }, 'OutboxPublisher started');
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /** Relays one batch of due events; returns how many were claimed. */
  async pollOnce() {
    if (this._polling || !this.channel) return 0;
    this._polling = true;

    try {
      return await this.transactionManager.run(async (transaction) => {
        const batch = await this.outboxRepository.claimPendingBatch(this.batchSize, {
          transaction,
        });

        for (const event of batch) {
          await this._relay(event, transaction);
        }
        return batch.length;
      });
    } catch (error) {
      // DB trouble: the transaction rolled back, events stay pending, next tick retries.
      this.logger.error({ err: error.message }, 'Outbox poll failed');
      return 0;
    } finally {
      this._polling = false;
    }
  }

  async _relay(event, transaction) {
    const meta = { eventId: event.id, eventType: event.event_type, routingKey: event.routing_key };

    try {
      await this._publishConfirmed(event);
    } catch (error) {
      await this.outboxRepository.scheduleRetry(
        { id: event.id, error: error.message, maxAttempts: this.maxAttempts },
        { transaction }
      );
      this.logger.warn({ ...meta, err: error.message }, 'Outbox publish failed; retry scheduled');
      return;
    }

    await this.outboxRepository.markPublished(event.id, { transaction });
    this.logger.info(meta, 'Outbox event published');
  }

  /** Resolves on broker ack; rejects on nack, publish error or confirm timeout. */
  _publishConfirmed(event) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timed out waiting for broker confirm')),
        this.confirmTimeoutMs
      );
      const settle = (fn, value) => {
        clearTimeout(timeout);
        fn(value);
      };

      try {
        this.channel.publish(
          this.exchange,
          event.routing_key,
          Buffer.from(JSON.stringify(event.payload)),
          {
            persistent: true,
            messageId: event.id,
            contentType: 'application/json',
            headers: { 'x-event-type': event.event_type },
          },
          (error) => (error ? settle(reject, error) : settle(resolve))
        );
      } catch (error) {
        settle(reject, error);
      }
    });
  }
}
