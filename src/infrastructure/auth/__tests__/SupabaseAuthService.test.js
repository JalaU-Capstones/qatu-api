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

  it('should successfully register a user via admin.createUser', async () => {
    mockClient.auth.admin.createUser.mockResolvedValue({
      data: {
        user: { id: 'usr-123', email: 'test@example.com' },
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
  });

  it('should throw EMAIL_ALREADY_EXISTS when user already exists', async () => {
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

  it('should correctly detect existing email in emailExists', async () => {
    mockClient.auth.admin.listUsers.mockResolvedValue({
      data: {
        users: [{ email: 'exists@example.com' }],
      },
      error: null,
    });

    const exists = await authService.emailExists('exists@example.com');
    expect(exists).toBe(true);

    const notExists = await authService.emailExists('other@example.com');
    expect(notExists).toBe(false);
  });
});
