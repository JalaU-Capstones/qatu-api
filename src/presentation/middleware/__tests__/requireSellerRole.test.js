import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireSellerRole } from '../requireSellerRole.js';

describe('requireSellerRole middleware', () => {
  let req;
  let next;

  beforeEach(() => {
    req = { user: { id: 'u-1' } };
    next = vi.fn();
  });

  it('allows authenticated sellers and stores resolved role names on req.user', async () => {
    const profileRepository = { getRoleNames: vi.fn().mockResolvedValue(['buyer', 'seller']) };

    await requireSellerRole({ profileRepository })(req, {}, next);

    expect(profileRepository.getRoleNames).toHaveBeenCalledWith('u-1');
    expect(req.user.roles).toEqual(['buyer', 'seller']);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects authenticated non-sellers with 403 FORBIDDEN', async () => {
    const profileRepository = { getRoleNames: vi.fn().mockResolvedValue(['buyer']) };

    await requireSellerRole({ profileRepository })(req, {}, next);

    expect(next).toHaveBeenCalledOnce();
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Seller role required');
    expect(err.code).toBe('FORBIDDEN');
    expect(err.statusCode).toBe(403);
  });

  it('rejects unauthenticated users with 401 UNAUTHORIZED', async () => {
    const profileRepository = { getRoleNames: vi.fn() };
    req.user = {};

    await requireSellerRole({ profileRepository })(req, {}, next);

    expect(profileRepository.getRoleNames).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    const err = next.mock.calls[0][0];
    expect(err.message).toBe('Authentication required');
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.statusCode).toBe(401);
  });
});
