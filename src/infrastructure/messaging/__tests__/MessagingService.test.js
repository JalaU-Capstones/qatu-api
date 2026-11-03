import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAmqpUrl, getBackoffDelayMs, MessagingService } from '../MessagingService.js';
import { assertTopology } from '../topology.js';

const silentLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const topology = {
  exchange: 'qatu.events',
  notificationsQueue: 'qatu.notifications',
  dlx: 'qatu.dlx',
  dlq: 'qatu.notifications.dlq',
};

describe('getBackoffDelayMs', () => {
  it('doubles from 1s and caps at 30s', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 10].map(getBackoffDelayMs)).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000,
    ]);
  });
});

describe('buildAmqpUrl', () => {
  it('returns the URL untouched without a vhost', () => {
    expect(buildAmqpUrl('amqp://u:p@localhost:5672', null)).toBe('amqp://u:p@localhost:5672');
  });

  it('applies the vhost when the URL has none', () => {
    expect(buildAmqpUrl('amqp://u:p@localhost:5672', 'qatu-dev')).toBe(
      'amqp://u:p@localhost:5672/qatu-dev'
    );
  });

  it('keeps a vhost that is already part of the URL', () => {
    expect(buildAmqpUrl('amqps://u:p@host/qatu-prod', 'qatu-dev')).toBe(
      'amqps://u:p@host/qatu-prod'
    );
  });
});

describe('assertTopology', () => {
  it('declares the ADR-014 topology: topic exchange, DLX/DLQ and a dead-lettering main queue', async () => {
    const channel = {
      assertExchange: vi.fn().mockResolvedValue(undefined),
      assertQueue: vi.fn().mockResolvedValue(undefined),
      bindQueue: vi.fn().mockResolvedValue(undefined),
    };

    await assertTopology(channel, topology);

    expect(channel.assertExchange).toHaveBeenCalledWith('qatu.events', 'topic', { durable: true });
    expect(channel.assertExchange).toHaveBeenCalledWith('qatu.dlx', 'fanout', { durable: true });
    expect(channel.assertQueue).toHaveBeenCalledWith('qatu.notifications.dlq', { durable: true });
    expect(channel.assertQueue).toHaveBeenCalledWith('qatu.notifications', {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'qatu.dlx',
        'x-dead-letter-routing-key': 'notifications.dlq',
      },
    });
    expect(channel.bindQueue).toHaveBeenCalledWith('qatu.notifications.dlq', 'qatu.dlx', '');
    expect(channel.bindQueue).toHaveBeenCalledWith('qatu.notifications', 'qatu.events', '#');
  });
});

describe('MessagingService', () => {
  let outboxPublisher;
  let notificationConsumer;
  let connections;
  let connect;

  const makeConnection = () => {
    const connection = new EventEmitter();
    connection.publisherChannel = Object.assign(new EventEmitter(), {
      assertExchange: vi.fn().mockResolvedValue(undefined),
      assertQueue: vi.fn().mockResolvedValue(undefined),
      bindQueue: vi.fn().mockResolvedValue(undefined),
    });
    connection.consumerChannel = Object.assign(new EventEmitter(), {});
    connection.createConfirmChannel = vi.fn().mockResolvedValue(connection.publisherChannel);
    connection.createChannel = vi.fn().mockResolvedValue(connection.consumerChannel);
    connection.close = vi.fn().mockResolvedValue(undefined);
    connections.push(connection);
    return connection;
  };

  const build = (overrides = {}) =>
    new MessagingService({
      url: 'amqp://u:p@localhost:5672',
      topology,
      outboxPublisher,
      notificationConsumer,
      connect,
      sleepFn: vi.fn().mockResolvedValue(undefined),
      logger: silentLogger,
      ...overrides,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    connections = [];
    outboxPublisher = {
      start: vi.fn(),
      stop: vi.fn(),
      attach: vi.fn(),
      detach: vi.fn(),
    };
    notificationConsumer = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    connect = vi.fn(async () => makeConnection());
  });

  it('requires its dependencies', () => {
    expect(() => new MessagingService({})).toThrow('RabbitMQ url is required');
    expect(() => new MessagingService({ url: 'amqp://x' })).toThrow('topology is required');
  });

  it('connects, asserts the topology and wires publisher and consumer', async () => {
    const service = build();

    await service.start();

    expect(connect).toHaveBeenCalledWith('amqp://u:p@localhost:5672', { heartbeat: 60 });
    const [connection] = connections;
    expect(connection.publisherChannel.assertExchange).toHaveBeenCalled();
    expect(outboxPublisher.start).toHaveBeenCalled();
    expect(outboxPublisher.attach).toHaveBeenCalledWith(connection.publisherChannel);
    expect(notificationConsumer.start).toHaveBeenCalledWith(connection.consumerChannel);
  });

  it('retries with exponential backoff while the broker is unreachable and never throws', async () => {
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    connect
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:5672'))
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:5672'))
      .mockImplementationOnce(async () => makeConnection());
    const service = build({ sleepFn });

    await service.start();

    expect(connect).toHaveBeenCalledTimes(3);
    expect(sleepFn.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000]);
    expect(outboxPublisher.attach).toHaveBeenCalledTimes(1);
  });

  it('never logs the broker URL (it carries credentials)', async () => {
    connect
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockImplementation(async () => makeConnection());
    const service = build();

    await service.start();

    expect(JSON.stringify(silentLogger.warn.mock.calls)).not.toContain('u:p@');
  });

  it('closes the connection and retries when the topology assertion fails (drifted config)', async () => {
    const broken = makeConnection();
    broken.publisherChannel.assertExchange.mockRejectedValue(new Error('PRECONDITION_FAILED'));
    connect.mockResolvedValueOnce(broken).mockImplementation(async () => makeConnection());
    const service = build();

    await service.start();

    expect(broken.close).toHaveBeenCalled();
    expect(outboxPublisher.attach).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('detaches and reconnects when the connection drops', async () => {
    const service = build();
    await service.start();
    const [first] = connections;

    first.emit('close');
    await vi.waitFor(() => expect(connect).toHaveBeenCalledTimes(2));

    expect(outboxPublisher.detach).toHaveBeenCalled();
    expect(notificationConsumer.stop).toHaveBeenCalled();
    await vi.waitFor(() => expect(outboxPublisher.attach).toHaveBeenCalledTimes(2));
  });

  it('survives AMQP error events instead of crashing the process', async () => {
    const service = build();
    await service.start();
    const [connection] = connections;

    expect(() => connection.emit('error', new Error('socket hang up'))).not.toThrow();
    expect(() => connection.publisherChannel.emit('error', new Error('boom'))).not.toThrow();
  });

  it('stop() halts the worker, cancels the consumer and closes the connection without reconnecting', async () => {
    const service = build();
    await service.start();
    const [connection] = connections;

    await service.stop();
    connection.emit('close');

    expect(outboxPublisher.stop).toHaveBeenCalled();
    expect(notificationConsumer.stop).toHaveBeenCalled();
    expect(connection.close).toHaveBeenCalled();
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
