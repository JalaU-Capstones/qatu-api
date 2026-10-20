import Joi from 'joi';
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
        full_name: 'Valid User',
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
        full_name: 'Valid User',
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
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'email',
              message: 'Invalid email format',
            }),
          ]),
        },
        meta: expect.objectContaining({
          timestamp: expect.any(String),
        }),
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
        full_name: 'Valid User',
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
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'password',
            }),
          ]),
        },
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe('validateRequest Middleware with source option', () => {
  const testSchema = Joi.object({
    name: Joi.string().required().messages({
      'any.required': 'name is required',
      'string.empty': 'name is required',
    }),
    age: Joi.number().integer().min(0).optional(),
  });

  describe('default source: body', () => {
    const middleware = validateRequest(testSchema);

    it('should read from req.body by default and store in req.validatedBody', () => {
      const req = { body: { name: 'Alice', age: 30 } };
      const res = {};
      const next = vi.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.validatedBody).toEqual({ name: 'Alice', age: 30 });
    });
  });

  describe('source: query', () => {
    const middleware = validateRequest(testSchema, { source: 'query' });

    it('should read from req.query and store in req.validatedQuery', () => {
      const req = { query: { name: 'Bob', age: 25 } };
      const res = {};
      const next = vi.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.validatedQuery).toEqual({ name: 'Bob', age: 25 });
      expect(req.validatedBody).toBeUndefined();
    });

    it('should return 400 for invalid query params', () => {
      const req = { query: {} };
      const json = vi.fn();
      const status = vi.fn().mockReturnValue({ json });
      const res = { status };
      const next = vi.fn();

      middleware(req, res, next);
      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: expect.arrayContaining([
              expect.objectContaining({
                field: 'name',
                message: 'name is required',
              }),
            ]),
          },
          meta: expect.objectContaining({
            timestamp: expect.any(String),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('source: params', () => {
    const middleware = validateRequest(testSchema, { source: 'params' });

    it('should read from req.params and store in req.validatedParams', () => {
      const req = { params: { name: 'Charlie' } };
      const res = {};
      const next = vi.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.validatedParams).toEqual({ name: 'Charlie' });
      expect(req.validatedBody).toBeUndefined();
      expect(req.validatedQuery).toBeUndefined();
    });
  });
});
