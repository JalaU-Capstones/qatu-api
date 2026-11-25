import { describe, expect, it } from 'vitest';
import { RegisterRequestDTO, RegisterResponseDTO } from '../RegisterDTO.js';

describe('RegisterRequestDTO', () => {
  it('prefers full_name over fullName and mirrors both fields', () => {
    const dto = new RegisterRequestDTO({
      email: 'user@example.com',
      password: 'secret',
      username: 'user',
      fullName: 'Camel Name',
      full_name: 'Snake Name',
    });

    expect(dto.fullName).toBe('Snake Name');
    expect(dto.full_name).toBe('Snake Name');
  });

  it('falls back to fullName and leaves it undefined when absent', () => {
    expect(
      new RegisterRequestDTO({
        email: 'u@e.com',
        password: 'p',
        username: 'u',
        fullName: 'Camel Name',
      }).fullName
    ).toBe('Camel Name');
    expect(
      new RegisterRequestDTO({ email: 'u@e.com', password: 'p', username: 'u' }).fullName
    ).toBeUndefined();
  });
});

describe('RegisterResponseDTO', () => {
  const user = { id: 'user-1', email: 'user@example.com' };

  it('exposes profile and roles through getters and serializes the full envelope', () => {
    const response = new RegisterResponseDTO({ user, timestamp: '2026-11-23T00:00:00.000Z' });

    expect(response.user).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      created_at: expect.any(String),
    });
    expect(response.profile).toMatchObject({
      id: 'user-1',
      username: 'user',
      full_name: null,
      email: 'user@example.com',
      avatar_path: null,
      bio: null,
      locale: 'en',
    });
    expect(response.roles).toEqual([{ id: 1, name: 'buyer', created_at: expect.any(String) }]);
    expect(response.toJSON()).toEqual({
      data: { user: response.user, profile: response.profile, roles: response.roles },
      meta: { timestamp: '2026-11-23T00:00:00.000Z' },
    });
  });

  it('maps a provided profile with camelCase aliases and Date timestamps', () => {
    const profile = {
      id: 'profile-1',
      username: 'seller',
      fullName: 'Seller Name',
      avatarPath: 'avatars/seller.webp',
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-02T00:00:00.000Z'),
    };
    const response = new RegisterResponseDTO({
      user: { ...user, createdAt: new Date('2026-09-01T00:00:00.000Z') },
      profile,
      roles: [{ id: 2, name: 'seller' }],
    });

    expect(response.user.created_at).toBe('2026-09-01T00:00:00.000Z');
    expect(response.profile).toMatchObject({
      full_name: 'Seller Name',
      email: 'user@example.com',
      avatar_path: expect.stringContaining('avatars/seller.webp'),
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-02T00:00:00.000Z',
    });
    expect(response.roles).toEqual([{ id: 2, name: 'seller' }]);
  });

  it('keeps an empty roles array as the default buyer role', () => {
    const response = new RegisterResponseDTO({ user, roles: [] });

    expect(response.roles).toHaveLength(1);
    expect(response.roles[0].name).toBe('buyer');
  });

  it('falls back to camelCase profile aliases and Date timestamps', () => {
    const response = new RegisterResponseDTO({
      user,
      profile: {
        id: 'profile-2',
        username: 'seller',
        fullName: 'Alias Name',
        avatarPath: null,
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
        updatedAt: new Date('2026-10-02T00:00:00.000Z'),
      },
    });

    expect(response.profile.full_name).toBe('Alias Name');
    expect(response.profile.avatar_path).toBeNull();
    expect(response.profile.created_at).toBe('2026-10-01T00:00:00.000Z');
    expect(response.profile.updated_at).toBe('2026-10-02T00:00:00.000Z');
  });

  it('preserves an explicit null full_name and defaults missing aliases', () => {
    const explicitNull = new RegisterResponseDTO({
      user,
      profile: { id: 'p', username: 'u', full_name: null },
    });
    const withoutAliases = new RegisterResponseDTO({
      user,
      profile: { id: 'p', username: 'u', created_at: null, updated_at: null },
    });

    expect(explicitNull.profile.full_name).toBeNull();
    expect(withoutAliases.profile.full_name).toBeNull();
    expect(withoutAliases.profile.email).toBe(user.email);
    expect(withoutAliases.profile.created_at).toEqual(expect.any(String));
    expect(withoutAliases.profile.updated_at).toEqual(expect.any(String));
  });
});
