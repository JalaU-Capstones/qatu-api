import { describe, expect, it } from 'vitest';
import { updateProfileSchema } from '../updateProfileSchema.js';

describe('updateProfileSchema', () => {
  it('should validate valid partial profile updates', () => {
    const { error, value } = updateProfileSchema.validate(
      {
        full_name: '  Jane Doe  ',
        bio: '  Marketplace buyer  ',
        avatar_path: 'avatars/jane.webp',
        locale: 'es',
      },
      { abortEarly: false, stripUnknown: true }
    );

    expect(error).toBeUndefined();
    expect(value).toEqual({
      full_name: 'Jane Doe',
      bio: 'Marketplace buyer',
      avatar_path: 'avatars/jane.webp',
      locale: 'es',
    });
  });

  it('should allow empty string or null for bio and avatar_path', () => {
    const { error, value } = updateProfileSchema.validate(
      {
        bio: '',
        avatar_path: null,
      },
      { abortEarly: false, stripUnknown: true }
    );

    expect(error).toBeUndefined();
    expect(value).toEqual({
      bio: '',
      avatar_path: null,
    });
  });

  it('should reject when bio exceeds 500 characters', () => {
    const { error } = updateProfileSchema.validate(
      {
        bio: 'a'.repeat(501),
      },
      { abortEarly: false }
    );

    expect(error).toBeDefined();
    expect(error.details[0].path).toEqual(['bio']);
    expect(error.details[0].message).toBe('bio must be at most 500 characters');
  });

  it('should reject when full_name is shorter than 2 or longer than 100 characters', () => {
    const shortRes = updateProfileSchema.validate({ full_name: 'A' }, { abortEarly: false });
    expect(shortRes.error).toBeDefined();
    expect(shortRes.error.details[0].path).toEqual(['full_name']);

    const longRes = updateProfileSchema.validate(
      { full_name: 'A'.repeat(101) },
      { abortEarly: false }
    );
    expect(longRes.error).toBeDefined();
    expect(longRes.error.details[0].path).toEqual(['full_name']);
  });

  it('should reject when no valid fields are provided', () => {
    const { error } = updateProfileSchema.validate(
      {
        username: 'cannot_change_username',
      },
      { abortEarly: false, stripUnknown: true }
    );

    expect(error).toBeDefined();
    expect(error.details[0].message).toBe('At least one profile field must be provided');
  });
});
