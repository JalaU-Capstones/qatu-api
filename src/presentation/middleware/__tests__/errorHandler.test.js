import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../errorHandler.js';

describe('errorHandler Middleware', () => {
  const createMockRes = () => {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  const mockNext = vi.fn();
  const mockReq = {};

  it('preserves EMAIL_ALREADY_EXISTS when it carries a 409 status code', () => {
    const res = createMockRes();
    const err = new Error('Email already registered');
    err.code = 'EMAIL_ALREADY_EXISTS';
    err.statusCode = 409;

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Email already registered',
        },
        meta: expect.objectContaining({ timestamp: expect.any(String) }),
      })
    );
  });

  it('uses the error message for a generic 409 conflict when no code is provided', () => {
    const res = createMockRes();
    const err = new Error('Conflict error');
    err.statusCode = 409;

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: 'CONFLICT',
          message: 'Conflict error',
        },
        meta: expect.objectContaining({ timestamp: expect.any(String) }),
      })
    );
  });

  it('preserves the INVALID_STATE_TRANSITION code and message for product state conflicts', () => {
    const res = createMockRes();
    const err = Object.assign(new Error("Cannot publish a product in state 'published'"), {
      code: 'INVALID_STATE_TRANSITION',
      statusCode: 409,
    });

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INVALID_STATE_TRANSITION',
        message: "Cannot publish a product in state 'published'",
      },
      meta: expect.objectContaining({ timestamp: expect.any(String) }),
    });
  });

  it('preserves SLUG_ALREADY_EXISTS instead of collapsing it to CONFLICT', () => {
    const res = createMockRes();
    const err = Object.assign(new Error('Slug already exists'), {
      code: 'SLUG_ALREADY_EXISTS',
      statusCode: 409,
    });

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'SLUG_ALREADY_EXISTS',
        message: 'Slug already exists',
      },
      meta: expect.objectContaining({ timestamp: expect.any(String) }),
    });
  });

  it('should handle domain Password validation errors with 400', () => {
    const res = createMockRes();
    const err = new Error('Password must be at least 8 characters long');

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password must be at least 8 characters long',
        },
      })
    );
  });

  it('should handle domain Email validation errors with 400', () => {
    const res = createMockRes();
    const err = new Error('Invalid email format');

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email format',
        },
      })
    );
  });

  it('should handle domain Username and FullName validation errors with 400', () => {
    const res = createMockRes();
    const err = new Error('Username must be between 3 and 30 characters');

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Username must be between 3 and 30 characters',
        },
      })
    );
  });

  it('should handle 400 statusCode without specific text', () => {
    const res = createMockRes();
    const err = new Error('Some invalid field');
    err.statusCode = 400;

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Some invalid field',
        },
      })
    );
  });

  it('should handle 429 Too Many Requests', () => {
    const res = createMockRes();
    const err = new Error('Rate limit');
    err.statusCode = 429;

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded. Please retry later.',
        },
      })
    );
  });

  it('should handle generic 500 errors and hide internal details', () => {
    const res = createMockRes();
    const err = new Error('Internal database failure: secret details');

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected server error occurred',
        },
      })
    );
  });

  it('should handle 403 or other 4xx errors properly', () => {
    const res = createMockRes();
    const err = new Error('Access denied');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied',
        },
      })
    );
  });
  describe('fallback messages and codes', () => {
    const expectEnvelope = (res, status, code, message) => {
      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: { code, message } }));
    };

    it('uses the email confirmation message for EMAIL_NOT_CONFIRMED', () => {
      const res = createMockRes();

      errorHandler(
        Object.assign(new Error('bad credentials'), { code: 'EMAIL_NOT_CONFIRMED' }),
        mockReq,
        res,
        mockNext
      );

      expectEnvelope(
        res,
        401,
        'EMAIL_NOT_CONFIRMED',
        'Please confirm your email before logging in'
      );
    });

    it('defaults the code for a 401 without one', () => {
      const res = createMockRes();

      errorHandler(
        Object.assign(new Error('no code'), { statusCode: 401 }),
        mockReq,
        res,
        mockNext
      );

      expectEnvelope(res, 401, 'UNAUTHORIZED', 'Authentication failed');
    });

    it('defaults messages for 403, 404, 422, 409 and 400 errors without one', () => {
      const cases = [
        [403, 'FORBIDDEN', 'You do not have permission to access this resource'],
        [404, 'NOT_FOUND', 'Resource not found'],
        [422, 'UNPROCESSABLE_ENTITY', 'The request could not be processed'],
        [409, 'CONFLICT', 'A resource with these attributes already exists'],
        [400, 'VALIDATION_ERROR', 'Invalid input data'],
      ];

      for (const [statusCode, code, message] of cases) {
        const res = createMockRes();

        errorHandler(Object.assign(new Error(''), { statusCode }), mockReq, res, mockNext);

        expectEnvelope(res, statusCode, code, message);
      }
    });

    it('preserves code and message for non-server errors in the generic branch', () => {
      const res = createMockRes();

      errorHandler(
        Object.assign(new Error('Teapot'), { statusCode: 418, code: 'I_AM_A_TEAPOT' }),
        mockReq,
        res,
        mockNext
      );

      expectEnvelope(res, 418, 'I_AM_A_TEAPOT', 'Teapot');
    });

    it('uses generic code and message for non-server errors without them', () => {
      const res = createMockRes();

      errorHandler(Object.assign(new Error(''), { statusCode: 418 }), mockReq, res, mockNext);

      expectEnvelope(res, 418, 'ERROR', 'An error occurred');
    });
  });

  describe('422 Unprocessable Entity (business rules)', () => {
    it('serializes code, message and details', () => {
      const res = createMockRes();
      const err = Object.assign(new Error('Insufficient stock for Clean Code'), {
        statusCode: 422,
        code: 'INSUFFICIENT_STOCK',
        details: [{ field: 'items.p-1', message: 'Insufficient stock for Clean Code' }],
      });

      errorHandler(err, mockReq, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: 'Insufficient stock for Clean Code',
          details: [{ field: 'items.p-1', message: 'Insufficient stock for Clean Code' }],
        },
        meta: expect.objectContaining({ timestamp: expect.any(String) }),
      });
    });

    it('omits details when there are none', () => {
      const res = createMockRes();
      const err = Object.assign(new Error('Your cart is empty'), {
        statusCode: 422,
        code: 'EMPTY_CART',
        details: [],
      });

      errorHandler(err, mockReq, res, mockNext);

      expect(res.json.mock.calls[0][0].error).toEqual({
        code: 'EMPTY_CART',
        message: 'Your cart is empty',
      });
    });

    it('is not remapped to 400 when a product name happens to contain "is required"', () => {
      const res = createMockRes();
      const err = Object.assign(new Error('Insufficient stock for Name is required Edition'), {
        statusCode: 422,
        code: 'INSUFFICIENT_STOCK',
      });

      errorHandler(err, mockReq, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(422);
    });

    it('falls back to UNPROCESSABLE_ENTITY when no code is set', () => {
      const res = createMockRes();

      errorHandler(Object.assign(new Error('nope'), { statusCode: 422 }), mockReq, res, mockNext);

      expect(res.json.mock.calls[0][0].error.code).toBe('UNPROCESSABLE_ENTITY');
    });
  });
});
