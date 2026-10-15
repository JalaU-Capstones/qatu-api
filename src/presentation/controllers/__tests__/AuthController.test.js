import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthController } from '../AuthController.js';

describe('AuthController', () => {
  let useCaseMock;
  let controller;

  beforeEach(() => {
    useCaseMock = {
      execute: vi.fn(),
    };
    controller = new AuthController({ registerBuyerUseCase: useCaseMock });
  });

  it('should throw if registerBuyerUseCase dependency is missing in constructor', () => {
    expect(() => new AuthController({})).toThrow('registerBuyerUseCase is required');
  });

  it('should respond with 201 when registration succeeds', async () => {
    const mockResult = {
      data: {
        user: { id: 'usr-1', email: 'test@example.com' },
        profile: { id: 'usr-1', username: 'testuser' },
        roles: [{ id: 1, name: 'buyer' }],
        token: 'token-123',
      },
      meta: { timestamp: '2026-10-15T12:00:00.000Z' },
    };
    useCaseMock.execute.mockResolvedValue(mockResult);

    const req = {
      validatedBody: {
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser',
        full_name: 'Test User',
      },
    };
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status };
    const next = vi.fn();

    await controller.register(req, res, next);

    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith(mockResult);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with error when use case throws', async () => {
    const error = new Error('Email already registered');
    useCaseMock.execute.mockRejectedValue(error);

    const req = { body: {} };
    const res = {};
    const next = vi.fn();

    await controller.register(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
