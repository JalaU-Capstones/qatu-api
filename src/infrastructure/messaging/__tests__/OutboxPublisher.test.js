import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OutboxPublisher } from '../OutboxPublisher.js';

const silentLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const event = (id, overrides = {}) => ({
  id,
  event_type: 'OrderPlaced',
  routing_key: 'order.placed',
  payload: { order_id: `order-${id}` },
  attempts: 0,
  ...overrides,
});

/** A confirm channel whose publish() acks (or nacks) through the callback. */
const makeChannel = ({ nack = false, throwOnPublish = false, neverConfirm = false } = {}) => ({
  publish: vi.fn((exchange, key, content, options, callback) => {
    if (throwOnPublish) throw new Error('channel closed');
    if (neverConfirm) return true;
    callback(nack ? new Error('nack from broker') : null);
    return true;
  }),
});

describe('OutboxPublisher', () => {
  const transaction = { id: 'tx' };
  let outboxRepository;
  let transactionManager;
  let publisher;

  const build = (overrides = {}) =>
    new OutboxPublisher({
      outboxRepository,
      transactionManager,
      exchange: 'qatu.events',
      maxAttempts: 3,
      intervalMs: 1000,
      logger: silentLogger,
      ...overrides,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    outboxRepository = {
      claimPendingBatch: vi.fn().mockResolvedValue([]),
      markPublished: vi.fn().mockResolvedValue(undefined),
      scheduleRetry: vi.fn().mockResolvedValue(undefined),
    };
    transactionManager = { run: vi.fn(async (work) => work(transaction)) };
    publisher = build();
  });

  afterEach(() => {
    publisher.stop();
    vi.useRealTimers();
  });

  it('requires its dependencies', () => {
    expect(() => new OutboxPublisher({})).toThrow('outboxRepository is required');
    expect(() => new OutboxPublisher({ outboxRepository })).toThrow(
      'transactionManager is required'
    );
    expect(() => new OutboxPublisher({ outboxRepository, transactionManager })).toThrow(
      'exchange is required'
    );
  });

  it('does nothing (and burns no attempts) while no broker channel is attached', async () => {
    await expect(publisher.pollOnce()).resolves.toBe(0);

    expect(transactionManager.run).not.toHaveBeenCalled();
    expect(outboxRepository.scheduleRetry).not.toHaveBeenCalled();
  });

  it('claims, publishes and marks events inside ONE transaction', async () => {
    const channel = makeChannel();
    publisher.attach(channel);
    outboxRepository.claimPendingBatch.mockResolvedValue([event('e1'), event('e2')]);

    const claimed = await publisher.pollOnce();

    expect(claimed).toBe(2);
    expect(transactionManager.run).toHaveBeenCalledTimes(1);
    expect(outboxRepository.claimPendingBatch).toHaveBeenCalledWith(50, { transaction });
    expect(outboxRepository.markPublished).toHaveBeenCalledWith('e1', { transaction });
    expect(outboxRepository.markPublished).toHaveBeenCalledWith('e2', { transaction });
    expect(outboxRepository.scheduleRetry).not.toHaveBeenCalled();
  });

  it('publishes persistent messages with messageId = event id on the topic exchange', async () => {
    const channel = makeChannel();
    publisher.attach(channel);
    outboxRepository.claimPendingBatch.mockResolvedValue([event('e1')]);

    await publisher.pollOnce();

    const [exchange, routingKey, content, options] = channel.publish.mock.calls[0];
    expect(exchange).toBe('qatu.events');
    expect(routingKey).toBe('order.placed');
    expect(JSON.parse(content.toString())).toEqual({ order_id: 'order-e1' });
    expect(options).toMatchObject({
      persistent: true,
      messageId: 'e1',
      contentType: 'application/json',
      headers: { 'x-event-type': 'OrderPlaced' },
    });
  });

  it('schedules a retry (not "published") when the broker nacks', async () => {
    publisher.attach(makeChannel({ nack: true }));
    outboxRepository.claimPendingBatch.mockResolvedValue([event('e1')]);

    await publisher.pollOnce();

    expect(outboxRepository.markPublished).not.toHaveBeenCalled();
    expect(outboxRepository.scheduleRetry).toHaveBeenCalledWith(
      { id: 'e1', error: 'nack from broker', maxAttempts: 3 },
      { transaction }
    );
  });

  it('schedules a retry when publish throws synchronously (closed channel)', async () => {
    publisher.attach(makeChannel({ throwOnPublish: true }));
    outboxRepository.claimPendingBatch.mockResolvedValue([event('e1')]);

    await publisher.pollOnce();

    expect(outboxRepository.scheduleRetry).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e1', error: 'channel closed' }),
      { transaction }
    );
  });

  it('keeps going after one event fails', async () => {
    const channel = {
      publish: vi
        .fn()
        .mockImplementationOnce((e, k, c, o, cb) => cb(new Error('nack')))
        .mockImplementationOnce((e, k, c, o, cb) => cb(null)),
    };
    publisher.attach(channel);
    outboxRepository.claimPendingBatch.mockResolvedValue([event('bad'), event('good')]);

    await publisher.pollOnce();

    expect(outboxRepository.scheduleRetry).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'bad' }),
      { transaction }
    );
    expect(outboxRepository.markPublished).toHaveBeenCalledWith('good', { transaction });
  });

  it('does not hang forever when the broker never confirms', async () => {
    vi.useFakeTimers();
    publisher = build({ confirmTimeoutMs: 100 });
    publisher.attach(makeChannel({ neverConfirm: true }));
    outboxRepository.claimPendingBatch.mockResolvedValue([event('e1')]);

    const polling = publisher.pollOnce();
    await vi.advanceTimersByTimeAsync(150);
    await polling;

    expect(outboxRepository.scheduleRetry).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e1', error: 'Timed out waiting for broker confirm' }),
      { transaction }
    );
  });

  it('survives a database failure: logs it and leaves the events pending for the next tick', async () => {
    publisher.attach(makeChannel());
    transactionManager.run.mockRejectedValueOnce(new Error('db down'));

    await expect(publisher.pollOnce()).resolves.toBe(0);
    expect(silentLogger.error).toHaveBeenCalledWith({ err: 'db down' }, 'Outbox poll failed');

    // The guard was released: the next tick works again.
    transactionManager.run.mockImplementation(async (work) => work(transaction));
    await expect(publisher.pollOnce()).resolves.toBe(0);
  });

  it('never overlaps two polls', async () => {
    publisher.attach(makeChannel());
    let release;
    transactionManager.run.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(0);
        })
    );

    const first = publisher.pollOnce();
    const second = await publisher.pollOnce();

    expect(second).toBe(0);
    expect(transactionManager.run).toHaveBeenCalledTimes(1);
    release();
    await first;
  });

  it('polls on an interval once started and stops cleanly', async () => {
    vi.useFakeTimers();
    publisher = build({ intervalMs: 1000 });
    publisher.attach(makeChannel());

    publisher.start();
    publisher.start(); // idempotent
    await vi.advanceTimersByTimeAsync(2100);
    expect(transactionManager.run).toHaveBeenCalledTimes(2);

    publisher.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(transactionManager.run).toHaveBeenCalledTimes(2);
  });

  it('detach() stops publishing without touching the outbox', async () => {
    publisher.attach(makeChannel());
    publisher.detach();

    await expect(publisher.pollOnce()).resolves.toBe(0);
    expect(transactionManager.run).not.toHaveBeenCalled();
  });
});
