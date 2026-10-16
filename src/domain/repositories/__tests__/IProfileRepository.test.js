import { describe, it, expect } from 'vitest';
import { IProfileRepository } from '../IProfileRepository.js';

describe('IProfileRepository Interface', () => {
  it('should throw Method not implemented when calling create', async () => {
    const repo = new IProfileRepository();
    await expect(repo.create({})).rejects.toThrow('Method not implemented');
  });

  it('should throw Method not implemented when calling findById', async () => {
    const repo = new IProfileRepository();
    await expect(repo.findById('id-1')).rejects.toThrow('Method not implemented');
  });

  it('should throw Method not implemented when calling findByUsername', async () => {
    const repo = new IProfileRepository();
    await expect(repo.findByUsername('user-1')).rejects.toThrow('Method not implemented');
  });
});
