import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRateLimiter, oauthExchangeLimiter } from '../rateLimiter.js';

function createMockResponse() {
  const headers = {};
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return {
    headers,
    json,
    status,
    setHeader: vi.fn((name, value) => {
      // eslint-disable-next-line security/detect-object-injection
      headers[name] = value;
    }),
  };
}

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-23T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests under the limit and sets rate-limit headers', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    const next = vi.fn();
    const res = createMockResponse();

    limiter({ ip: '1.1.1.1' }, res, next);
    limiter({ ip: '1.1.1.1' }, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '2');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Reset',
      String(Math.ceil((Date.now() + 60_000) / 1000))
    );
  });

  it('returns 429 TOO_MANY_REQUESTS once the limit is exceeded', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const next = vi.fn();
    const res = createMockResponse();

    limiter({ ip: '2.2.2.2' }, res, next);
    limiter({ ip: '2.2.2.2' }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests. Please try again later.',
        details: [],
      },
      meta: { timestamp: expect.any(String) },
    });
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });

  it('resets a expired entry after the window elapses', () => {
    const limiter = createRateLimiter({ windowMs: 1_000, max: 1 });
    const next = vi.fn();

    limiter({ ip: '3.3.3.3' }, createMockResponse(), next);
    vi.advanceTimersByTime(1_001);
    limiter({ ip: '3.3.3.3' }, createMockResponse(), next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it('evicts the oldest key when maxKeys is reached', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 10, maxKeys: 2 });
    const next = vi.fn();

    limiter({ ip: 'a' }, createMockResponse(), next);
    limiter({ ip: 'b' }, createMockResponse(), next);
    limiter({ ip: 'c' }, createMockResponse(), next);
    limiter({ ip: 'a' }, createMockResponse(), next);

    expect(next).toHaveBeenCalledTimes(4);
  });

  it('uses a custom key generator', () => {
    const keyGenerator = vi.fn((req) => req.user.id);
    const limiter = createRateLimiter({ max: 1, keyGenerator });
    const req = { user: { id: 'user-1' } };

    limiter(req, createMockResponse(), vi.fn());
    expect(keyGenerator).toHaveBeenCalledWith(req);
  });

  it('reset clears the store', () => {
    const limiter = createRateLimiter({ max: 1 });
    const next = vi.fn();

    limiter({ ip: '4.4.4.4' }, createMockResponse(), next);
    limiter.reset();
    limiter({ ip: '4.4.4.4' }, createMockResponse(), next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it('exports a preconfigured OAuth limiter', () => {
    const next = vi.fn();

    for (let i = 0; i < 10; i += 1) {
      oauthExchangeLimiter({ ip: '5.5.5.5' }, createMockResponse(), next);
    }
    oauthExchangeLimiter({ ip: '5.5.5.5' }, createMockResponse(), next);

    expect(next).toHaveBeenCalledTimes(10);
    oauthExchangeLimiter.reset();
  });

  it('sweeps both expired and still-live entries', () => {
    const limiter = createRateLimiter({ windowMs: 1_000, max: 1 });
    const next = vi.fn();

    limiter({ ip: '6.6.6.6' }, createMockResponse(), next);
    vi.advanceTimersByTime(1_100);
    const secondRes = createMockResponse();
    limiter({ ip: '6.6.6.6' }, secondRes, next);
    vi.advanceTimersByTime(1_000);
    const thirdRes = createMockResponse();
    limiter({ ip: '6.6.6.6' }, thirdRes, next);

    expect(next).toHaveBeenCalledTimes(3);
    expect(secondRes.headers['X-RateLimit-Remaining']).toBe('0');
    expect(thirdRes.headers['X-RateLimit-Remaining']).toBe('0');
  });

  it('tolerates a timer handle without unref', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval').mockReturnValue({});
    const limiter = createRateLimiter({ max: 1 });

    expect(() => limiter({ ip: '7.7.7.7' }, createMockResponse(), vi.fn())).not.toThrow();

    setIntervalSpy.mockRestore();
  });
});
