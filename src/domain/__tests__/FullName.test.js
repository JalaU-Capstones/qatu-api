import { describe, it, expect } from 'vitest';
import { FullName } from '../value-objects/FullName.js';

describe('FullName Value Object', () => {
  it('should accept valid full name', () => {
    const fullName = new FullName('Leonardo Pitre');
    expect(fullName.getValue()).toBe('Leonardo Pitre');
  });

  it('should reject too short or empty full name', () => {
    expect(() => new FullName('')).toThrow('Full name is required');
    expect(() => new FullName('A')).toThrow('Full name must be between 2 and 100 characters');
  });
});
