import { describe, it, expect } from 'vitest';
import { Password } from '../value-objects/Password.js';

describe('Password Value Object', () => {
  it('should accept valid passwords meeting complexity requirements', () => {
    const password = new Password('StrongP@ssw0rd!');
    expect(password.getValue()).toBe('StrongP@ssw0rd!');
  });

  it('should throw descriptive requirements message when password is weak', () => {
    const expectedMessage = Password.REQUIREMENTS_MESSAGE;
    expect(() => new Password('short1!')).toThrow(expectedMessage);
    expect(() => new Password('alllowercase1!')).toThrow(expectedMessage);
    expect(() => new Password('ALLUPPERCASE1!')).toThrow(expectedMessage);
    expect(() => new Password('NoNumberOrSpecial')).toThrow(expectedMessage);
    expect(() => new Password('NoSpecialChar123')).toThrow(expectedMessage);
  });
});
