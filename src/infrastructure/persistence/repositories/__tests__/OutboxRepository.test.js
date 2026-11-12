import { QueryTypes } from 'sequelize';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IOutboxRepository } from '../../../../domain/repositories/IOutboxRepository.js';
import { OutboxRepository } from '../OutboxRepository.js';

describe('OutboxRepository', () => {
  let mockDb;
  let repository;
  const transaction = { id: 'tx' };

  beforeEach(() => {
    mockDb = { query: vi.fn() };
    repository = new OutboxRepository({ db: mockDb });
  });

  it('is an IOutboxRepository', () => {
    expect(repository).toBeInstanceOf(IOutboxRepository);
    expect(() => new IOutboxRepository()).toThrow('cannot be instantiated');
  });

  describe('enqueue', () => {
    it('inserts a pending event inside the caller transaction and returns its id', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 'evt-1' }]);

      const id = await repository.enqueue(
        {
          eventType: 'OrderPlaced',
          aggregateType: 'order',
          aggregateId: 'order-1',
          routingKey: 'order.placed',
          payload: { order_id: 'order-1' },
        },
        { transaction }
      );

      expect(id).toBe('evt-1');
      const [sql, options] = mockDb.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO public.outbox_events');
      expect(sql).toContain("'pending'");
      expect(sql).toContain('CAST(:payload AS jsonb)');
      expect(options.transaction).toBe(transaction);
      expect(options.replacements.payload).toBe('{"order_id":"order-1"}');
    });

    it('throws when no row is returned', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        repository.enqueue({
          eventType: 'e',
          aggregateType: 'a',
          aggregateId: 'i',
          routingKey: 'k',
          payload: {},
        })
      ).rejects.toThrow('no row returned');
    });
  });

  describe('claimPendingBatch', () => {
    it('claims due events with FOR UPDATE SKIP LOCKED (mandatory for multi-worker safety)', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 'evt-1' }]);

      const batch = await repository.claimPendingBatch(50, { transaction });

      expect(batch).toEqual([{ id: 'evt-1' }]);
      const [sql, options] = mockDb.query.mock.calls[0];
      expect(sql).toContain("status = 'pending'");
      expect(sql).toContain('next_attempt_at <= NOW()');
      expect(sql).toContain('ORDER BY created_at ASC');
      expect(sql).toContain('FOR UPDATE SKIP LOCKED');
      expect(options).toMatchObject({
        replacements: { limit: 50 },
        type: QueryTypes.SELECT,
        transaction,
      });
    });
  });

  describe('markPublished', () => {
    it('flags the event as published with a timestamp', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await repository.markPublished('evt-1', { transaction });

      const [sql, options] = mockDb.query.mock.calls[0];
      expect(sql).toContain("status = 'published'");
      expect(sql).toContain('published_at = NOW()');
      expect(options).toMatchObject({ replacements: { id: 'evt-1' }, transaction });
    });
  });

  describe('scheduleRetry', () => {
    it('bumps attempts, backs off exponentially and fails after maxAttempts', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await repository.scheduleRetry(
        { id: 'evt-1', error: 'broker down', maxAttempts: 3 },
        { transaction }
      );

      const [sql, options] = mockDb.query.mock.calls[0];
      expect(sql).toContain('attempts = attempts + 1');
      expect(sql).toContain("THEN 'failed' ELSE 'pending'");
      expect(sql).toContain("POWER(2, attempts) * INTERVAL '1 second'");
      expect(options.replacements).toEqual({ id: 'evt-1', error: 'broker down', maxAttempts: 3 });
    });

    it('truncates very long errors so they cannot bloat the table', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await repository.scheduleRetry({ id: 'evt-1', error: 'x'.repeat(5000), maxAttempts: 3 });

      expect(mockDb.query.mock.calls[0][1].replacements.error).toHaveLength(500);
    });
  });
});
