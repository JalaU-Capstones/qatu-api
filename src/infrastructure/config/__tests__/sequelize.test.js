import { describe, it, expect, vi } from 'vitest';
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
