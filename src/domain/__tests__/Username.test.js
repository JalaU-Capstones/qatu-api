import { describe, it, expect } from 'vitest';
import { Username } from '../value-objects/Username.js';

describe('Username Value Object', () => {
  it('should accept valid usernames', () => {
    const username = new Username('john_doe_99');
    expect(username.getValue()).toBe('john_doe_99');
  });

  it('should reject invalid usernames', () => {
    expect(() => new Username('ab')).toThrow('Username must be between 3 and 30 characters');
    expect(() => new Username('user with spaces')).toThrow(
      'Username must be between 3 and 30 characters'
    );
    expect(() => new Username('user@name')).toThrow('Username must be between 3 and 30 characters');
  });

  it('should correctly evaluate equality', () => {
    const u1 = new Username('user1');
    const u2 = new Username('user1');
    const u3 = new Username('user2');
    expect(u1.equals(u2)).toBe(true);
    expect(u1.equals(u3)).toBe(false);
  });
});
