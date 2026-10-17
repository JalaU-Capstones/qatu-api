import { describe, it, expect } from 'vitest';
import { IAuthService } from '../IAuthService.js';

describe('IAuthService Interface', () => {
  it('should throw Method not implemented when calling registerUser', async () => {
    const service = new IAuthService();
    await expect(service.registerUser({})).rejects.toThrow('Method not implemented');
  });

  it('should throw Method not implemented when calling emailExists', async () => {
    const service = new IAuthService();
    await expect(service.emailExists('test@example.com')).rejects.toThrow('Method not implemented');
  });
});
