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

  it('should respond with 201 when registration succeeds', async () => {
    useCaseMock.execute.mockResolvedValue({
      user: {
        id: 'usr-1',
        email: 'test@example.com',
        username: 'testuser',
        fullName: 'Test User',
        role: 'buyer',
      },
      session: { access_token: 'token-123' },
    });

    const req = {
      validatedBody: {
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser',
        fullName: 'Test User',
      },
    };
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status };
    const next = vi.fn();

    await controller.register(req, res, next);

    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Buyer registered successfully',
        user: expect.objectContaining({ role: 'buyer' }),
      })
    );
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
