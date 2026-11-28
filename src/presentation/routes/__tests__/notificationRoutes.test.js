import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { supabase } from '../../../infrastructure/config/supabase.js';
import { createNotificationRouter } from '../notificationRoutes.js';

vi.mock('../../../infrastructure/config/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const NOTIFICATION_ID = 'd4e5f6a7-b8c9-4d1e-8f3a-4b5c6d7e8f9a';
const VALID_TOKEN = 'valid-supabase-token';

const withAuth = (testRequest) => testRequest.set('Authorization', `Bearer ${VALID_TOKEN}`);

describe('Notification routes', () => {
  let app;
  let listNotificationsUseCase;
  let getUnreadNotificationsCountUseCase;
  let markNotificationReadUseCase;
  let markAllNotificationsReadUseCase;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    supabase.auth.getUser.mockImplementation(async (token) => {
      // eslint-disable-next-line security/detect-possible-timing-attacks
      if (token === VALID_TOKEN) {
        return {
          data: { user: { id: USER_ID, email: 'buyer@example.com', user_metadata: {} } },
          error: null,
        };
      }
      return { data: { user: null }, error: { message: 'invalid token' } };
    });

    listNotificationsUseCase = { execute: vi.fn() };
    getUnreadNotificationsCountUseCase = { execute: vi.fn() };
    markNotificationReadUseCase = { execute: vi.fn() };
    markAllNotificationsReadUseCase = { execute: vi.fn() };

    app = createApp({
      notificationRoutes: createNotificationRouter({
        listNotificationsUseCase,
        getUnreadNotificationsCountUseCase,
        markNotificationReadUseCase,
        markAllNotificationsReadUseCase,
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['get', '/v1/notifications'],
    ['get', '/v1/notifications/unread-count'],
    ['patch', `/v1/notifications/${NOTIFICATION_ID}/read`],
    ['patch', '/v1/notifications/read-all'],
  ])('%s %s requires authentication', async (method, path) => {
    const agent = request(app);
    const response = await (method === 'get' ? agent.get(path) : agent.patch(path));

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  describe('GET /v1/notifications', () => {
    it('lists the authenticated user notifications with validated paging', async () => {
      listNotificationsUseCase.execute.mockResolvedValue({
        data: [],
        meta: { page: 2, per_page: 5, total: 0, total_pages: 1, unread_count: 0 },
      });

      const response = await withAuth(
        request(app).get('/v1/notifications?page=2&limit=5&unread_only=true')
      );

      expect(response.status).toBe(200);
      expect(response.body.meta.unread_count).toBe(0);
      expect(listNotificationsUseCase.execute).toHaveBeenCalledWith({
        userId: USER_ID,
        page: 2,
        limit: 5,
        unreadOnly: true,
      });
    });

    it('applies the defaults when no query is sent', async () => {
      listNotificationsUseCase.execute.mockResolvedValue({ data: [], meta: {} });

      await withAuth(request(app).get('/v1/notifications'));

      expect(listNotificationsUseCase.execute).toHaveBeenCalledWith({
        userId: USER_ID,
        page: 1,
        limit: 10,
        unreadOnly: false,
      });
    });

    it.each(['limit=51', 'page=0', 'unread_only=maybe'])('rejects %s with 400', async (query) => {
      const response = await withAuth(request(app).get(`/v1/notifications?${query}`));

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(listNotificationsUseCase.execute).not.toHaveBeenCalled();
    });

    it('forwards use case errors to the error handler', async () => {
      listNotificationsUseCase.execute.mockRejectedValue(new Error('db down'));

      const response = await withAuth(request(app).get('/v1/notifications'));

      expect(response.status).toBe(500);
    });
  });

  it('GET /v1/notifications/unread-count returns the badge counter', async () => {
    getUnreadNotificationsCountUseCase.execute.mockResolvedValue({
      data: { unread_count: 3 },
      meta: { timestamp: 'now' },
    });

    const response = await withAuth(request(app).get('/v1/notifications/unread-count'));

    expect(response.status).toBe(200);
    expect(response.body.data.unread_count).toBe(3);
    expect(getUnreadNotificationsCountUseCase.execute).toHaveBeenCalledWith({ userId: USER_ID });
  });

  it('GET /v1/notifications/unread-count forwards errors', async () => {
    getUnreadNotificationsCountUseCase.execute.mockRejectedValue(new Error('db down'));

    const response = await withAuth(request(app).get('/v1/notifications/unread-count'));

    expect(response.status).toBe(500);
  });

  describe('PATCH /v1/notifications/:notificationId/read', () => {
    it('marks the notification as read for the authenticated user', async () => {
      markNotificationReadUseCase.execute.mockResolvedValue({
        data: { id: NOTIFICATION_ID, read_at: '2026-11-26T12:00:00.000Z' },
        meta: {},
      });

      const response = await withAuth(
        request(app).patch(`/v1/notifications/${NOTIFICATION_ID}/read`)
      );

      expect(response.status).toBe(200);
      expect(markNotificationReadUseCase.execute).toHaveBeenCalledWith({
        notificationId: NOTIFICATION_ID,
        userId: USER_ID,
      });
    });

    it('rejects an id that is not a UUID', async () => {
      const response = await withAuth(request(app).patch('/v1/notifications/not-a-uuid/read'));

      expect(response.status).toBe(400);
      expect(markNotificationReadUseCase.execute).not.toHaveBeenCalled();
    });

    it('answers 404 when the notification is not the user’s', async () => {
      const error = new Error('Notification not found');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      markNotificationReadUseCase.execute.mockRejectedValue(error);

      const response = await withAuth(
        request(app).patch(`/v1/notifications/${NOTIFICATION_ID}/read`)
      );

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('requires the CSRF header for cookie sessions', async () => {
      const response = await request(app)
        .patch(`/v1/notifications/${NOTIFICATION_ID}/read`)
        .set('Cookie', [`access_token=${VALID_TOKEN}`, 'csrf_token=abc']);

      expect(response.status).toBe(403);
      expect(markNotificationReadUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /v1/notifications/read-all', () => {
    it('marks every notification of the user as read', async () => {
      markAllNotificationsReadUseCase.execute.mockResolvedValue({
        data: { updated_count: 4 },
        meta: {},
      });

      const response = await withAuth(request(app).patch('/v1/notifications/read-all'));

      expect(response.status).toBe(200);
      expect(response.body.data.updated_count).toBe(4);
      expect(markAllNotificationsReadUseCase.execute).toHaveBeenCalledWith({ userId: USER_ID });
    });

    it('forwards errors', async () => {
      markAllNotificationsReadUseCase.execute.mockRejectedValue(new Error('db down'));

      const response = await withAuth(request(app).patch('/v1/notifications/read-all'));

      expect(response.status).toBe(500);
    });
  });

  it('wires the default use cases when only a repository is injected', async () => {
    const notificationRepository = {
      listByProfile: vi.fn().mockResolvedValue({ items: [], total: 0, unreadCount: 0 }),
      countUnread: vi.fn().mockResolvedValue(0),
      markAsRead: vi.fn().mockResolvedValue(null),
      markAllAsRead: vi.fn().mockResolvedValue(0),
    };
    const defaultApp = createApp({
      notificationRoutes: createNotificationRouter({ notificationRepository }),
    });

    const list = await withAuth(request(defaultApp).get('/v1/notifications'));
    const count = await withAuth(request(defaultApp).get('/v1/notifications/unread-count'));
    const mark = await withAuth(
      request(defaultApp).patch(`/v1/notifications/${NOTIFICATION_ID}/read`)
    );
    const markAll = await withAuth(request(defaultApp).patch('/v1/notifications/read-all'));

    expect([list.status, count.status, mark.status, markAll.status]).toEqual([200, 200, 404, 200]);
    expect(notificationRepository.listByProfile).toHaveBeenCalledWith(USER_ID, {
      page: 1,
      limit: 10,
      unreadOnly: false,
    });
  });
});
