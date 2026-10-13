import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../../../app.js';
import { createAuthRouter } from '../authRoutes.js';

describe('Auth Routes Integration - POST /v1/auth/register', () => {
  let app;
  let mockAuthService;
  let mockProfileRepository;

  const validRegistrationPayload = {
    email: 'newbuyer@example.com',
    password: 'SecureP@ssword123!',
    username: 'buyer_pro',
    fullName: 'Jane Doe',
  };

  beforeEach(() => {
    mockAuthService = {
      emailExists: vi.fn().mockResolvedValue(false),
      registerUser: vi.fn().mockResolvedValue({
        id: 'user-uuid-999',
        email: 'newbuyer@example.com',
        session: {
          access_token: 'jwt.token.here',
          token_type: 'bearer',
        },
      }),
    };

    mockProfileRepository = {
      create: vi.fn().mockImplementation(async (profile) => profile),
      findById: vi.fn(),
      findByUsername: vi.fn(),
    };

    const customRouter = createAuthRouter({
      authService: mockAuthService,
      profileRepository: mockProfileRepository,
    });

    app = createApp({ authRoutes: customRouter });
  });

  it('Scenario: Successful registration (201)', async () => {
    const response = await request(app).post('/v1/auth/register').send(validRegistrationPayload);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        message: 'Buyer registered successfully',
        user: expect.objectContaining({
          id: 'user-uuid-999',
          email: 'newbuyer@example.com',
          username: 'buyer_pro',
          fullName: 'Jane Doe',
          role: 'buyer',
        }),
        session: expect.objectContaining({
          access_token: 'jwt.token.here',
        }),
      })
    );
  });

  it('Scenario: Email already registered (409)', async () => {
    mockAuthService.emailExists.mockResolvedValue(true);

    const response = await request(app).post('/v1/auth/register').send(validRegistrationPayload);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: 'Conflict',
      message: 'Email already registered',
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
    expect(response.body.message).toBe('Invalid email format');
  });

  it('Scenario: Weak password (400)', async () => {
    const response = await request(app)
      .post('/v1/auth/register')
      .send({
        ...validRegistrationPayload,
        password: 'weak',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Password must be at least 8 characters long');
  });

  it('Scenario: Missing required fields (400)', async () => {
    const response = await request(app).post('/v1/auth/register').send({
      email: 'user@example.com',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
  });
});
