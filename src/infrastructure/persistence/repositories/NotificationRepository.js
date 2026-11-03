import { QueryTypes } from 'sequelize';
import { INotificationRepository } from '../../../domain/repositories/INotificationRepository.js';
import { sequelize } from '../../config/sequelize.js';

export class NotificationRepository extends INotificationRepository {
  constructor({ db = sequelize } = {}) {
    super();
    this.db = db;
  }

  /** Idempotent on `event_id` (ON CONFLICT DO NOTHING): true if inserted, false if already there. */
  async createFromEvent({
    eventId,
    profileId,
    type,
    title,
    body = null,
    actionUrl = null,
    payload = {},
  }) {
    const rows = await this.db.query(
      `INSERT INTO public.notifications
         (profile_id, type, title, body, action_url, payload, event_id)
       VALUES
         (:profileId, :type, :title, :body, :actionUrl, CAST(:payload AS jsonb), :eventId)
       ON CONFLICT (event_id) WHERE event_id IS NOT NULL DO NOTHING
       RETURNING id`,
      {
        replacements: {
          profileId,
          type,
          title,
          body,
          actionUrl,
          payload: JSON.stringify(payload),
          eventId,
        },
        type: QueryTypes.SELECT,
      }
    );

    return Array.isArray(rows) && rows.length > 0;
  }
}
