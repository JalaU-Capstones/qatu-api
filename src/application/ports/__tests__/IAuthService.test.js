import { describe, expect, it } from 'vitest';
import { IAuthService } from '../IAuthService.js';

describe('IAuthService interface', () => {
  it('throws on unimplemented methods', async () => {
    const service = new IAuthService();
    await expect(service.registerUser({})).rejects.toThrow('Method not implemented');
    await expect(service.loginUser({})).rejects.toThrow('Method not implemented');
    await expect(service.emailExists('a@b.com')).rejects.toThrow('Method not implemented');
  });
});
