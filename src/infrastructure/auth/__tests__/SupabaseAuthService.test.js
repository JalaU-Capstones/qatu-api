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
