import { QueryTypes } from 'sequelize';
import { IOutboxRepository } from '../../../domain/repositories/IOutboxRepository.js';
import { sequelize } from '../../config/sequelize.js';

const MAX_ERROR_LENGTH = 500;

export class OutboxRepository extends IOutboxRepository {
  constructor({ db = sequelize } = {}) {
    super();
    this.db = db;
  }

  async enqueue(
    { eventType, aggregateType, aggregateId, routingKey, payload },
    { transaction } = {}
  ) {
    const rows = await this.db.query(
      `INSERT INTO public.outbox_events
         (event_type, aggregate_type, aggregate_id, routing_key, payload, status)
       VALUES
         (:eventType, :aggregateType, :aggregateId, :routingKey, CAST(:payload AS jsonb), 'pending')
       RETURNING id`,
      {
        replacements: {
          eventType,
          aggregateType,
          aggregateId,
          routingKey,
          payload: JSON.stringify(payload),
        },
        type: QueryTypes.SELECT,
        ...(transaction ? { transaction } : {}),
      }
    );

    if (!rows || rows.length === 0) {
      throw new Error('Failed to enqueue outbox event: no row returned');
    }
    return rows[0].id;
  }

  /** FOR UPDATE SKIP LOCKED: the row locks last as long as the transaction. */
  async claimPendingBatch(limit, { transaction } = {}) {
    return this.db.query(
      `SELECT id, event_type, routing_key, payload, attempts
       FROM public.outbox_events
       WHERE status = 'pending' AND next_attempt_at <= NOW()
       ORDER BY created_at ASC, id ASC
       LIMIT :limit
       FOR UPDATE SKIP LOCKED`,
      {
        replacements: { limit },
        type: QueryTypes.SELECT,
        ...(transaction ? { transaction } : {}),
      }
    );
  }

  async markPublished(id, { transaction } = {}) {
    await this.db.query(
      `UPDATE public.outbox_events
       SET status = 'published', published_at = NOW()
       WHERE id = :id`,
      {
        replacements: { id },
        type: QueryTypes.UPDATE,
        ...(transaction ? { transaction } : {}),
      }
    );
  }

  /** Exponential backoff (2^attempts seconds); marks the event `failed` after `maxAttempts`. */
  async scheduleRetry({ id, error, maxAttempts }, { transaction } = {}) {
    await this.db.query(
      `UPDATE public.outbox_events
       SET attempts = attempts + 1,
           last_error = :error,
           status = CASE WHEN attempts + 1 >= :maxAttempts THEN 'failed' ELSE 'pending' END,
           next_attempt_at = NOW() + (POWER(2, attempts) * INTERVAL '1 second')
       WHERE id = :id`,
      {
        replacements: {
          id,
          error: String(error ?? 'unknown error').slice(0, MAX_ERROR_LENGTH),
          maxAttempts,
        },
        type: QueryTypes.UPDATE,
        ...(transaction ? { transaction } : {}),
      }
    );
  }
}
