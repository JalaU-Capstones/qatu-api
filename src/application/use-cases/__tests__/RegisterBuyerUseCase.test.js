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
    fullName: 'Jane Buyer',
  };

  beforeEach(() => {
    authServiceMock = {
      emailExists: vi.fn().mockResolvedValue(false),
      registerUser: vi.fn().mockResolvedValue({
        id: 'auth-uuid-123',
        email: 'buyer@example.com',
        session: {
          access_token: 'valid.jwt.token',
          token_type: 'bearer',
        },
      }),
    };

    profileRepositoryMock = {
      create: vi.fn().mockImplementation(async (profile) => profile),
      findById: vi.fn(),
      findByUsername: vi.fn(),
    };

    useCase = new RegisterBuyerUseCase({
      authService: authServiceMock,
      profileRepository: profileRepositoryMock,
    });
  });

  it('should successfully register a buyer and create profile with buyer role', async () => {
    const request = new RegisterRequestDTO(validPayload);
    const result = await useCase.execute(request);

    expect(authServiceMock.emailExists).toHaveBeenCalledWith('buyer@example.com');
    expect(authServiceMock.registerUser).toHaveBeenCalledWith({
      email: 'buyer@example.com',
      password: 'SecureP@ssword123!',
      role: 'buyer',
      metadata: {
        username: 'buyer_jane',
        fullName: 'Jane Buyer',
      },
    });

    expect(profileRepositoryMock.create).toHaveBeenCalled();
    const createdProfileArg = profileRepositoryMock.create.mock.calls[0][0];
    expect(createdProfileArg.id).toBe('auth-uuid-123');
    expect(createdProfileArg.role).toBe('buyer');
    expect(createdProfileArg.username).toBe('buyer_jane');

    expect(result.user).toEqual({
      id: 'auth-uuid-123',
      email: 'buyer@example.com',
      username: 'buyer_jane',
      fullName: 'Jane Buyer',
      role: 'buyer',
    });
    expect(result.session.access_token).toBe('valid.jwt.token');
  });

  it('should throw an error if email already exists without creating user or profile', async () => {
    authServiceMock.emailExists.mockResolvedValue(true);

    const request = new RegisterRequestDTO(validPayload);
    await expect(useCase.execute(request)).rejects.toThrow('Email already registered');

    expect(authServiceMock.registerUser).not.toHaveBeenCalled();
    expect(profileRepositoryMock.create).not.toHaveBeenCalled();
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
