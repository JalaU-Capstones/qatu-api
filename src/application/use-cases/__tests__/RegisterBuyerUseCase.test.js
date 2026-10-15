import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegisterRequestDTO } from '../../dtos/RegisterDTO.js';
import { RegisterBuyerUseCase } from '../RegisterBuyerUseCase.js';

describe('RegisterBuyerUseCase', () => {
  let authServiceMock;
  let profileRepositoryMock;
  let useCase;

  const validPayload = {
    email: 'buyer@example.com',
    password: 'SecureP@ssword123!',
    username: 'buyer_jane',
    full_name: 'Jane Buyer',
  };

  // Profile object returned by the DB trigger (read back via findById).
  const triggerCreatedProfile = {
    id: 'auth-uuid-123',
    username: 'buyer_jane',
    fullName: 'Jane Buyer',
    full_name: 'Jane Buyer',
    email: 'buyer@example.com',
    avatarPath: null,
    bio: null,
    locale: 'en',
    createdAt: new Date('2026-10-15T10:00:00.000Z'),
    updatedAt: new Date('2026-10-15T10:00:00.000Z'),
  };

  beforeEach(() => {
    authServiceMock = {
      emailExists: vi.fn().mockResolvedValue(false),
      registerUser: vi.fn().mockResolvedValue({
        id: 'auth-uuid-123',
        email: 'buyer@example.com',
        created_at: '2026-10-15T10:00:00.000Z',
        token: 'valid.jwt.token',
        session: {
          access_token: 'valid.jwt.token',
          token_type: 'bearer',
        },
      }),
    };

    profileRepositoryMock = {
      // create is no longer called by the use case — the on_auth_user_created
      // DB trigger handles the insert. Keep the mock defined so tests that
      // assert it was NOT called can still reference it.
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue(triggerCreatedProfile),
      findByUsername: vi.fn(),
    };

    useCase = new RegisterBuyerUseCase({
      authService: authServiceMock,
      profileRepository: profileRepositoryMock,
    });
  });

  describe('constructor validations', () => {
    it('should throw if authService is missing', () => {
      expect(() => new RegisterBuyerUseCase({ profileRepository: profileRepositoryMock })).toThrow(
        'authService is required'
      );
    });

    it('should throw if profileRepository is missing', () => {
      expect(() => new RegisterBuyerUseCase({ authService: authServiceMock })).toThrow(
        'profileRepository is required'
      );
    });
  });

  it('should successfully register a buyer and read the trigger-created profile', async () => {
    const request = new RegisterRequestDTO(validPayload);
    const result = await useCase.execute(request);

    expect(authServiceMock.emailExists).toHaveBeenCalledWith('buyer@example.com');
    expect(authServiceMock.registerUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'buyer@example.com',
        role: 'buyer',
        metadata: expect.objectContaining({
          username: 'buyer_jane',
          fullName: 'Jane Buyer',
        }),
      })
    );

    // The use case must NOT call create — the DB trigger already inserted the row.
    expect(profileRepositoryMock.create).not.toHaveBeenCalled();

    // The use case must call findById to read back the trigger-created profile.
    expect(profileRepositoryMock.findById).toHaveBeenCalledWith('auth-uuid-123');

    expect(result.data.user).toEqual({
      id: 'auth-uuid-123',
      email: 'buyer@example.com',
      created_at: '2026-10-15T10:00:00.000Z',
    });
    expect(result.data.profile.full_name).toBe('Jane Buyer');
    expect(result.data.roles[0].name).toBe('buyer');
    expect(result.data.token).toBe('valid.jwt.token');
    expect(result.meta.timestamp).toBeDefined();

    // Convenience getters on RegisterResponseDTO
    expect(result.user.id).toBe('auth-uuid-123');
    expect(result.session.access_token).toBe('valid.jwt.token');
  });

  it('should use fallback profile when findById returns null (in-memory / no trigger)', async () => {
    profileRepositoryMock.findById.mockResolvedValue(null);
    const request = new RegisterRequestDTO(validPayload);
    const result = await useCase.execute(request);

    expect(result.data.profile.id).toBe('auth-uuid-123');
    expect(result.data.profile.username).toBe('buyer_jane');
    expect(result.data.profile.full_name).toBe('Jane Buyer');
    expect(result.data.profile.locale).toBe('en');
    expect(result.data.profile.avatar_path).toBeNull();
  });

  it('should throw an error if email already exists without creating user or profile', async () => {
    authServiceMock.emailExists.mockResolvedValue(true);

    const request = new RegisterRequestDTO(validPayload);
    await expect(useCase.execute(request)).rejects.toThrow('Email already registered');

    expect(authServiceMock.registerUser).not.toHaveBeenCalled();
    expect(profileRepositoryMock.create).not.toHaveBeenCalled();
    expect(profileRepositoryMock.findById).not.toHaveBeenCalled();
  });

  it('should reject invalid email format', async () => {
    const request = new RegisterRequestDTO({
      ...validPayload,
      email: 'invalid-email-format',
    });

    await expect(useCase.execute(request)).rejects.toThrow('Invalid email format');
    expect(authServiceMock.registerUser).not.toHaveBeenCalled();
  });

  it('should reject weak password', async () => {
    const request = new RegisterRequestDTO({
      ...validPayload,
      password: 'weak',
    });

    await expect(useCase.execute(request)).rejects.toThrow(
      'Password must be at least 8 characters long'
    );
    expect(authServiceMock.registerUser).not.toHaveBeenCalled();
  });
});
