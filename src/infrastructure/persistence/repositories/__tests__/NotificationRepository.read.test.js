import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Notification } from '../../../../domain/entities/Notification.js';
import { NotificationRepository } from '../NotificationRepository.js';

const PROFILE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const NOTIFICATION_ID = 'd4e5f6a7-b8c9-4d1e-8f3a-4b5c6d7e8f9a';

const row = (overrides = {}) => ({
  id: NOTIFICATION_ID,
  profile_id: PROFILE_ID,
  type: 'order_status_changed',
  title: 'Pedido enviado',
  body: 'Tu pedido ORD-1 ahora está enviado.',
  action_url: '/orders/ORD-1',
  payload: { order_id: 'o-1' },
  read_at: null,
  created_at: new Date('2026-11-26T12:00:00.000Z'),
  ...overrides,
});

describe('NotificationRepository — reading and marking', () => {
  let db;
  let repository;

  beforeEach(() => {
    db = { query: vi.fn() };
    repository = new NotificationRepository({ db });
  });

  describe('listByProfile', () => {
    it('pages the user notifications newest first and returns the counters', async () => {
      db.query.mockResolvedValueOnce([row()]).mockResolvedValueOnce([{ total: 12, unread: 3 }]);

      const result = await repository.listByProfile(PROFILE_ID, { page: 2, limit: 5 });

      expect(result.total).toBe(12);
      expect(result.unreadCount).toBe(3);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toBeInstanceOf(Notification);
      expect(result.items[0]).toMatchObject({
        id: NOTIFICATION_ID,
        profileId: PROFILE_ID,
        actionUrl: '/orders/ORD-1',
        readAt: null,
      });

      const [sql, options] = db.query.mock.calls[0];
      expect(sql).toContain('WHERE profile_id = :profileId');
      expect(sql).toContain('ORDER BY created_at DESC, id DESC');
      expect(sql).not.toContain('read_at IS NULL');
      expect(options.replacements).toEqual({ profileId: PROFILE_ID, limit: 5, offset: 5 });
    });

    it('filters unread notifications and reports the unread total', async () => {
      db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 12, unread: 3 }]);

      const result = await repository.listByProfile(PROFILE_ID, { unreadOnly: true });

      expect(db.query.mock.calls[0][0]).toContain('AND read_at IS NULL');
      expect(db.query.mock.calls[0][1].replacements).toMatchObject({ limit: 10, offset: 0 });
      expect(result).toEqual({ items: [], total: 3, unreadCount: 3 });
    });

    it('defaults missing counters and payload to safe values', async () => {
      db.query
        .mockResolvedValueOnce([row({ payload: null, body: undefined, action_url: undefined })])
        .mockResolvedValueOnce([]);

      const result = await repository.listByProfile(PROFILE_ID);

      expect(result.total).toBe(0);
      expect(result.unreadCount).toBe(0);
      expect(result.items[0]).toMatchObject({ payload: {}, body: null, actionUrl: null });
      expect(result.items[0].isRead).toBe(false);
    });
  });

  it('counts the unread notifications of a user', async () => {
    db.query.mockResolvedValueOnce([{ unread: 4 }]);

    await expect(repository.countUnread(PROFILE_ID)).resolves.toBe(4);
    expect(db.query.mock.calls[0][0]).toContain('read_at IS NULL');
    expect(db.query.mock.calls[0][1].replacements).toEqual({ profileId: PROFILE_ID });
  });

  it('counts zero when the count query returns no row', async () => {
    db.query.mockResolvedValueOnce([]);

    await expect(repository.countUnread(PROFILE_ID)).resolves.toBe(0);
  });

  describe('markAsRead', () => {
    it('marks only the owner notification and keeps an existing read_at', async () => {
      const readAt = new Date('2026-11-26T13:00:00.000Z');
      db.query.mockResolvedValueOnce([row({ read_at: readAt })]);

      const notification = await repository.markAsRead(NOTIFICATION_ID, PROFILE_ID);

      expect(notification).toBeInstanceOf(Notification);
      expect(notification.isRead).toBe(true);
      const [sql, options] = db.query.mock.calls[0];
      expect(sql).toContain('SET read_at = COALESCE(read_at, now())');
      expect(sql).toContain('WHERE id = :notificationId AND profile_id = :profileId');
      expect(options.replacements).toEqual({
        notificationId: NOTIFICATION_ID,
        profileId: PROFILE_ID,
      });
    });

    it('returns null when the notification is missing or belongs to someone else', async () => {
      db.query.mockResolvedValueOnce([]);

      await expect(repository.markAsRead(NOTIFICATION_ID, 'someone-else')).resolves.toBeNull();
    });
  });

  it('marks every unread notification of the user and returns how many changed', async () => {
    db.query.mockResolvedValueOnce([{ id: 'n-1' }, { id: 'n-2' }]);

    await expect(repository.markAllAsRead(PROFILE_ID)).resolves.toBe(2);
    expect(db.query.mock.calls[0][0]).toContain(
      'WHERE profile_id = :profileId AND read_at IS NULL'
    );
  });

  it('returns zero when nothing was unread', async () => {
    db.query.mockResolvedValueOnce(undefined);

    await expect(repository.markAllAsRead(PROFILE_ID)).resolves.toBe(0);
  });
});
