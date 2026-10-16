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
    full_name: 'Jane Doe',
  };

  beforeEach(() => {
    mockAuthService = {
      emailExists: vi.fn().mockResolvedValue(false),
      registerUser: vi.fn().mockResolvedValue({
        id: 'user-uuid-999',
        email: 'newbuyer@example.com',
        created_at: '2026-10-15T10:00:00.000Z',
        token: 'jwt.token.here',
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
        token: 'jwt.token.here',
      },
      meta: {
        timestamp: expect.any(String),
      },
    });
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
    expect(response.body.data.token).toBe('jwt.token.here');
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

  it('Scenario: Missing required fields (400)', async () => {
    const response = await request(app).post('/v1/auth/register').send({
      email: 'user@example.com',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.meta).toHaveProperty('timestamp');
  });

  it('Scenario: Health endpoint responds with 200 ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
