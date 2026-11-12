import { URL } from 'node:url';
import amqp from 'amqplib';
import { logger as defaultLogger } from '../logging/logger.js';
import { assertTopology } from './topology.js';

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 30_000;

/** Reconnect delay: 1s, 2s, 4s… capped at 30s. */
export function getBackoffDelayMs(attempt) {
  return Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS);
}

/** Applies `RABBITMQ_VHOST` when the URL has none, so dev and prod never share a vhost. */
export function buildAmqpUrl(url, vhost) {
  if (!vhost) return url;
  const parsed = new URL(url);
  if (parsed.pathname === '' || parsed.pathname === '/') {
    parsed.pathname = `/${encodeURIComponent(vhost)}`;
  }
  return parsed.toString();
}

const sleep = (ms) =>
  new Promise((resolve) => {
    // Unref'd: a pending reconnect delay must not keep a shutting-down process alive.
    setTimeout(resolve, ms).unref?.();
  });

/**
 * Owns the RabbitMQ connection for the in-process worker and consumer. Reconnects with backoff
 * in the background, so a broker outage never fails checkout (events wait in the outbox).
 */
export class MessagingService {
  constructor({
    url,
    vhost = null,
    topology,
    outboxPublisher,
    notificationConsumer,
    connect = amqp.connect,
    sleepFn = sleep,
    logger = defaultLogger,
  } = {}) {
    if (!url) throw new Error('RabbitMQ url is required');
    if (!topology) throw new Error('topology is required');
    if (!outboxPublisher) throw new Error('outboxPublisher is required');
    if (!notificationConsumer) throw new Error('notificationConsumer is required');

    this.url = buildAmqpUrl(url, vhost);
    this.topology = topology;
    this.outboxPublisher = outboxPublisher;
    this.notificationConsumer = notificationConsumer;
    this._connect = connect;
    this._sleep = sleepFn;
    this.logger = logger;

    this.connection = null;
    this._stopped = true;
    this._connecting = false;
  }

  /** Connects in the background; resolves once connected or stopped, never rejects. */
  async start() {
    if (!this._stopped) return;
    this._stopped = false;
    this.outboxPublisher.start();
    await this._connectWithBackoff();
  }

  async stop() {
    this._stopped = true;
    this.outboxPublisher.stop();
    await this.notificationConsumer.stop();
    this.outboxPublisher.detach();

    const { connection } = this;
    this.connection = null;
    if (connection) {
      await connection.close().catch(() => {});
    }
  }

  async _connectWithBackoff() {
    if (this._connecting) return;
    this._connecting = true;

    try {
      let attempt = 0;
      while (!this._stopped) {
        try {
          await this._connectOnce();
          return;
        } catch (error) {
          const delay = getBackoffDelayMs(attempt);
          attempt += 1;
          this.logger.warn(
            { err: error.message, retryInMs: delay },
            'RabbitMQ connection failed; will retry'
          );
          await this._sleep(delay);
        }
      }
    } finally {
      this._connecting = false;
    }
  }

  async _connectOnce() {
    const connection = await this._connect(this.url, { heartbeat: 60 });

    // Without these listeners an AMQP 'error' event would crash the process.
    connection.on('error', (error) =>
      this.logger.warn({ err: error.message }, 'RabbitMQ connection error')
    );
    connection.on('close', () => this._onConnectionClosed(connection));

    try {
      const publisherChannel = await connection.createConfirmChannel();
      const consumerChannel = await connection.createChannel();
      for (const channel of [publisherChannel, consumerChannel]) {
        channel.on('error', (error) =>
          this.logger.warn({ err: error.message }, 'RabbitMQ channel error')
        );
      }

      await assertTopology(publisherChannel, this.topology);
      this.outboxPublisher.attach(publisherChannel);
      await this.notificationConsumer.start(consumerChannel);
    } catch (error) {
      this.outboxPublisher.detach();
      await connection.close().catch(() => {});
      throw error;
    }

    this.connection = connection;
    if (this._stopped) {
      await this.stop();
      return;
    }
    this.logger.info('RabbitMQ connected; topology asserted');
  }

  _onConnectionClosed(connection) {
    if (connection !== this.connection) return; // stale or closed on purpose

    this.connection = null;
    this.outboxPublisher.detach();
    void this.notificationConsumer.stop();

    if (!this._stopped) {
      this.logger.warn('RabbitMQ connection lost; reconnecting');
      void this._connectWithBackoff();
    }
  }
}
