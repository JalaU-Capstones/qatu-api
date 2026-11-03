import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { RabbitMQContainer } from '@testcontainers/rabbitmq';
import amqp from 'amqplib';
import { QueryTypes } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateNotificationFromEventUseCase } from '../../../application/use-cases/CreateNotificationFromEventUseCase.js';
import { SequelizeTransactionManager } from '../../persistence/SequelizeTransactionManager.js';
import { createMigratedTestDatabase } from '../../persistence/__tests__/helpers/migratedTestDatabase.js';
import { NotificationRepository } from '../../persistence/repositories/NotificationRepository.js';
import { OutboxRepository } from '../../persistence/repositories/OutboxRepository.js';
import { MessagingService } from '../MessagingService.js';
import { NotificationConsumer } from '../NotificationConsumer.js';
import { OutboxPublisher } from '../OutboxPublisher.js';
import { assertTopology } from '../topology.js';

/**
 * Real PostgreSQL and real RabbitMQ (TEST_RABBITMQ_URL, or a Testcontainer when Docker exists).
 * Skips itself when neither is available, e.g. a CI runner without a broker.
 */
const BUYER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

// Unique topology per run: never collides with the developer's real queues.
const run = randomUUID().slice(0, 8);
const topology = {
  exchange: `qatu.test.${run}.events`,
  notificationsQueue: `qatu.test.${run}.notifications`,
  dlx: `qatu.test.${run}.dlx`,
  dlq: `qatu.test.${run}.notifications.dlq`,
};

const orderPlacedPayload = (orderId) => ({
  order_id: orderId,
  order_number: 'ORD-00100042',
  buyer_id: BUYER,
  total: 44.99,
  currency: 'USD',
  item_count: 1,
  seller_ids: [],
});

describe('Outbox → RabbitMQ → Notification (integration)', () => {
  let database;
  let sequelize;
  let container = null;
  let brokerUrl = null;
  let brokerError = null;

  let outbox;
  let service;
  let probe; // separate connection used to publish raw messages / read the DLQ
  let probeChannel;

  const q = (sql, replacements = {}) =>
    sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
  const waitFor = (assertion) => vi.waitFor(assertion, { timeout: 15_000, interval: 100 });

  const enqueueOrderPlaced = async () => {
    const orderId = randomUUID();
    const id = await new SequelizeTransactionManager({ db: sequelize }).run((transaction) =>
      outbox.enqueue(
        {
          eventType: 'OrderPlaced',
          aggregateType: 'order',
          aggregateId: orderId,
          routingKey: 'order.placed',
          payload: orderPlacedPayload(orderId),
        },
        { transaction }
      )
    );
    return { id, orderId };
  };

  beforeAll(async () => {
    database = await createMigratedTestDatabase('messaging');
    ({ sequelize } = database);

    try {
      if (process.env.TEST_RABBITMQ_URL) {
        brokerUrl = process.env.TEST_RABBITMQ_URL;
      } else if (existsSync('/var/run/docker.sock') || process.env.DOCKER_HOST) {
        container = await new RabbitMQContainer('rabbitmq:3-management-alpine').start();
        brokerUrl = container.getAmqpUrl();
      } else {
        // CI runner without a broker service or a container runtime: skip right away.
        throw new Error('No RabbitMQ available (set TEST_RABBITMQ_URL or run Docker)');
      }
      probe = await amqp.connect(brokerUrl);
      probeChannel = await probe.createChannel();
      // Declare the topology up front so purging/reading never hits a missing queue
      // (a failed passive operation makes RabbitMQ close the channel).
      await assertTopology(probeChannel, topology);
    } catch (error) {
      brokerError = error;
    }
  }, 180_000);

  afterAll(async () => {
    await service?.stop();
    if (probeChannel) {
      for (const queue of [topology.notificationsQueue, topology.dlq]) {
        await probeChannel.deleteQueue(queue).catch(() => {});
      }
      for (const exchange of [topology.exchange, topology.dlx]) {
        await probeChannel.deleteExchange(exchange).catch(() => {});
      }
    }
    await probe?.close().catch(() => {});
    await container?.stop();
    await database?.close();
  }, 60_000);

  beforeEach(async (context) => {
    if (brokerError) context.skip();

    await service?.stop();
    await sequelize.query(`
      delete from public.notifications;
      delete from public.outbox_events;
      delete from auth.users;
      insert into auth.users (id, email, raw_user_meta_data)
        values ('${BUYER}', 'a@example.com', '{"username":"buyer_a"}');
    `);
    await probeChannel.purgeQueue(topology.notificationsQueue).catch(() => {});
    await probeChannel.purgeQueue(topology.dlq).catch(() => {});

    outbox = new OutboxRepository({ db: sequelize });
    const transactionManager = new SequelizeTransactionManager({ db: sequelize });
    service = new MessagingService({
      url: brokerUrl,
      topology,
      outboxPublisher: new OutboxPublisher({
        outboxRepository: outbox,
        transactionManager,
        exchange: topology.exchange,
        intervalMs: 100,
        maxAttempts: 3,
      }),
      notificationConsumer: new NotificationConsumer({
        createNotificationFromEventUseCase: new CreateNotificationFromEventUseCase({
          notificationRepository: new NotificationRepository({ db: sequelize }),
        }),
        queue: topology.notificationsQueue,
      }),
    });
    await service.start();
  }, 60_000);

  it('happy path: an outbox event becomes exactly one notification and is marked published', async () => {
    const { id, orderId } = await enqueueOrderPlaced();

    await waitFor(async () => {
      const rows = await q('select * from public.notifications where event_id = :id', { id });
      expect(rows).toHaveLength(1);
    });

    const [notification] = await q('select * from public.notifications where event_id = :id', {
      id,
    });
    expect(notification).toMatchObject({
      profile_id: BUYER,
      type: 'order_placed',
      title: 'Pedido realizado',
      action_url: '/orders',
      event_id: id,
    });
    expect(notification.payload).toMatchObject({ order_id: orderId, order_number: 'ORD-00100042' });

    await waitFor(async () => {
      const [event] = await q(
        'select status, published_at from public.outbox_events where id = :id',
        {
          id,
        }
      );
      expect(event.status).toBe('published');
      expect(event.published_at).not.toBeNull();
    });
  }, 30_000);

  it('idempotency: the same message delivered twice creates ONE notification', async () => {
    const orderId = randomUUID();
    const messageId = randomUUID();
    const content = Buffer.from(JSON.stringify(orderPlacedPayload(orderId)));

    for (let i = 0; i < 2; i += 1) {
      probeChannel.publish(topology.exchange, 'order.placed', content, {
        persistent: true,
        messageId,
        contentType: 'application/json',
      });
    }

    await waitFor(async () => {
      expect(
        await q('select 1 from public.notifications where event_id = :messageId', { messageId })
      ).toHaveLength(1);
    });
    // Give the duplicate time to be consumed, then re-check nothing was added.
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(
      await q('select 1 from public.notifications where event_id = :messageId', { messageId })
    ).toHaveLength(1);
  }, 30_000);

  it('poison message: bad JSON lands in the DLQ and the consumer keeps processing', async () => {
    probeChannel.publish(topology.exchange, 'order.placed', Buffer.from('not-json'), {
      persistent: true,
      messageId: randomUUID(),
    });

    await waitFor(async () => {
      const dead = await probeChannel.get(topology.dlq, { noAck: true });
      expect(dead).not.toBe(false);
      expect(dead.content.toString()).toBe('not-json');
    });

    // The pipeline is still alive after the poison message.
    const { id } = await enqueueOrderPlaced();
    await waitFor(async () => {
      expect(
        await q('select 1 from public.notifications where event_id = :id', { id })
      ).toHaveLength(1);
    });
  }, 30_000);

  it('structurally invalid event (no buyer) goes straight to the DLQ without retrying', async () => {
    probeChannel.publish(
      topology.exchange,
      'order.placed',
      Buffer.from(JSON.stringify({ order_id: randomUUID(), order_number: 'ORD-1' })),
      { persistent: true, messageId: randomUUID() }
    );

    await waitFor(async () => {
      expect(await probeChannel.get(topology.dlq, { noAck: true })).not.toBe(false);
    });
    expect(await q('select 1 from public.notifications')).toHaveLength(0);
  }, 30_000);

  it('events of other routing keys are acknowledged and ignored (never poison the queue)', async () => {
    probeChannel.publish(topology.exchange, 'seller.approved', Buffer.from('{}'), {
      persistent: true,
      messageId: randomUUID(),
    });

    await new Promise((resolve) => setTimeout(resolve, 800));

    expect(await probeChannel.get(topology.dlq, { noAck: true })).toBe(false);
    expect(await q('select 1 from public.notifications')).toHaveLength(0);
  }, 30_000);
});
