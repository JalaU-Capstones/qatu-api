import { describe, it, expect, vi } from 'vitest';
import { registerSchema } from '../../validators/registerSchema.js';
import { validateRequest } from '../validateRequest.js';

describe('validateRequest Middleware with registerSchema', () => {
  const middleware = validateRequest(registerSchema);

  it('should call next() with valid payload', () => {
    const req = {
      body: {
        email: 'user@example.com',
        password: 'ValidPassword123!',
        username: 'valid_user',
        fullName: 'Valid User',
      },
    };
    const res = {};
    const next = vi.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.validatedBody).toBeDefined();
  });

  it('should return 400 when email format is invalid', () => {
    const req = {
      body: {
        email: 'invalid-email',
        password: 'ValidPassword123!',
        username: 'valid_user',
        fullName: 'Valid User',
      },
    };
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status };
    const next = vi.fn();

    middleware(req, res, next);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Bad Request',
        message: 'Invalid email format',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 400 when password is weak', () => {
    const req = {
      body: {
        email: 'user@example.com',
        password: 'weak',
        username: 'valid_user',
        fullName: 'Valid User',
      },
    };
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status };
    const next = vi.fn();

    middleware(req, res, next);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Bad Request',
        message: expect.stringContaining('Password must be at least 8 characters long'),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
