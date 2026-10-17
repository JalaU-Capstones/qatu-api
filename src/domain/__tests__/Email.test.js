import { describe, it, expect } from 'vitest';
import { Email } from '../value-objects/Email.js';

describe('Email Value Object', () => {
  it('should create a valid email and normalize it to lowercase', () => {
    const email = new Email('User.Test@Example.Com');
    expect(email.getValue()).toBe('user.test@example.com');
  });

  it('should throw an error for invalid email formats', () => {
    expect(() => new Email('invalid-email')).toThrow('Invalid email format');
    expect(() => new Email('user@')).toThrow('Invalid email format');
    expect(() => new Email('@example.com')).toThrow('Invalid email format');
    expect(() => new Email('')).toThrow('Email is required');
  });

  it('should correctly evaluate equality', () => {
    const email1 = new Email('test@example.com');
    const email2 = new Email('test@example.com');
    const email3 = new Email('other@example.com');
    expect(email1.equals(email2)).toBe(true);
    expect(email1.equals(email3)).toBe(false);
  });
});
