import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.js';
import { MAX_AVATAR_SIZE_BYTES } from '../../../application/use-cases/UploadAvatarUseCase.js';
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

describe('Profile Routes Integration (GET /v1/profiles/:id, PATCH /v1/profiles/me, POST /v1/profiles/me/avatar)', () => {
  let app;
  let mockProfileRepository;
  let mockStorageService;

  const userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const otherUserId = 'b1ffcd88-8b1a-4de7-aa5c-5aa8ac279b22';
  const validToken = 'fake-valid-supabase-token';
  const otherUserToken = 'fake-other-user-supabase-token';
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
      // eslint-disable-next-line security/detect-possible-timing-attacks
      if (token === otherUserToken) {
        return {
          data: {
            user: {
              id: otherUserId,
              email: 'other@example.com',
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

    mockStorageService = {
      uploadAvatar: vi.fn().mockImplementation(async ({ userId: targetId, extension }) => ({
        path: `avatars/${targetId}/avatar.${extension}`,
      })),
    };

    const customRouter = createProfileRouter({
      profileRepository: mockProfileRepository,
      storageService: mockStorageService,
    });

    app = createApp({ profileRoutes: customRouter });
  });

  describe('GET /v1/profiles/:id', () => {
    it('Scenario: View own/public profile -> returns 200 with exact contract fields and excludes email', async () => {
      mockProfileRepository.findById.mockResolvedValueOnce(existingProfile);

      const response = await request(app).get(`/v1/profiles/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        id: userId,
        username: 'john_doe',
        full_name: 'John Doe',
        avatar_path: 'avatars/john.webp',
        bio: 'Artisan collector.',
        locale: 'en',
        created_at: '2026-10-01T00:00:00.000Z',
        updated_at: '2026-10-01T00:00:00.000Z',
      });
      expect(Object.keys(response.body.data).sort()).toEqual(
        [
          'id',
          'username',
          'full_name',
          'avatar_path',
          'bio',
          'locale',
          'created_at',
          'updated_at',
        ].sort()
      );
      expect(response.body.data).not.toHaveProperty('email');
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

    it('returns 500 INTERNAL_SERVER_ERROR when repository throws an unexpected error', async () => {
      mockProfileRepository.findById.mockRejectedValueOnce(new Error('DB connection lost'));

      const response = await request(app).get(`/v1/profiles/${userId}`);

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
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
        avatar_path: 'avatars/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/avatar.webp',
        bio: 'Online marketplace enthusiast.',
        locale: 'es',
        created_at: '2026-10-01T00:00:00.000Z',
        updated_at: '2026-10-14T12:00:00.000Z',
      });
      expect(response.body.data).not.toHaveProperty('email');
      expect(response.body.meta.timestamp).toBeDefined();
      expect(mockProfileRepository.update).toHaveBeenCalledWith(userId, {
        full_name: 'Jane Doe',
        bio: 'Online marketplace enthusiast.',
        avatar_path: 'avatars/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/avatar.webp',
        locale: 'es',
      });
    });

    it('Scenario: Partial update -> only passes provided fields so omitted fields remain unchanged', async () => {
      const partiallyUpdated = new Profile({
        id: userId,
        username: 'john_doe',
        fullName: 'John Doe',
        email: 'john@example.com',
        avatarPath: 'avatars/john.webp',
        bio: 'Only bio changed.',
        locale: 'en',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-14T12:00:00.000Z',
      });
      mockProfileRepository.update.mockResolvedValueOnce(partiallyUpdated);

      const response = await request(app)
        .patch('/v1/profiles/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          bio: 'Only bio changed.',
        });

      expect(response.status).toBe(200);
      expect(mockProfileRepository.update).toHaveBeenCalledWith(userId, {
        bio: 'Only bio changed.',
      });
      expect(response.body.data.full_name).toBe('John Doe');
      expect(response.body.data.avatar_path).toBe('avatars/john.webp');
    });

    it('Scenario: Another user cannot update your profile -> strips injected id/userId from body and only targets authenticated user', async () => {
      const otherUserProfile = new Profile({
        id: otherUserId,
        username: 'other_user',
        fullName: 'Other User',
        email: 'other@example.com',
        bio: 'Other bio',
        locale: 'en',
      });
      mockProfileRepository.update.mockResolvedValueOnce(otherUserProfile);

      const response = await request(app)
        .patch('/v1/profiles/me')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          id: userId,
          userId,
          bio: 'Other bio',
        });

      expect(response.status).toBe(200);
      expect(mockProfileRepository.update).toHaveBeenCalledWith(otherUserId, {
        bio: 'Other bio',
      });
      expect(mockProfileRepository.update).not.toHaveBeenCalledWith(userId, expect.anything());
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

    it('Scenario: Update with invalid avatar_path format -> returns 400 VALIDATION_ERROR', async () => {
      const response = await request(app)
        .patch('/v1/profiles/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          avatar_path: 'avatars/malicious.exe',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
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

    it('returns 404 NOT_FOUND when profile record does not exist', async () => {
      mockProfileRepository.update.mockResolvedValueOnce(null);

      const response = await request(app)
        .patch('/v1/profiles/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          bio: 'Missing profile',
        });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /v1/profiles/me/avatar', () => {
    it('Scenario: Upload valid WebP avatar -> stores in Supabase Storage, updates avatar_path, and returns 200', async () => {
      const expectedStoragePath = `avatars/${userId}/avatar.webp`;
      const updatedEntity = new Profile({
        id: userId,
        username: 'john_doe',
        fullName: 'John Doe',
        email: 'john@example.com',
        avatarPath: expectedStoragePath,
        bio: 'Artisan collector.',
        locale: 'en',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-14T12:00:00.000Z',
      });
      mockProfileRepository.update.mockResolvedValueOnce(updatedEntity);

      const imageBuffer = Buffer.from('RIFF....WEBPVP8 ');

      const response = await request(app)
        .post('/v1/profiles/me/avatar')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('image', imageBuffer, { filename: 'avatar.webp', contentType: 'image/webp' });

      expect(response.status).toBe(200);
      expect(mockStorageService.uploadAvatar).toHaveBeenCalledWith({
        userId,
        buffer: imageBuffer,
        mimeType: 'image/webp',
        extension: 'webp',
      });
      expect(mockProfileRepository.update).toHaveBeenCalledWith(userId, {
        avatar_path: expectedStoragePath,
      });
      expect(response.body.data).toEqual({
        id: userId,
        username: 'john_doe',
        full_name: 'John Doe',
        avatar_path: expectedStoragePath,
        bio: 'Artisan collector.',
        locale: 'en',
        created_at: '2026-10-01T00:00:00.000Z',
        updated_at: '2026-10-14T12:00:00.000Z',
      });
      expect(response.body.data).not.toHaveProperty('email');
    });

    it('returns 422 FILE_TOO_LARGE when uploaded image exceeds 2 MB (SP-10)', async () => {
      const oversizedBuffer = Buffer.alloc(MAX_AVATAR_SIZE_BYTES + 1024, 0x41);

      const response = await request(app)
        .post('/v1/profiles/me/avatar')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('image', oversizedBuffer, { filename: 'huge.png', contentType: 'image/png' });

      expect(response.status).toBe(422);
      expect(response.body.error).toEqual({
        code: 'FILE_TOO_LARGE',
        message: 'The image exceeds the maximum size of 2 MB.',
      });
      expect(mockStorageService.uploadAvatar).not.toHaveBeenCalled();
      expect(mockProfileRepository.update).not.toHaveBeenCalled();
    });

    it('returns 422 INVALID_FILE_FORMAT when uploaded file has an unsupported MIME type (SP-10)', async () => {
      const gifBuffer = Buffer.from('GIF89a');

      const response = await request(app)
        .post('/v1/profiles/me/avatar')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('image', gifBuffer, { filename: 'avatar.gif', contentType: 'image/gif' });

      expect(response.status).toBe(422);
      expect(response.body.error).toEqual({
        code: 'INVALID_FILE_FORMAT',
        message: 'Only JPEG, PNG, and WebP images are accepted.',
      });
      expect(mockStorageService.uploadAvatar).not.toHaveBeenCalled();
      expect(mockProfileRepository.update).not.toHaveBeenCalled();
    });

    it('returns 400 VALIDATION_ERROR when request is missing the image file', async () => {
      const response = await request(app)
        .post('/v1/profiles/me/avatar')
        .set('Authorization', `Bearer ${validToken}`)
        .field('other', 'value');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockStorageService.uploadAvatar).not.toHaveBeenCalled();
    });

    it('returns 401 UNAUTHORIZED when unauthenticated', async () => {
      const response = await request(app)
        .post('/v1/profiles/me/avatar')
        .attach('image', Buffer.from('png'), { filename: 'avatar.png', contentType: 'image/png' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 INVALID_CSRF_TOKEN when cookie-authenticated without matching X-CSRF-Token', async () => {
      const response = await request(app)
        .post('/v1/profiles/me/avatar')
        .set('Cookie', [`access_token=${validToken}`, `csrf_token=${csrfToken}`])
        .attach('image', Buffer.from('png'), { filename: 'avatar.png', contentType: 'image/png' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('INVALID_CSRF_TOKEN');
    });
  });
});
