import { afterEach, describe, expect, it, vi } from 'vitest';

const loadLogger = async () => {
  vi.resetModules();
  const { logger } = await import('../logger.js');
  return logger;
};

describe('logger', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses LOG_LEVEL when explicitly provided', async () => {
    vi.stubEnv('LOG_LEVEL', 'debug');
    vi.stubEnv('NODE_ENV', 'test');

    expect((await loadLogger()).level).toBe('debug');
  });

  it('falls back to info outside the test environment', async () => {
    vi.stubEnv('LOG_LEVEL', '');
    vi.stubEnv('NODE_ENV', 'production');

    expect((await loadLogger()).level).toBe('info');
  });

  it('is silent in tests when no level is configured', async () => {
    vi.stubEnv('LOG_LEVEL', '');
    vi.stubEnv('NODE_ENV', 'test');

    expect((await loadLogger()).level).toBe('silent');
  });
});
