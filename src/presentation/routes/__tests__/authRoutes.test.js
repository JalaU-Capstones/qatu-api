import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../../../app.js';
import { supabase } from '../../../infrastructure/config/supabase.js';
import { createAuthRouter } from '../authRoutes.js';

vi.mock('../../../infrastructure/config/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      refreshSession: vi.fn(),
      admin: {
        createUser: vi.fn(),
        listUsers: vi.fn(),
        signOut: vi.fn(),
      },
    },
  },
}));

describe('Auth Routes Integration', () => {
  let app;
  let mockAuthService;
  let mockProfileRepository;

  const validRegistrationPayload = {
    email: 'newbuyer@example.com',
    password: 'SecureP@ssword123!',
    username: 'buyer_pro',
    full_name: 'Jane Doe',
  };

  const mockProfile = {
    id: 'user-uuid-999',
    username: 'buyer_pro',
    full_name: 'Jane Doe',
    email: 'newbuyer@example.com',
    avatar_path: null,
    bio: null,
    locale: 'en',
    roles: [
      {
        id: 1,
        name: 'buyer',
        created_at: '2026-10-15T10:00:00.000Z',
      },
    ],
    createdAt: new Date('2026-10-15T10:00:00.000Z'),
    updatedAt: new Date('2026-10-15T10:00:00.000Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    supabase.auth.getUser.mockImplementation(async (token) => {
      // eslint-disable-next-line security/detect-possible-timing-attacks
      if (token === 'jwt.token.here') {
        return {
          data: {
            user: {
              id: 'user-uuid-999',
              email: 'newbuyer@example.com',
              role: 'authenticated',
              user_metadata: { role: 'buyer' },
            },
          },
          error: null,
        };
      }
      return { data: { user: null }, error: new Error('Invalid token') };
    });

    mockAuthService = {
      emailExists: vi.fn().mockResolvedValue(false),
      registerUser: vi.fn().mockResolvedValue({
        id: 'user-uuid-999',
        email: 'newbuyer@example.com',
        created_at: '2026-10-15T10:00:00.000Z',
        token: 'jwt.token.here',
        session: {
          access_token: 'jwt.token.here',
          refresh_token: 'refresh.token.here',
          token_type: 'bearer',
        },
      }),
      loginUser: vi.fn().mockResolvedValue({
        id: 'user-uuid-999',
        email: 'newbuyer@example.com',
        created_at: '2026-10-15T10:00:00.000Z',
        token: 'jwt.token.here',
        refresh_token: 'refresh.token.here',
      }),
      getUserFromToken: vi.fn().mockResolvedValue({
        id: 'user-uuid-999',
        email: 'newbuyer@example.com',
        role: 'authenticated',
        user_metadata: { role: 'buyer' },
      }),
      refreshSession: vi.fn().mockResolvedValue({
        user: {
          id: 'user-uuid-999',
          email: 'newbuyer@example.com',
          created_at: '2026-10-15T10:00:00.000Z',
        },
        session: {
          access_token: 'new.jwt.token',
          refresh_token: 'new.refresh.token',
        },
      }),
      logoutUser: vi.fn().mockResolvedValue({ success: true }),
    };

    mockProfileRepository = {
      create: vi.fn().mockImplementation(async (profile) => profile),
      findById: vi.fn().mockResolvedValue(mockProfile),
      findByUsername: vi.fn(),
    };

    const customRouter = createAuthRouter({
      authService: mockAuthService,
      profileRepository: mockProfileRepository,
    });

    app = createApp({ authRoutes: customRouter });
  });

  describe('POST /v1/auth/register', () => {
    it('Scenario: Successful registration matching OpenAPI contract exactly (201)', async () => {
      const response = await request(app).post('/v1/auth/register').send(validRegistrationPayload);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        data: {
          user: {
            id: 'user-uuid-999',
            email: 'newbuyer@example.com',
            created_at: expect.any(String),
          },
          profile: {
            id: 'user-uuid-999',
            username: 'buyer_pro',
            full_name: 'Jane Doe',
            email: 'newbuyer@example.com',
            avatar_path: null,
            bio: null,
            locale: 'en',
            created_at: expect.any(String),
            updated_at: expect.any(String),
          },
          roles: [
            {
              id: 1,
              name: 'buyer',
              created_at: expect.any(String),
            },
          ],
        },
        meta: {
          timestamp: expect.any(String),
        },
      });
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'].length).toBe(3);
    });

    it('Scenario: Successful registration using camelCase fullName (201)', async () => {
      const response = await request(app).post('/v1/auth/register').send({
        email: 'newbuyer@example.com',
        password: 'SecureP@ssword123!',
        username: 'buyer_pro',
        fullName: 'Jane Doe',
      });

      expect(response.status).toBe(201);
      expect(response.body.data.profile.full_name).toBe('Jane Doe');
      expect(response.body.data.token).toBeUndefined();
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('Scenario: Email already registered (409)', async () => {
      mockAuthService.emailExists.mockResolvedValue(true);

      const response = await request(app).post('/v1/auth/register').send(validRegistrationPayload);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: {
          code: 'CONFLICT',
          message: 'A resource with these attributes already exists',
        },
        meta: {
          timestamp: expect.any(String),
        },
      });
    });

    it('Scenario: Invalid email format (400)', async () => {
      const response = await request(app)
        .post('/v1/auth/register')
        .send({
          ...validRegistrationPayload,
          email: 'not-an-email',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'email' })])
      );
    });

    it('Scenario: Weak password (400)', async () => {
      const response = await request(app)
        .post('/v1/auth/register')
        .send({
          ...validRegistrationPayload,
          password: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('Scenario: SQL-looking email is rejected with a field error (US-24)', async () => {
      const response = await request(app)
        .post('/v1/auth/register')
        .send({
          ...validRegistrationPayload,
          email: "'; DROP TABLE users;--",
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'email' })])
      );
      expect(mockAuthService.registerUser).not.toHaveBeenCalled();
    });

    it('Scenario: SQL-looking username is rejected with a field error (US-24)', async () => {
      const response = await request(app)
        .post('/v1/auth/register')
        .send({
          ...validRegistrationPayload,
          username: "admin'; DROP TABLE users;--",
        });

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'username' })])
      );
      expect(mockAuthService.registerUser).not.toHaveBeenCalled();
    });

    it('Scenario: SQL-looking full name is stored as data (US-24)', async () => {
      const payload = "Robert'); DROP TABLE profiles;--";
      const response = await request(app)
        .post('/v1/auth/register')
        .send({
          ...validRegistrationPayload,
          full_name: payload,
        });

      expect(response.status).toBe(201);
      const savedProfile = mockProfileRepository.create.mock.calls[0][0];
      expect(savedProfile.full_name).toBe(payload);
      expect(mockAuthService.registerUser.mock.calls[0][0].metadata.full_name).toBe(payload);
    });

    it('Scenario: Missing required fields (400)', async () => {
      const response = await request(app).post('/v1/auth/register').send({
        email: 'user@example.com',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.meta).toHaveProperty('timestamp');
    });
  });

  describe('GET /v1/auth/me', () => {
    it('returns 200 with current user profile when authenticated with cookie', async () => {
      const response = await request(app)
        .get('/v1/auth/me')
        .set('Cookie', ['access_token=jwt.token.here']);

      expect(response.status).toBe(200);
      expect(response.body.data.user.id).toBe('user-uuid-999');
      expect(response.body.data.profile.username).toBe('buyer_pro');
      expect(response.body.data.roles).toHaveLength(1);
    });

    it('returns 200 with current user profile when authenticated with Bearer token', async () => {
      const response = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', 'Bearer jwt.token.here');

      expect(response.status).toBe(200);
      expect(response.body.data.user.id).toBe('user-uuid-999');
      expect(response.body.data.profile.username).toBe('buyer_pro');
    });

    it('returns 401 when no token is provided', async () => {
      const response = await request(app).get('/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /v1/auth/refresh', () => {
    it('returns 200 and rotates cookies when refresh_token cookie is provided', async () => {
      mockAuthService.refreshSession.mockResolvedValueOnce({
        userId: 'user-uuid-999',
        accessToken: 'new.jwt.token',
        refreshToken: 'new.refresh.token',
      });

      const response = await request(app)
        .post('/v1/auth/refresh')
        .set('Cookie', ['refresh_token=valid.refresh.token']);

      expect(response.status).toBe(200);
      expect(response.body.data.user.id).toBe('user-uuid-999');
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'].length).toBe(3);
    });

    it('returns 401 when refresh_token cookie is missing', async () => {
      const response = await request(app).post('/v1/auth/refresh').send({});

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /v1/auth/logout', () => {
    it('returns 204 and clears cookies', async () => {
      const response = await request(app)
        .post('/v1/auth/logout')
        .set('Cookie', [
          'access_token=current.atk; refresh_token=current.rtk; csrf_token=somecsrf',
        ]);

      expect(response.status).toBe(204);
      expect(response.headers['set-cookie']).toBeDefined();
      // Clearing 3 cookies
      expect(response.headers['set-cookie'].length).toBe(3);
      expect(mockAuthService.logoutUser).toHaveBeenCalled();
    });
  });

  describe('Health endpoint', () => {
    it('responds with 200 ok', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('Full cookie-auth cycle (E2E)', () => {
    const e2eUserId = '70bad968-8a66-4490-badf-3cc12438c053';
    const cycleUserId = '63156ff9-3909-4ec1-a6bc-978c51d2d16c';

    it('register sets access_token, refresh_token, csrf_token; body has no token', async () => {
      supabase.auth.admin.createUser.mockResolvedValueOnce({
        data: {
          user: { id: e2eUserId, email: 'e2e@example.com', created_at: '2026-10-01T00:00:00Z' },
        },
        error: null,
      });
      supabase.auth.admin.listUsers.mockResolvedValueOnce({
        data: { users: [] },
        error: null,
      });
      supabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: {
          session: { access_token: 'atk-1', refresh_token: 'rtk-1' },
          user: { id: e2eUserId, email: 'e2e@example.com', user_metadata: {} },
        },
        error: null,
      });

      const agent = request.agent(createApp());
      const res = await agent.post('/v1/auth/register').send({
        email: 'e2e@example.com',
        password: 'StrongPassword123!',
        username: 'e2e_user',
        full_name: 'E2E User',
      });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data).toHaveProperty('profile');
      expect(res.body.data).toHaveProperty('roles');
      expect(res.body.data.token).toBeUndefined();
      expect(res.body.data.session).toBeUndefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieNames = cookies.map((c) => c.split('=')[0]);
      expect(cookieNames).toContain('access_token');
      expect(cookieNames).toContain('refresh_token');
      expect(cookieNames).toContain('csrf_token');

      // Verify flags
      const accessCookie = cookies.find((c) => c.startsWith('access_token='));
      expect(accessCookie).toMatch(/HttpOnly/i);
      expect(accessCookie).toMatch(/SameSite=Strict/i);

      const csrfCookie = cookies.find((c) => c.startsWith('csrf_token='));
      expect(csrfCookie).not.toMatch(/HttpOnly/i);
      expect(csrfCookie).toMatch(/SameSite=Strict/i);
    });

    it('GET /me returns user+profile+roles (no token) when cookie-authenticated', async () => {
      supabase.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: e2eUserId,
            email: 'e2e@example.com',
            role: 'authenticated',
            user_metadata: { role: 'buyer' },
          },
        },
        error: null,
      });

      const agent = request.agent(createApp());
      // Inject cookies manually (mock session from register)
      agent.jar.setCookie('access_token=atk-1; Path=/; HttpOnly');

      const res = await agent.get('/v1/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe(e2eUserId);
      expect(res.body.data.token).toBeUndefined();
    });

    it('GET /me returns 401 when no session cookie is present', async () => {
      const agent = request.agent(createApp());
      const res = await agent.get('/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('POST /refresh rotates cookies WITHOUT needing X-CSRF-Token (auth-exempt)', async () => {
      supabase.auth.refreshSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'atk-2',
            refresh_token: 'rtk-2',
            user: { id: e2eUserId },
          },
          user: { id: e2eUserId },
        },
        error: null,
      });

      const agent = request.agent(createApp());
      agent.jar.setCookie('refresh_token=rtk-1; Path=/; HttpOnly');

      const res = await agent.post('/v1/auth/refresh');
      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeUndefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies.map((c) => c.split('=')[0])).toEqual(
        expect.arrayContaining(['access_token', 'refresh_token', 'csrf_token'])
      );

      // CRITICAL: no X-CSRF-Token header was sent — this proves /refresh is CSRF-exempt
    });

    it('POST /logout clears all cookies and returns 204 (without X-CSRF-Token needed)', async () => {
      supabase.auth.admin.signOut.mockResolvedValueOnce({ error: null });

      const agent = request.agent(createApp());
      agent.jar.setCookie('access_token=atk-1; Path=/; HttpOnly');
      agent.jar.setCookie('refresh_token=rtk-1; Path=/; HttpOnly');

      const res = await agent.post('/v1/auth/logout');
      expect(res.status).toBe(204);

      const cookies = res.headers['set-cookie'];
      const clearedCookies = cookies.filter((c) => /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c));
      expect(clearedCookies.length).toBeGreaterThanOrEqual(2);
    });

    it('full cycle: register → me → refresh → logout → me returns 401', async () => {
      // Register mocks
      supabase.auth.admin.createUser.mockResolvedValueOnce({
        data: {
          user: {
            id: cycleUserId,
            email: 'cycle@example.com',
            created_at: '2026-10-01T00:00:00Z',
          },
        },
        error: null,
      });
      supabase.auth.admin.listUsers.mockResolvedValueOnce({ data: { users: [] }, error: null });
      supabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: {
          session: { access_token: 'atk-initial', refresh_token: 'rtk-initial' },
          user: { id: cycleUserId, email: 'cycle@example.com', user_metadata: {} },
        },
        error: null,
      });

      // Me mock (2 calls — after register, and after logout which should fail)
      supabase.auth.getUser
        .mockResolvedValueOnce({
          data: {
            user: {
              id: cycleUserId,
              email: 'cycle@example.com',
              role: 'authenticated',
              user_metadata: { role: 'buyer' },
            },
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid' } });

      // Refresh mock
      supabase.auth.refreshSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'atk-rotated',
            refresh_token: 'rtk-rotated',
            user: { id: cycleUserId },
          },
          user: { id: cycleUserId },
        },
        error: null,
      });

      // SignOut mock
      supabase.auth.admin.signOut.mockResolvedValueOnce({ error: null });

      const agent = request.agent(createApp());

      // 1. Register
      const r1 = await agent.post('/v1/auth/register').send({
        email: 'cycle@example.com',
        password: 'StrongPassword123!',
        username: 'cycle_user',
        full_name: 'Cycle User',
      });
      expect(r1.status).toBe(201);

      // 2. Me works
      const r2 = await agent.get('/v1/auth/me');
      expect(r2.status).toBe(200);
      expect(r2.body.data.user.id).toBe(cycleUserId);

      // 3. Refresh rotates cookies
      const r3 = await agent.post('/v1/auth/refresh');
      expect(r3.status).toBe(200);
      const rotatedCookies = r3.headers['set-cookie'].find((c) => c.startsWith('access_token='));
      expect(rotatedCookies).toContain('atk-rotated');

      // 4. Logout clears
      const r4 = await agent.post('/v1/auth/logout');
      expect(r4.status).toBe(204);

      // 5. Me fails after logout
      const r5 = await agent.get('/v1/auth/me');
      expect(r5.status).toBe(401);
    });
  });
});
