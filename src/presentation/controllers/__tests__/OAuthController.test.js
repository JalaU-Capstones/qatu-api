import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../infrastructure/auth/cookieHelper.js', () => ({
  setSessionCookies: vi.fn(),
}));

import { setSessionCookies } from '../../../infrastructure/auth/cookieHelper.js';
import { OAuthController } from '../OAuthController.js';

describe('OAuthController.exchange', () => {
  let useCase;
  let controller;
  let req;
  let res;
  let next;

  beforeEach(() => {
    useCase = { execute: vi.fn() };
    controller = new OAuthController({ exchangeOAuthTokenUseCase: useCase });
    req = { body: { access_token: 'at', refresh_token: 'rt' } };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('sets cookies and returns 200 on success', async () => {
    useCase.execute.mockResolvedValue({
      user: { id: 'u1' },
      profile: { id: 'u1' },
      roles: [{ id: 1 }],
      accessToken: 'at',
      refreshToken: 'rt',
    });

    await controller.exchange(req, res, next);

    expect(setSessionCookies).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        accessToken: 'at',
        refreshToken: 'rt',
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user: { id: 'u1' },
          profile: { id: 'u1' },
          roles: [{ id: 1 }],
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards errors to next()', async () => {
    const err = new Error('boom');
    useCase.execute.mockRejectedValue(err);

    await controller.exchange(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});
