import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthController } from '../AuthController.js';

describe('AuthController', () => {
  let registerUseCaseMock;
  let loginUseCaseMock;
  let controller;
  let req;
  let res;
  let next;

  beforeEach(() => {
    registerUseCaseMock = {
      execute: vi.fn(),
    };
    loginUseCaseMock = {
      execute: vi.fn(),
    };
    controller = new AuthController({
      registerBuyerUseCase: registerUseCaseMock,
      loginUseCase: loginUseCaseMock,
    });

    req = {
      body: {},
      validatedBody: undefined,
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      cookie: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe('constructor', () => {
    it('should throw if registerBuyerUseCase dependency is missing in constructor', () => {
      expect(() => new AuthController({})).toThrow('registerBuyerUseCase is required');
    });
  });

  describe('register', () => {
    it('should respond with 201 and set session cookies when registration succeeds', async () => {
      const mockDto = {
        data: {
          user: { id: 'usr-1', email: 'test@example.com' },
          profile: { id: 'usr-1', username: 'testuser' },
          roles: [{ id: 1, name: 'buyer' }],
        },
        meta: { timestamp: '2026-10-15T12:00:00.000Z' },
        toJSON: () => ({
          data: {
            user: { id: 'usr-1', email: 'test@example.com' },
            profile: { id: 'usr-1', username: 'testuser' },
            roles: [{ id: 1, name: 'buyer' }],
          },
          meta: { timestamp: '2026-10-15T12:00:00.000Z' },
        }),
      };
      registerUseCaseMock.execute.mockResolvedValue({
        response: mockDto,
        session: { accessToken: 'reg-atk-123', refreshToken: 'reg-rtk-123' },
      });

      req.validatedBody = {
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser',
        full_name: 'Test User',
      };

      await controller.register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockDto);
      expect(res.cookie).toHaveBeenCalledTimes(3);

      const cookieCalls = res.cookie.mock.calls;
      expect(cookieCalls[0][0]).toBe('access_token');
      expect(cookieCalls[0][1]).toBe('reg-atk-123');
      expect(cookieCalls[0][2]).toMatchObject({ httpOnly: true, sameSite: 'strict' });

      expect(cookieCalls[1][0]).toBe('refresh_token');
      expect(cookieCalls[1][1]).toBe('reg-rtk-123');
      expect(cookieCalls[1][2]).toMatchObject({ httpOnly: true, sameSite: 'strict' });

      expect(cookieCalls[2][0]).toBe('csrf_token');
      expect(cookieCalls[2][1]).toMatch(/^[0-9a-f]{64}$/);
      expect(cookieCalls[2][2]).toMatchObject({ httpOnly: false, sameSite: 'strict' });

      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with error when register use case throws', async () => {
      const error = new Error('Email already registered');
      registerUseCaseMock.execute.mockRejectedValue(error);

      await controller.register(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('login', () => {
    it('throws if loginUseCase is not configured', async () => {
      const unconfiguredController = new AuthController({
        registerBuyerUseCase: registerUseCaseMock,
      });

      await unconfiguredController.login(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'loginUseCase is not configured' })
      );
    });

    it('login sets access_token, refresh_token, and csrf_token cookies', async () => {
      const mockResponse = {
        data: {
          user: { id: 'u-1', email: 'buyer@example.com' },
          profile: { id: 'u-1', username: 'buyer' },
          roles: [{ id: 1, name: 'buyer' }],
        },
        meta: { timestamp: '2026-10-01T00:00:00.000Z' },
      };
      const dto = { toJSON: () => mockResponse };
      loginUseCaseMock.execute.mockResolvedValueOnce({
        response: dto,
        session: { accessToken: 'atk', refreshToken: 'rtk' },
      });

      req.validatedBody = {
        email: 'buyer@example.com',
        password: 'StrongPassword123!',
      };

      await controller.login(req, res, next);

      expect(res.cookie).toHaveBeenCalledTimes(3);
      const cookieCalls = res.cookie.mock.calls;
      expect(cookieCalls[0][0]).toBe('access_token');
      expect(cookieCalls[0][1]).toBe('atk');
      expect(cookieCalls[0][2]).toMatchObject({ httpOnly: true, sameSite: 'strict' });

      expect(cookieCalls[1][0]).toBe('refresh_token');
      expect(cookieCalls[1][1]).toBe('rtk');
      expect(cookieCalls[1][2]).toMatchObject({ httpOnly: true });

      expect(cookieCalls[2][0]).toBe('csrf_token');
      expect(cookieCalls[2][1]).toMatch(/^[0-9a-f]{64}$/);
      expect(cookieCalls[2][2]).toMatchObject({ httpOnly: false });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(dto);
      expect(dto.toJSON().data.token).toBeUndefined();
    });

    it('login calls next with error when loginUseCase throws', async () => {
      const error = new Error('Authentication failed');
      loginUseCaseMock.execute.mockRejectedValue(error);

      await controller.login(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
