import { describe, expect, it } from 'vitest';
import { LoginRequestDTO, LoginResponseDTO } from '../LoginDTO.js';

describe('LoginRequestDTO', () => {
  it('normalizes a string email and preserves the password', () => {
    const dto = new LoginRequestDTO({ email: '  USER@Example.COM ', password: 'secret' });

    expect(dto.email).toBe('user@example.com');
    expect(dto.password).toBe('secret');
  });

  it('keeps a non-string email unchanged', () => {
    expect(new LoginRequestDTO({ email: 123, password: 'secret' }).email).toBe(123);
  });
});

describe('LoginResponseDTO', () => {
  const buildParams = (overrides = {}) => ({
    user: { id: 'u1', email: 'user@example.com', created_at: '2026-11-20T10:00:00.000Z' },
    profile: {
      id: 'p1',
      username: 'user',
      full_name: 'User Name',
      email: 'user@example.com',
      avatar_path: 'avatars/user.webp',
      bio: 'Bio',
      locale: 'es',
      created_at: '2026-11-20T10:00:00.000Z',
      updated_at: '2026-11-21T10:00:00.000Z',
    },
    roles: [{ id: 1, name: 'buyer', created_at: '2026-11-20T10:00:00.000Z' }],
    timestamp: '2026-11-23T10:00:00.000Z',
    ...overrides,
  });

  it('maps the full response envelope', () => {
    const dto = new LoginResponseDTO(buildParams());

    expect(dto.toJSON()).toEqual({
      data: {
        user: { id: 'u1', email: 'user@example.com', created_at: '2026-11-20T10:00:00.000Z' },
        profile: expect.objectContaining({
          avatar_path: expect.stringContaining('avatars/user.webp'),
          bio: 'Bio',
          locale: 'es',
        }),
        roles: [{ id: 1, name: 'buyer', created_at: '2026-11-20T10:00:00.000Z' }],
      },
      meta: { timestamp: '2026-11-23T10:00:00.000Z' },
    });
  });

  it('uses camelCase avatar alias and defaults bio, locale and timestamp', () => {
    const params = buildParams();
    params.profile.avatarPath = 'avatars/alias.webp';
    delete params.profile.avatar_path;
    delete params.profile.bio;
    delete params.profile.locale;
    delete params.timestamp;

    const dto = new LoginResponseDTO(params);

    expect(dto.profile.avatar_path).toContain('avatars/alias.webp');
    expect(dto.profile.bio).toBeNull();
    expect(dto.profile.locale).toBe('en');
    expect(dto.timestamp).toEqual(expect.any(String));
  });
});
