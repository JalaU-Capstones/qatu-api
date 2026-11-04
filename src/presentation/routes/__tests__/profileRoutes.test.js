import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { Profile } from '../../../domain/entities/Profile.js';
import { supabase } from '../../../infrastructure/config/supabase.js';
import { createProfileRouter } from '../profileRoutes.js';

vi.mock('../../../infrastructure/config/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('Profile Routes Integration (GET /v1/profiles/:id, PATCH /v1/profiles/me)', () => {
  let app;
  let mockProfileRepository;

  const userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const validToken = 'fake-valid-supabase-token';
  const invalidToken = 'fake-invalid-supabase-token';
  const csrfToken = 'test-csrf-token-value-123456';

  const existingProfile = new Profile({
    id: userId,
    username: 'john_doe',
    fullName: 'John Doe',
    email: 'john@example.com',
    avatarPath: 'avatars/john.webp',
    bio: 'Artisan collector.',
    locale: 'en',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  });

  beforeEach(() => {
    vi.clearAllMocks();

    supabase.auth.getUser.mockImplementation(async (token) => {
      // eslint-disable-next-line security/detect-possible-timing-attacks
      if (token === validToken) {
        return {
          data: {
            user: {
              id: userId,
              email: 'john@example.com',
              role: 'authenticated',
              user_metadata: { role: 'buyer' },
            },
          },
          error: null,
        };
      }
      return {
        data: { user: null },
        error: { message: 'invalid' },
      };
    });

    mockProfileRepository = {
      findById: vi.fn(),
      update: vi.fn(),
    };

    const customRouter = createProfileRouter({
      profileRepository: mockProfileRepository,
    });

    app = createApp({ profileRoutes: customRouter });
  });

  describe('GET /v1/profiles/:id', () => {
    it('Scenario: View own profile -> returns 200 with username, full_name, avatar_path, and bio', async () => {
      mockProfileRepository.findById.mockResolvedValueOnce(existingProfile);

      const response = await request(app).get(`/v1/profiles/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        id: userId,
        username: 'john_doe',
        full_name: 'John Doe',
        email: 'john@example.com',
        avatar_path: 'avatars/john.webp',
        bio: 'Artisan collector.',
        locale: 'en',
        created_at: '2026-10-01T00:00:00.000Z',
        updated_at: '2026-10-01T00:00:00.000Z',
      });
      expect(response.body.meta.timestamp).toBeDefined();
      expect(mockProfileRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('returns 404 NOT_FOUND when profile does not exist', async () => {
      mockProfileRepository.findById.mockResolvedValueOnce(null);

      const response = await request(app).get('/v1/profiles/00000000-0000-4000-8000-000000000000');

      expect(response.status).toBe(404);
      expect(response.body.error).toEqual({
        code: 'NOT_FOUND',
        message: 'Profile not found',
      });
    });

    it('returns 404 NOT_FOUND when :id is not a valid UUID', async () => {
      const response = await request(app).get('/v1/profiles/not-a-uuid');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(mockProfileRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /v1/profiles/me', () => {
    it('Scenario: Update profile (Bearer auth) -> updates full_name, bio, and avatar_path and returns 200', async () => {
      const updatedEntity = new Profile({
        id: userId,
        username: 'john_doe',
        fullName: 'Jane Doe',
        email: 'john@example.com',
        avatarPath: 'avatars/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/avatar.webp',
        bio: 'Online marketplace enthusiast.',
        locale: 'es',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-14T12:00:00.000Z',
      });
      mockProfileRepository.update.mockResolvedValueOnce(updatedEntity);

      const response = await request(app)
        .patch('/v1/profiles/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          full_name: 'Jane Doe',
          bio: 'Online marketplace enthusiast.',
          avatar_path: 'avatars/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/avatar.webp',
          locale: 'es',
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        id: userId,
        username: 'john_doe',
        full_name: 'Jane Doe',
        email: 'john@example.com',
        avatar_path: 'avatars/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/avatar.webp',
        bio: 'Online marketplace enthusiast.',
        locale: 'es',
        created_at: '2026-10-01T00:00:00.000Z',
        updated_at: '2026-10-14T12:00:00.000Z',
      });
      expect(response.body.meta.timestamp).toBeDefined();
      expect(mockProfileRepository.update).toHaveBeenCalledWith(userId, {
        full_name: 'Jane Doe',
        bio: 'Online marketplace enthusiast.',
        avatar_path: 'avatars/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/avatar.webp',
        locale: 'es',
      });
    });

    it('Scenario: Update profile (HttpOnly cookie + CSRF token) -> updates profile and returns 200', async () => {
      const updatedEntity = new Profile({
        id: userId,
        username: 'john_doe',
        fullName: 'Jane Cookie',
        email: 'john@example.com',
        avatarPath: 'avatars/cookie.webp',
        bio: 'Cookie authenticated update.',
        locale: 'en',
      });
      mockProfileRepository.update.mockResolvedValueOnce(updatedEntity);

      const response = await request(app)
        .patch('/v1/profiles/me')
        .set('Cookie', [`access_token=${validToken}`, `csrf_token=${csrfToken}`])
        .set('X-CSRF-Token', csrfToken)
        .send({
          full_name: 'Jane Cookie',
          bio: 'Cookie authenticated update.',
          avatar_path: 'avatars/cookie.webp',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.full_name).toBe('Jane Cookie');
      expect(response.body.data.bio).toBe('Cookie authenticated update.');
      expect(mockProfileRepository.update).toHaveBeenCalledTimes(1);
    });

    it('Scenario: Update with invalid data (too long bio > 500 chars) -> returns 400 VALIDATION_ERROR and does not update', async () => {
      const response = await request(app)
        .patch('/v1/profiles/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          bio: 'b'.repeat(501),
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'bio',
            message: 'bio must be at most 500 characters',
          }),
        ])
      );
      expect(mockProfileRepository.update).not.toHaveBeenCalled();
    });

    it('Scenario: Update with invalid data (too short or too long full_name) -> returns 400 VALIDATION_ERROR and does not update', async () => {
      const response = await request(app)
        .patch('/v1/profiles/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          full_name: 'A',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'full_name',
          }),
        ])
      );
      expect(mockProfileRepository.update).not.toHaveBeenCalled();
    });

    it('Scenario: Update with empty body -> returns 400 VALIDATION_ERROR', async () => {
      const response = await request(app)
        .patch('/v1/profiles/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockProfileRepository.update).not.toHaveBeenCalled();
    });

    it('returns 401 UNAUTHORIZED when unauthenticated', async () => {
      const response = await request(app).patch('/v1/profiles/me').send({
        bio: 'Unauthorized attempt',
      });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(mockProfileRepository.update).not.toHaveBeenCalled();
    });

    it('returns 401 UNAUTHORIZED when token is invalid', async () => {
      const response = await request(app)
        .patch('/v1/profiles/me')
        .set('Authorization', `Bearer ${invalidToken}`)
        .send({
          bio: 'Invalid token attempt',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(mockProfileRepository.update).not.toHaveBeenCalled();
    });

    it('returns 403 INVALID_CSRF_TOKEN when cookie-authenticated without matching X-CSRF-Token', async () => {
      const response = await request(app)
        .patch('/v1/profiles/me')
        .set('Cookie', [`access_token=${validToken}`, `csrf_token=${csrfToken}`])
        .send({
          bio: 'Missing CSRF header',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('INVALID_CSRF_TOKEN');
      expect(mockProfileRepository.update).not.toHaveBeenCalled();
    });
  });
});
