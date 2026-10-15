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
        },
        signUp: vi.fn(),
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

    it('should successfully register a user via admin.createUser', async () => {
      mockClient.auth.admin.createUser.mockResolvedValue({
        data: {
          user: {
            id: 'usr-123',
            email: 'test@example.com',
            created_at: '2026-10-15T10:00:00.000Z',
          },
          session: {
            access_token: 'valid-jwt-token',
          },
        },
        error: null,
      });

      const result = await authService.registerUser({
        email: 'test@example.com',
        password: 'Password123!',
        role: 'buyer',
      });

      expect(result.id).toBe('usr-123');
      expect(result.email).toBe('test@example.com');
      expect(result.token).toBe('valid-jwt-token');
      expect(result.created_at).toBe('2026-10-15T10:00:00.000Z');
      expect(result.session.access_token).toBe('valid-jwt-token');
    });

    it('should fallback to mock token if session is absent in admin.createUser', async () => {
      mockClient.auth.admin.createUser.mockResolvedValue({
        data: {
          user: { id: 'usr-123', email: 'test@example.com' },
          session: null,
        },
        error: null,
      });

      const result = await authService.registerUser({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result.token).toBeDefined();
      expect(result.session.access_token).toBeDefined();
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

    it('should register user via signUp when admin API is not present', async () => {
      const clientWithOnlySignUp = {
        auth: {
          signUp: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'usr-signup-456',
                email: 'signup@example.com',
                created_at: '2026-10-15T12:00:00.000Z',
              },
              session: { access_token: 'signup-jwt' },
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
      expect(result.token).toBe('signup-jwt');
    });

    it('should throw EMAIL_ALREADY_EXISTS when signUp returns conflict', async () => {
      const clientWithOnlySignUp = {
        auth: {
          signUp: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'User already registered', status: 409 },
          }),
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
});
