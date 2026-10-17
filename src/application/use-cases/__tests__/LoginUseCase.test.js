import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginRequestDTO } from '../../dtos/LoginDTO.js';
import { LoginUseCase } from '../LoginUseCase.js';

describe('LoginUseCase', () => {
  let mockAuthService;
  let mockProfileRepo;
  let useCase;

  beforeEach(() => {
    mockAuthService = {
      loginUser: vi.fn(),
    };
    mockProfileRepo = {
      findById: vi.fn(),
    };
    useCase = new LoginUseCase({
      authService: mockAuthService,
      profileRepository: mockProfileRepo,
    });
  });

  it('throws if dependencies are missing', () => {
    expect(() => new LoginUseCase({})).toThrow('authService is required');
    expect(() => new LoginUseCase({ authService: mockAuthService })).toThrow(
      'profileRepository is required'
    );
  });

  it('throws 400 if email or password is missing', async () => {
    await expect(useCase.execute({})).rejects.toThrow('Email is required');
    await expect(useCase.execute({ email: 'buyer@example.com' })).rejects.toThrow(
      'Password is required'
    );
  });

  it('authenticates user and returns OpenAPI compliant response with existing profile', async () => {
    const now = new Date('2026-10-14T10:00:00.000Z');
    mockAuthService.loginUser.mockResolvedValue({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'buyer@example.com',
      created_at: now.toISOString(),
      token: 'jwt-token-123',
      user_metadata: { username: 'john_doe' },
    });

    mockProfileRepo.findById.mockResolvedValue({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      username: 'john_doe',
      fullName: 'John Doe',
      email: 'buyer@example.com',
      avatarPath: null,
      bio: null,
      locale: 'en',
      roles: [{ id: 1, name: 'buyer', created_at: now.toISOString() }],
      createdAt: now,
      updatedAt: now,
    });

    const dto = new LoginRequestDTO({
      email: '  BUYER@example.com ',
      password: 'StrongPassword123!',
    });

    const result = await useCase.execute(dto);

    expect(mockAuthService.loginUser).toHaveBeenCalledWith({
      email: 'buyer@example.com',
      password: 'StrongPassword123!',
    });
    expect(result.data.token).toBe('jwt-token-123');
    expect(result.data.user.email).toBe('buyer@example.com');
    expect(result.data.profile.username).toBe('john_doe');
    expect(result.data.roles).toEqual([{ id: 1, name: 'buyer', created_at: now.toISOString() }]);
    expect(result.meta.timestamp).toEqual(expect.any(String));
  });

  it('falls back to metadata when profile row is not yet in application db', async () => {
    mockAuthService.loginUser.mockResolvedValue({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'buyer@example.com',
      created_at: '2026-10-14T10:00:00.000Z',
      token: 'jwt-token-123',
      user_metadata: { username: 'fallback_user', full_name: 'Fallback User' },
    });
    mockProfileRepo.findById.mockResolvedValue(null);

    const result = await useCase.execute({
      email: 'buyer@example.com',
      password: 'StrongPassword123!',
    });

    expect(result.data.profile.username).toBe('fallback_user');
    expect(result.data.roles[0].name).toBe('buyer');
  });
});
