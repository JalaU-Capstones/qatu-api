import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileController } from '../ProfileController.js';

describe('ProfileController', () => {
  let mockGetProfileByIdUseCase;
  let mockUpdateProfileUseCase;
  let mockUploadAvatarUseCase;
  let controller;
  let req;
  let res;
  let next;

  const sampleProfileEnvelope = {
    data: {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      username: 'john_doe',
      full_name: 'John Doe',
      avatar_path: null,
      bio: 'Artisan collector.',
      locale: 'en',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
    },
    meta: {
      timestamp: '2026-10-14T12:00:00.000Z',
    },
  };

  beforeEach(() => {
    mockGetProfileByIdUseCase = {
      execute: vi.fn().mockResolvedValue(sampleProfileEnvelope),
    };
    mockUpdateProfileUseCase = {
      execute: vi.fn().mockResolvedValue(sampleProfileEnvelope),
    };
    mockUploadAvatarUseCase = {
      execute: vi.fn().mockResolvedValue(sampleProfileEnvelope),
    };
    controller = new ProfileController({
      getProfileByIdUseCase: mockGetProfileByIdUseCase,
      updateProfileUseCase: mockUpdateProfileUseCase,
      uploadAvatarUseCase: mockUploadAvatarUseCase,
    });

    req = {
      params: {},
      body: {},
      user: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('should throw when required use cases are missing', () => {
    expect(() => new ProfileController()).toThrow('getProfileByIdUseCase is required');
    expect(
      () => new ProfileController({ getProfileByIdUseCase: mockGetProfileByIdUseCase })
    ).toThrow('updateProfileUseCase is required');
  });

  describe('getById', () => {
    it('should return 200 with profile data when found', async () => {
      req.params = { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' };

      await controller.getById(req, res, next);

      expect(mockGetProfileByIdUseCase.execute).toHaveBeenCalledTimes(1);
      const dto = mockGetProfileByIdUseCase.execute.mock.calls[0][0];
      expect(dto.profileId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(sampleProfileEnvelope);
    });

    it('should forward errors to next middleware', async () => {
      const err = new Error('Profile not found');
      err.statusCode = 404;
      mockGetProfileByIdUseCase.execute.mockRejectedValueOnce(err);

      await controller.getById(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('updateMe', () => {
    it('should return 200 with updated profile data for authenticated user', async () => {
      req.validatedBody = {
        full_name: 'Jane Doe',
        bio: 'Updated bio',
      };

      await controller.updateMe(req, res, next);

      expect(mockUpdateProfileUseCase.execute).toHaveBeenCalledTimes(1);
      const dto = mockUpdateProfileUseCase.execute.mock.calls[0][0];
      expect(dto.userId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(dto.updates).toEqual({
        full_name: 'Jane Doe',
        bio: 'Updated bio',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(sampleProfileEnvelope);
    });

    it('should call next with 401 UNAUTHORIZED when req.user is missing', async () => {
      req.user = null;

      await controller.updateMe(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
          statusCode: 401,
        })
      );
      expect(mockUpdateProfileUseCase.execute).not.toHaveBeenCalled();
    });

    it('should forward use case errors to next middleware', async () => {
      const err = new Error('Validation error');
      err.statusCode = 400;
      mockUpdateProfileUseCase.execute.mockRejectedValueOnce(err);

      await controller.updateMe(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('uploadAvatar', () => {
    it('should read req.cookies.access_token and pass it to the use case', async () => {
      req.cookies = { access_token: 'cookie-jwt-token' };
      req.file = {
        buffer: Buffer.from('png-bytes'),
        mimeType: 'image/png',
        originalName: 'avatar.png',
        size: 9,
      };

      await controller.uploadAvatar(req, res, next);

      expect(mockUploadAvatarUseCase.execute).toHaveBeenCalledTimes(1);
      const dto = mockUploadAvatarUseCase.execute.mock.calls[0][0];
      expect(dto.userId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(dto.requestingUserId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(dto.mimeType).toBe('image/png');
      expect(dto.accessToken).toBe('cookie-jwt-token');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(sampleProfileEnvelope);
    });

    it('should fall back to req.headers.authorization Bearer if cookie is missing', async () => {
      req.cookies = {};
      req.headers = { authorization: 'Bearer header-jwt-token' };
      req.file = {
        buffer: Buffer.from('png-bytes'),
        mimeType: 'image/png',
        originalName: 'avatar.png',
        size: 9,
      };

      await controller.uploadAvatar(req, res, next);

      expect(mockUploadAvatarUseCase.execute).toHaveBeenCalledTimes(1);
      const dto = mockUploadAvatarUseCase.execute.mock.calls[0][0];
      expect(dto.accessToken).toBe('header-jwt-token');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(sampleProfileEnvelope);
    });

    it('should return 401 UNAUTHORIZED when both cookie and Bearer are missing', async () => {
      req.cookies = {};
      req.headers = {};
      req.file = {
        buffer: Buffer.from('png-bytes'),
        mimeType: 'image/png',
        originalName: 'avatar.png',
        size: 9,
      };

      await controller.uploadAvatar(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
          statusCode: 401,
          message: 'Session token not available for storage upload',
        })
      );
      expect(mockUploadAvatarUseCase.execute).not.toHaveBeenCalled();
    });

    it('should call next with 401 UNAUTHORIZED when req.user is missing', async () => {
      req.user = null;
      req.cookies = { access_token: 'cookie-jwt-token' };

      await controller.uploadAvatar(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
          statusCode: 401,
        })
      );
      expect(mockUploadAvatarUseCase.execute).not.toHaveBeenCalled();
    });
  });
});
