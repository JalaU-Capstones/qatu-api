import { afterEach, describe, expect, it, vi } from 'vitest';
import { sequelize, testConnection } from '../sequelize.js';

describe('Sequelize Configuration', () => {
  it('should export a configured Sequelize instance', () => {
    expect(sequelize).toBeDefined();
    expect(sequelize.options.dialect).toBe('postgres');
  });

  it('should authenticate successfully in testConnection', async () => {
    const authSpy = vi.spyOn(sequelize, 'authenticate').mockResolvedValueOnce(undefined);
    await expect(testConnection()).resolves.toBeUndefined();
    expect(authSpy).toHaveBeenCalled();
  });

  it('should throw and log error when authenticate fails in testConnection', async () => {
    const authSpy = vi
      .spyOn(sequelize, 'authenticate')
      .mockRejectedValueOnce(new Error('Connection refused'));
    await expect(testConnection()).rejects.toThrow('Connection refused');
    expect(authSpy).toHaveBeenCalled();
  });
});

describe('sequelize environment branches', () => {
  const loadSequelize = async () => {
    vi.resetModules();
    const { sequelize: reloaded } = await import('../sequelize.js');
    return reloaded;
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses console logging and no SSL in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const reloaded = await loadSequelize();

    // eslint-disable-next-line no-console
    expect(reloaded.options.logging).toBe(console.log);
    expect(reloaded.options.dialectOptions).toMatchObject({
      database: expect.any(String),
      host: expect.any(String),
    });
    expect(reloaded.options.dialectOptions).not.toHaveProperty('ssl');
  });

  it('enables SSL and disables console logging in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const reloaded = await loadSequelize();

    expect(reloaded.options.logging).toBe(false);
    expect(reloaded.options.dialectOptions).toMatchObject({
      ssl: { require: true, rejectUnauthorized: false },
    });
  });

  it('disables console logging in the test environment', async () => {
    vi.stubEnv('NODE_ENV', 'test');

    const reloaded = await loadSequelize();

    expect(reloaded.options.logging).toBe(false);
    expect(reloaded.options.dialectOptions).not.toHaveProperty('ssl');
  });
});
