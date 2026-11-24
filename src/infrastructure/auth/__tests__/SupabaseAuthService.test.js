import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseAuthService } from '../SupabaseAuthService.js';

describe('SupabaseAuthService', () => {
  let mockClient;
  let authService;

  beforeEach(() => {
    mockClient = {
      auth: {
        admin: {
          createUser: vi.fn(),
          listUsers: vi.fn(),
          signOut: vi.fn(),
        },
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        refreshSession: vi.fn(),
      },
    };
    authService = new SupabaseAuthService({ client: mockClient });
  });

  describe('registerUser', () => {
    it('should throw if client is not initialized', async () => {
      const serviceWithoutClient = new SupabaseAuthService();
      await expect(
        serviceWithoutClient.registerUser({
          email: 'test@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow('Supabase client not initialized');
    });

    it('should successfully register a user via admin.createUser and signInWithPassword for real JWT', async () => {
      mockClient.auth.admin.createUser.mockResolvedValue({
        data: {
          user: {
            id: 'usr-123',
            email: 'test@example.com',
            created_at: '2026-10-15T10:00:00.000Z',
          },
        },
        error: null,
      });

      mockClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          session: {
            access_token: 'valid.real.jwt.token',
            refresh_token: 'valid.refresh.token',
          },
        },
        error: null,
      });

      const result = await authService.registerUser({
        email: 'test@example.com',
        password: 'Password123!',
        role: 'buyer',
      });

      expect(mockClient.auth.admin.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          password: 'Password123!',
        })
      );
      expect(mockClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result.id).toBe('usr-123');
      expect(result.email).toBe('test@example.com');
      expect(result.token).toBe('valid.real.jwt.token');
      expect(result.refresh_token).toBe('valid.refresh.token');
      expect(result.created_at).toBe('2026-10-15T10:00:00.000Z');
      expect(result.session.access_token).toBe('valid.real.jwt.token');
    });

    it('should throw when signInWithPassword fails after admin.createUser', async () => {
      mockClient.auth.admin.createUser.mockResolvedValue({
        data: {
          user: { id: 'usr-123', email: 'test@example.com' },
        },
        error: null,
      });

      mockClient.auth.signInWithPassword.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid credentials' },
      });

      await expect(
        authService.registerUser({
          email: 'test@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow('Failed to sign in newly created user: Invalid credentials');
    });

    it('should throw EMAIL_ALREADY_EXISTS when admin.createUser returns conflict or 422', async () => {
      mockClient.auth.admin.createUser.mockResolvedValue({
        data: null,
        error: { message: 'A user with this email already exists', status: 422 },
      });

      await expect(
        authService.registerUser({
          email: 'exists@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow('Email already registered');
    });

    it('should throw generic error when admin.createUser fails unexpectedly', async () => {
      mockClient.auth.admin.createUser.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed', status: 500 },
      });

      await expect(
        authService.registerUser({
          email: 'fail@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow('Failed to create user in Supabase: Database connection failed');
    });

    it('should register user via signUp and signInWithPassword when admin API is not present', async () => {
      const clientWithOnlySignUp = {
        auth: {
          signUp: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'usr-signup-456',
                email: 'signup@example.com',
                created_at: '2026-10-15T12:00:00.000Z',
              },
              session: null,
            },
            error: null,
          }),
          signInWithPassword: vi.fn().mockResolvedValue({
            data: {
              session: {
                access_token: 'signup-real-jwt',
                refresh_token: 'signup-refresh',
              },
            },
            error: null,
          }),
        },
      };

      const service = new SupabaseAuthService({ client: clientWithOnlySignUp });
      const result = await service.registerUser({
        email: 'signup@example.com',
        password: 'Password123!',
      });

      expect(result.id).toBe('usr-signup-456');
      expect(result.token).toBe('signup-real-jwt');
    });

    it('should throw EMAIL_ALREADY_EXISTS when signUp returns conflict', async () => {
      const clientWithOnlySignUp = {
        auth: {
          signUp: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'User already registered', status: 409 },
          }),
          signInWithPassword: vi.fn(),
        },
      };

      const service = new SupabaseAuthService({ client: clientWithOnlySignUp });
      await expect(
        service.registerUser({
          email: 'exists@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow('Email already registered');
    });

    it('should throw generic error when signUp fails unexpectedly', async () => {
      const clientWithOnlySignUp = {
        auth: {
          signUp: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Network error', status: 500 },
          }),
          signInWithPassword: vi.fn(),
        },
      };

      const service = new SupabaseAuthService({ client: clientWithOnlySignUp });
      await expect(
        service.registerUser({
          email: 'fail@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow('Failed to sign up in Supabase: Network error');
    });
  });

  describe('emailExists', () => {
    it('should throw if client is not initialized', async () => {
      const serviceWithoutClient = new SupabaseAuthService();
      await expect(serviceWithoutClient.emailExists('test@example.com')).rejects.toThrow(
        'Supabase client not initialized'
      );
    });

    it('should return true when email exists in listUsers', async () => {
      mockClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ email: 'exists@example.com' }] },
        error: null,
      });

      const exists = await authService.emailExists('exists@example.com');
      expect(exists).toBe(true);
    });

    it('should return false when email does not exist in listUsers', async () => {
      mockClient.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ email: 'exists@example.com' }] },
        error: null,
      });

      const exists = await authService.emailExists('other@example.com');
      expect(exists).toBe(false);
    });

    it('should return false when listUsers returns an error or empty', async () => {
      mockClient.auth.admin.listUsers.mockResolvedValue({
        data: null,
        error: { message: 'Forbidden' },
      });

      const exists = await authService.emailExists('test@example.com');
      expect(exists).toBe(false);
    });

    it('should return false if admin.listUsers is not available', async () => {
      const basicClient = { auth: {} };
      const service = new SupabaseAuthService({ client: basicClient });
      const exists = await service.emailExists('test@example.com');
      expect(exists).toBe(false);
    });
  });

  describe('loginUser', () => {
    it('returns refresh_token alongside token on successful login', async () => {
      mockClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'access-jwt',
            refresh_token: 'refresh-uuid',
          },
          user: {
            id: 'u-1',
            email: 'buyer@example.com',
            created_at: '2026-10-01T00:00:00.000Z',
            user_metadata: {},
          },
        },
        error: null,
      });

      const result = await authService.loginUser({
        email: 'buyer@example.com',
        password: 'StrongPassword123!',
      });

      expect(result.token).toBe('access-jwt');
      expect(result.refresh_token).toBe('refresh-uuid');
    });
  });

  describe('refreshSession', () => {
    it('returns rotated tokens on success', async () => {
      mockClient.auth.refreshSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'new-access-jwt',
            refresh_token: 'new-refresh-uuid',
            expires_at: 9999999999,
            user: { id: 'u-1' },
          },
          user: { id: 'u-1' },
        },
        error: null,
      });

      const result = await authService.refreshSession('old-refresh-uuid');

      expect(mockClient.auth.refreshSession).toHaveBeenCalledWith({
        refresh_token: 'old-refresh-uuid',
      });
      expect(result.accessToken).toBe('new-access-jwt');
      expect(result.refreshToken).toBe('new-refresh-uuid');
      expect(result.userId).toBe('u-1');
    });

    it('throws INVALID_REQUEST (400) when refresh token is missing', async () => {
      await expect(authService.refreshSession('')).rejects.toMatchObject({
        code: 'INVALID_REQUEST',
        statusCode: 400,
      });
      expect(mockClient.auth.refreshSession).not.toHaveBeenCalled();
    });

    it('throws INVALID_REQUEST (400) when refresh token is not a string', async () => {
      await expect(authService.refreshSession(123)).rejects.toMatchObject({
        code: 'INVALID_REQUEST',
        statusCode: 400,
      });
    });

    it('throws UNAUTHORIZED (401) when Supabase rejects the refresh', async () => {
      mockClient.auth.refreshSession.mockResolvedValueOnce({
        data: { session: null, user: null },
        error: { message: 'Invalid refresh token' },
      });

      await expect(authService.refreshSession('expired-refresh')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });
    });
  });

  describe('logoutUser', () => {
    it('returns success when admin.signOut succeeds on the first attempt', async () => {
      mockClient.auth.admin.signOut.mockResolvedValueOnce({ error: null });

      const result = await authService.logoutUser({
        accessToken: 'valid-jwt',
        refreshToken: 'refresh-uuid',
      });

      expect(result.success).toBe(true);
      expect(mockClient.auth.admin.signOut).toHaveBeenCalledTimes(1);
      expect(mockClient.auth.admin.signOut).toHaveBeenCalledWith('valid-jwt');
    });

    it('falls back to refreshSession then signOut when direct signOut fails', async () => {
      mockClient.auth.admin.signOut
        .mockResolvedValueOnce({ error: { message: 'JWT expired' } })
        .mockResolvedValueOnce({ error: null }); // second call after refresh
      mockClient.auth.refreshSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'fresh-jwt',
            refresh_token: 'fresh-refresh-uuid',
          },
          user: { id: 'u-1' },
        },
        error: null,
      });

      const result = await authService.logoutUser({
        accessToken: 'expired-jwt',
        refreshToken: 'valid-refresh-uuid',
      });

      expect(result.success).toBe(true);
      expect(mockClient.auth.admin.signOut).toHaveBeenCalledTimes(2);
      expect(mockClient.auth.admin.signOut).toHaveBeenNthCalledWith(1, 'expired-jwt');
      expect(mockClient.auth.admin.signOut).toHaveBeenNthCalledWith(2, 'fresh-jwt');
    });

    it('returns { success: false } when both attempts fail', async () => {
      mockClient.auth.admin.signOut.mockResolvedValueOnce({ error: { message: 'JWT expired' } });
      mockClient.auth.refreshSession.mockResolvedValueOnce({
        data: { session: null, user: null },
        error: { message: 'Invalid refresh token' },
      });

      const result = await authService.logoutUser({
        accessToken: 'expired-jwt',
        refreshToken: 'expired-refresh',
      });

      expect(result).toEqual({ success: false, reason: 'revocation_failed' });
    });

    it('does not throw when Supabase SDK methods throw unexpectedly', async () => {
      mockClient.auth.admin.signOut.mockRejectedValueOnce(new Error('network'));
      mockClient.auth.refreshSession.mockRejectedValueOnce(new Error('network'));

      const result = await authService.logoutUser({
        accessToken: 'any',
        refreshToken: 'any',
      });

      expect(result).toEqual({ success: false, reason: 'revocation_failed' });
    });

    it('handles missing accessToken and refreshToken gracefully', async () => {
      const result = await authService.logoutUser({});
      expect(result).toEqual({ success: false, reason: 'revocation_failed' });
      expect(mockClient.auth.admin.signOut).not.toHaveBeenCalled();
    });
  });
});

const makeClient = (overrides = {}) => ({
  auth: {
    admin: {
      createUser: vi.fn(),
      listUsers: vi.fn(),
      signOut: vi.fn(),
    },
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    refreshSession: vi.fn(),
    getUser: vi.fn(),
    ...overrides,
  },
});

const session = (overrides = {}) => ({
  access_token: 'access-jwt',
  refresh_token: 'refresh-uuid',
  ...overrides,
});

describe('SupabaseAuthService — remaining branches', () => {
  let client;
  let service;

  beforeEach(() => {
    client = makeClient();
    service = new SupabaseAuthService({ client });
  });

  it('throws for every method when the client is not initialized', async () => {
    const empty = new SupabaseAuthService();

    await expect(empty.registerUser({ email: 'a@b.com' })).rejects.toThrow(
      'Supabase client not initialized'
    );
    await expect(empty.loginUser({ email: 'a@b.com', password: 'pw' })).rejects.toThrow(
      'Supabase client not initialized'
    );
    await expect(empty.refreshSession('token')).rejects.toThrow('Supabase client not initialized');
    await expect(empty.logoutUser({})).rejects.toThrow('Supabase client not initialized');
    await expect(empty.emailExists('a@b.com')).rejects.toThrow('Supabase client not initialized');
    await expect(empty.exchangeOAuthToken('access', 'refresh')).rejects.toThrow(
      'Supabase client not initialized'
    );
  });

  describe('registerUser', () => {
    it('defaults created_at and merges metadata through the admin path', async () => {
      client.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'u-1', email: 'a@b.com' } },
        error: null,
      });
      client.auth.signInWithPassword.mockResolvedValue({
        data: { session: session() },
        error: null,
      });

      const result = await service.registerUser({
        email: 'a@b.com',
        password: 'pw',
        metadata: { full_name: 'Test' },
      });

      expect(result.created_at).toEqual(expect.any(String));
      expect(client.auth.admin.createUser.mock.calls[0][0].user_metadata).toEqual({
        full_name: 'Test',
        role: 'buyer',
      });
    });

    it('defaults created_at and role through the signUp path', async () => {
      const signUpClient = makeClient({ admin: undefined });
      delete signUpClient.auth.admin;
      signUpClient.auth.signUp.mockResolvedValue({
        data: { user: { id: 'u-2', email: 'b@b.com' } },
        error: null,
      });
      signUpClient.auth.signInWithPassword.mockResolvedValue({
        data: { session: session() },
        error: null,
      });
      const signUpService = new SupabaseAuthService({ client: signUpClient });

      const result = await signUpService.registerUser({ email: 'b@b.com', password: 'pw' });

      expect(result.created_at).toEqual(expect.any(String));
      expect(signUpClient.auth.signUp.mock.calls[0][0].options.data).toEqual({ role: 'buyer' });
    });

    it('reports a missing session when signIn returns no error and no token', async () => {
      client.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'u-1', email: 'a@b.com' } },
        error: null,
      });
      client.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });

      await expect(service.registerUser({ email: 'a@b.com', password: 'pw' })).rejects.toThrow(
        'Failed to sign in newly created user: No session returned'
      );
    });

    it('maps conflict messages with mixed casing on both creation paths', async () => {
      client.auth.admin.createUser.mockResolvedValue({
        data: null,
        error: { message: 'ALREADY REGISTERED' },
      });
      await expect(
        service.registerUser({ email: 'a@b.com', password: 'pw' })
      ).rejects.toMatchObject({
        code: 'EMAIL_ALREADY_EXISTS',
        statusCode: 409,
      });

      const signUpClient = { auth: { signUp: vi.fn(), signInWithPassword: vi.fn() } };
      signUpClient.auth.signUp.mockResolvedValue({
        data: null,
        error: { status: 409 },
      });
      const signUpService = new SupabaseAuthService({ client: signUpClient });
      await expect(
        signUpService.registerUser({ email: 'a@b.com', password: 'pw' })
      ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS' });
    });
  });

  describe('loginUser', () => {
    it('normalizes the email and defaults optional user fields', async () => {
      client.auth.signInWithPassword.mockResolvedValue({
        data: { session: session(), user: { id: 'u-1' } },
        error: null,
      });

      const result = await service.loginUser({ email: '  USER@Example.COM ', password: 'pw' });

      expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'pw',
      });
      expect(result.email).toBe('user@example.com');
      expect(result.created_at).toEqual(expect.any(String));
      expect(result.user_metadata).toEqual({});
    });

    it('maps unconfirmed emails to EMAIL_NOT_CONFIRMED', async () => {
      for (const message of ['Email not confirmed', 'Account NOT CONFIRMED']) {
        client.auth.signInWithPassword.mockResolvedValueOnce({
          data: {},
          error: { message },
        });
        await expect(service.loginUser({ email: 'a@b.com', password: 'pw' })).rejects.toMatchObject(
          {
            code: 'EMAIL_NOT_CONFIRMED',
            statusCode: 401,
            message: 'Please confirm your email before logging in',
          }
        );
      }
    });

    it('maps other failures and incomplete sessions to UNAUTHORIZED', async () => {
      client.auth.signInWithPassword
        .mockResolvedValueOnce({ data: {}, error: { message: 'Invalid credentials' } })
        .mockResolvedValueOnce({ data: { session: session() }, error: null })
        .mockResolvedValueOnce({ data: { session: null }, error: null })
        .mockResolvedValueOnce({ data: { user: { id: 'u-1' } }, error: null });

      for (let attempt = 0; attempt < 4; attempt += 1) {
        await expect(service.loginUser({ email: 'a@b.com', password: 'pw' })).rejects.toMatchObject(
          {
            code: 'UNAUTHORIZED',
            statusCode: 401,
          }
        );
      }
    });
  });

  describe('refreshSession', () => {
    it('defaults userId and expiresAt when the session omits them', async () => {
      client.auth.refreshSession.mockResolvedValue({
        data: { session: session() },
        error: null,
      });

      await expect(service.refreshSession('token')).resolves.toMatchObject({
        userId: null,
        expiresAt: null,
      });
    });

    it('rejects a session missing the rotated refresh token', async () => {
      client.auth.refreshSession.mockResolvedValue({
        data: { session: { access_token: 'access' } },
        error: null,
      });

      await expect(service.refreshSession('token')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });
  });

  describe('logoutUser', () => {
    it('succeeds via refresh when no access token is available', async () => {
      client.auth.refreshSession.mockResolvedValue({
        data: { session: session() },
        error: null,
      });
      client.auth.admin.signOut.mockResolvedValue({ error: null });

      await expect(service.logoutUser({ refreshToken: 'refresh' })).resolves.toEqual({
        success: true,
      });
      expect(client.auth.admin.signOut).toHaveBeenCalledWith('access-jwt');
    });

    it('fails when the refresh step errors or returns no session', async () => {
      client.auth.refreshSession
        .mockResolvedValueOnce({ data: null, error: { message: 'expired' } })
        .mockResolvedValueOnce({ data: { session: null }, error: null });

      for (let attempt = 0; attempt < 2; attempt += 1) {
        await expect(service.logoutUser({ refreshToken: 'refresh' })).resolves.toEqual({
          success: false,
          reason: 'revocation_failed',
        });
      }
    });

    it('fails when signOut after a successful refresh returns an error', async () => {
      client.auth.refreshSession.mockResolvedValue({ data: { session: session() }, error: null });
      client.auth.admin.signOut.mockResolvedValue({ error: { message: 'forbidden' } });

      await expect(service.logoutUser({ refreshToken: 'refresh' })).resolves.toEqual({
        success: false,
        reason: 'revocation_failed',
      });
    });
  });

  describe('emailExists', () => {
    it('compares emails case-insensitively and tolerates missing users', async () => {
      client.auth.admin.listUsers.mockResolvedValueOnce({
        data: { users: [{ email: 'User@Example.com' }] },
        error: null,
      });
      await expect(service.emailExists('user@example.com')).resolves.toBe(true);

      client.auth.admin.listUsers.mockResolvedValueOnce({ data: {}, error: null });
      await expect(service.emailExists('user@example.com')).resolves.toBe(false);
    });
  });

  describe('exchangeOAuthToken', () => {
    it('requires both tokens as non-empty strings', async () => {
      await expect(service.exchangeOAuthToken('', 'refresh')).rejects.toMatchObject({
        message: 'accessToken is required',
        statusCode: 400,
      });
      await expect(service.exchangeOAuthToken(123, 'refresh')).rejects.toMatchObject({
        status: 400,
      });
      await expect(service.exchangeOAuthToken('access', null)).rejects.toMatchObject({
        message: 'refreshToken is required',
        statusCode: 400,
      });
      await expect(service.exchangeOAuthToken('access', {})).rejects.toMatchObject({
        status: 400,
      });
      expect(client.auth.getUser).not.toHaveBeenCalled();
    });

    it('rejects invalid or expired access tokens', async () => {
      client.auth.getUser.mockResolvedValueOnce({ data: {}, error: { message: 'expired' } });
      await expect(service.exchangeOAuthToken('access', 'refresh')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401,
        message: 'Invalid or expired OAuth access token',
      });
    });

    it('returns the verified user and both tokens', async () => {
      const user = { id: 'u-1', email: 'a@b.com' };
      client.auth.getUser.mockResolvedValue({ data: { user }, error: null });

      await expect(service.exchangeOAuthToken('access', 'refresh')).resolves.toEqual({
        user,
        accessToken: 'access',
        refreshToken: 'refresh',
      });
      expect(client.auth.getUser).toHaveBeenCalledWith('access');
    });
  });
});
