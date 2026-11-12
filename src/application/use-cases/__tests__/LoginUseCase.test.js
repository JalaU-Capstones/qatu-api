import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginRequestDTO, LoginResponseDTO } from '../../dtos/LoginDTO.js';
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

  it('authenticates user and returns OpenAPI compliant response with existing profile and session', async () => {
    const now = new Date('2026-10-14T10:00:00.000Z');
    mockAuthService.loginUser.mockResolvedValue({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'buyer@example.com',
      created_at: now.toISOString(),
      token: 'jwt-token-123',
      refresh_token: 'refresh-token-456',
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

    expect(result.response).toBeInstanceOf(LoginResponseDTO);
    expect(result.response.data.user.email).toBe('buyer@example.com');
    expect(result.response.data.profile.username).toBe('john_doe');
    expect(result.response.data.roles).toEqual([
      { id: 1, name: 'buyer', created_at: now.toISOString() },
    ]);
    expect(result.response.meta.timestamp).toEqual(expect.any(String));

    expect(result.response.toJSON().data.token).toBeUndefined();
    expect(result.token).toBeUndefined();

    expect(result.session.accessToken).toBe('jwt-token-123');
    expect(result.session.refreshToken).toBe('refresh-token-456');
  });

  it('falls back to metadata when profile row is not yet in application db', async () => {
    mockAuthService.loginUser.mockResolvedValue({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'buyer@example.com',
      created_at: '2026-10-14T10:00:00.000Z',
      token: 'jwt-token-123',
      refresh_token: 'refresh-token-456',
      user_metadata: { username: 'fallback_user', full_name: 'Fallback User' },
    });
    mockProfileRepo.findById.mockResolvedValue(null);

    const result = await useCase.execute({
      email: 'buyer@example.com',
      password: 'StrongPassword123!',
    });

    expect(result.response).toBeInstanceOf(LoginResponseDTO);
    expect(result.response.data.profile.username).toBe('fallback_user');
    expect(result.response.data.roles[0].name).toBe('buyer');
    expect(result.session.accessToken).toBe('jwt-token-123');
    expect(result.session.refreshToken).toBe('refresh-token-456');
  });

  it('returns { response, session } with accessToken and refreshToken from Supabase', async () => {
    mockAuthService.loginUser.mockResolvedValueOnce({
      id: 'u-1',
      email: 'buyer@example.com',
      created_at: '2026-10-01T00:00:00.000Z',
      token: 'access-jwt',
      refresh_token: 'refresh-uuid',
      user_metadata: { role: 'buyer' },
    });
    mockProfileRepo.findById.mockResolvedValueOnce(null);

    const result = await useCase.execute({
      email: 'buyer@example.com',
      password: 'Pass123!',
    });

    expect(result.session.accessToken).toBe('access-jwt');
    expect(result.session.refreshToken).toBe('refresh-uuid');
    expect(result.response).toBeInstanceOf(LoginResponseDTO);
    expect(result.response.toJSON().data.token).toBeUndefined();
  });
});
