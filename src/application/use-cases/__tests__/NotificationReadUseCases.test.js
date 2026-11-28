import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Notification } from '../../../domain/entities/Notification.js';
import { GetUnreadNotificationsCountUseCase } from '../GetUnreadNotificationsCountUseCase.js';
import { ListNotificationsUseCase } from '../ListNotificationsUseCase.js';
import { MarkAllNotificationsReadUseCase } from '../MarkAllNotificationsReadUseCase.js';
import { MarkNotificationReadUseCase } from '../MarkNotificationReadUseCase.js';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const NOTIFICATION_ID = 'd4e5f6a7-b8c9-4d1e-8f3a-4b5c6d7e8f9a';

const notification = (overrides = {}) =>
  new Notification({
    id: NOTIFICATION_ID,
    profileId: USER_ID,
    type: 'message_received',
    title: 'Nuevo mensaje recibido',
    body: 'Tienes un mensaje nuevo en tus conversaciones de Qatu.',
    actionUrl: '/conversations?active=c-1',
    payload: { conversation_id: 'c-1' },
    readAt: null,
    createdAt: new Date('2026-11-26T12:00:00.000Z'),
    ...overrides,
  });

describe('Notification read use cases', () => {
  let notificationRepository;

  beforeEach(() => {
    notificationRepository = {
      listByProfile: vi.fn(),
      countUnread: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
    };
  });

  it.each([
    ListNotificationsUseCase,
    GetUnreadNotificationsCountUseCase,
    MarkNotificationReadUseCase,
    MarkAllNotificationsReadUseCase,
  ])('%o requires a notification repository', (UseCase) => {
    expect(() => new UseCase()).toThrow('notificationRepository is required');
  });

  describe('ListNotificationsUseCase', () => {
    it('returns the page in API shape with pagination and unread counters', async () => {
      notificationRepository.listByProfile.mockResolvedValue({
        items: [notification()],
        total: 21,
        unreadCount: 4,
      });
      const useCase = new ListNotificationsUseCase({ notificationRepository });

      const result = await useCase.execute({ userId: USER_ID, page: 2, limit: 10 });

      expect(notificationRepository.listByProfile).toHaveBeenCalledWith(USER_ID, {
        page: 2,
        limit: 10,
        unreadOnly: false,
      });
      expect(result.meta).toEqual({
        page: 2,
        per_page: 10,
        total: 21,
        total_pages: 3,
        unread_count: 4,
      });
      expect(result.data[0]).toEqual({
        id: NOTIFICATION_ID,
        profile_id: USER_ID,
        type: 'message_received',
        title: 'Nuevo mensaje recibido',
        body: 'Tienes un mensaje nuevo en tus conversaciones de Qatu.',
        action_url: '/conversations?active=c-1',
        payload: { conversation_id: 'c-1' },
        read_at: null,
        created_at: '2026-11-26T12:00:00.000Z',
      });
    });

    it('clamps the paging values and forwards the unread filter', async () => {
      notificationRepository.listByProfile.mockResolvedValue({
        items: [],
        total: 0,
        unreadCount: 0,
      });
      const useCase = new ListNotificationsUseCase({ notificationRepository });

      const result = await useCase.execute({
        userId: USER_ID,
        page: 'x',
        limit: 500,
        unreadOnly: true,
      });

      expect(notificationRepository.listByProfile).toHaveBeenCalledWith(USER_ID, {
        page: 1,
        limit: 50,
        unreadOnly: true,
      });
      expect(result.meta.total_pages).toBe(1);
    });
  });

  it('GetUnreadNotificationsCountUseCase returns the unread counter', async () => {
    notificationRepository.countUnread.mockResolvedValue(7);
    const useCase = new GetUnreadNotificationsCountUseCase({ notificationRepository });

    const result = await useCase.execute({ userId: USER_ID });

    expect(notificationRepository.countUnread).toHaveBeenCalledWith(USER_ID);
    expect(result.data).toEqual({ unread_count: 7 });
    expect(result.meta.timestamp).toEqual(expect.any(String));
  });

  describe('MarkNotificationReadUseCase', () => {
    it('returns the notification marked as read', async () => {
      const readAt = new Date('2026-11-26T12:30:00.000Z');
      notificationRepository.markAsRead.mockResolvedValue(notification({ readAt }));
      const useCase = new MarkNotificationReadUseCase({ notificationRepository });

      const result = await useCase.execute({ notificationId: NOTIFICATION_ID, userId: USER_ID });

      expect(notificationRepository.markAsRead).toHaveBeenCalledWith(NOTIFICATION_ID, USER_ID);
      expect(result.data.read_at).toBe('2026-11-26T12:30:00.000Z');
    });

    it('answers 404 for a missing or foreign notification', async () => {
      notificationRepository.markAsRead.mockResolvedValue(null);
      const useCase = new MarkNotificationReadUseCase({ notificationRepository });

      await expect(
        useCase.execute({ notificationId: NOTIFICATION_ID, userId: USER_ID })
      ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    });
  });

  it('MarkAllNotificationsReadUseCase returns how many notifications changed', async () => {
    notificationRepository.markAllAsRead.mockResolvedValue(3);
    const useCase = new MarkAllNotificationsReadUseCase({ notificationRepository });

    const result = await useCase.execute({ userId: USER_ID });

    expect(notificationRepository.markAllAsRead).toHaveBeenCalledWith(USER_ID);
    expect(result.data).toEqual({ updated_count: 3 });
  });
});
