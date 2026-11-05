import { describe, expect, it } from 'vitest';
import { IStorageService } from '../IStorageService.js';

describe('IStorageService Port', () => {
  it('should throw not implemented error when uploadAvatar is called directly', async () => {
    const port = new IStorageService();
    await expect(port.uploadAvatar({ userId: 'u-1' })).rejects.toThrow('Method not implemented');
  });
});
