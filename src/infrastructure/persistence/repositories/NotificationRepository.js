import { QueryTypes } from 'sequelize';
import { Notification } from '../../../domain/entities/Notification.js';
import { INotificationRepository } from '../../../domain/repositories/INotificationRepository.js';
import { sequelize } from '../../config/sequelize.js';

const NOTIFICATION_COLUMNS = `id, profile_id, type, title, body, action_url, payload, read_at, created_at`;

function toNotification(row) {
  return new Notification({
    id: row.id,
    profileId: row.profile_id,
    type: row.type,
    title: row.title,
    body: row.body ?? null,
    actionUrl: row.action_url ?? null,
    payload: row.payload ?? {},
    readAt: row.read_at ?? null,
    createdAt: row.created_at,
  });
}

export class NotificationRepository extends INotificationRepository {
  constructor({ db = sequelize } = {}) {
    super();
    this.db = db;
  }

  /** true if inserted, false if it already existed */
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
       ON CONFLICT (event_id, profile_id) WHERE event_id IS NOT NULL DO NOTHING
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

  async listByProfile(profileId, { page = 1, limit = 10, unreadOnly = false } = {}) {
    const offset = (page - 1) * limit;
    const unreadFilter = unreadOnly ? 'AND read_at IS NULL' : '';

    const rows = await this.db.query(
      `SELECT ${NOTIFICATION_COLUMNS}
       FROM public.notifications
       WHERE profile_id = :profileId ${unreadFilter}
       ORDER BY created_at DESC, id DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { profileId, limit, offset },
        type: QueryTypes.SELECT,
      }
    );

    const [counts] = await this.db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE read_at IS NULL)::int AS unread
       FROM public.notifications
       WHERE profile_id = :profileId`,
      {
        replacements: { profileId },
        type: QueryTypes.SELECT,
      }
    );

    const unreadCount = Number(counts?.unread ?? 0);
    return {
      items: (rows || []).map(toNotification),
      total: unreadOnly ? unreadCount : Number(counts?.total ?? 0),
      unreadCount,
    };
  }

  async countUnread(profileId) {
    const [row] = await this.db.query(
      `SELECT COUNT(*)::int AS unread
       FROM public.notifications
       WHERE profile_id = :profileId AND read_at IS NULL`,
      {
        replacements: { profileId },
        type: QueryTypes.SELECT,
      }
    );
    return Number(row?.unread ?? 0);
  }

  async markAsRead(notificationId, profileId) {
    const rows = await this.db.query(
      `UPDATE public.notifications
       SET read_at = COALESCE(read_at, now())
       WHERE id = :notificationId AND profile_id = :profileId
       RETURNING ${NOTIFICATION_COLUMNS}`,
      {
        replacements: { notificationId, profileId },
        type: QueryTypes.SELECT,
      }
    );
    return rows && rows.length > 0 ? toNotification(rows[0]) : null;
  }

  async markAllAsRead(profileId) {
    const rows = await this.db.query(
      `UPDATE public.notifications
       SET read_at = now()
       WHERE profile_id = :profileId AND read_at IS NULL
       RETURNING id`,
      {
        replacements: { profileId },
        type: QueryTypes.SELECT,
      }
    );
    return Array.isArray(rows) ? rows.length : 0;
  }
}
