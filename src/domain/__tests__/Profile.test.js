import { describe, it, expect } from 'vitest';
import { Profile } from '../entities/Profile.js';
import { FullName } from '../value-objects/FullName.js';
import { Username } from '../value-objects/Username.js';

describe('Profile Entity', () => {
  it('should instantiate a profile with buyer role as default', () => {
    const profile = new Profile({
      id: 'uuid-123',
      username: 'johndoe',
      fullName: 'John Doe',
    });

    expect(profile.id).toBe('uuid-123');
    expect(profile.username).toBe('johndoe');
    expect(profile.fullName).toBe('John Doe');
    expect(profile.role).toBe('buyer');
    expect(profile.isBuyer()).toBe(true);
    expect(profile.createdAt).toBeInstanceOf(Date);
  });

  it('should instantiate with value objects and serialize to JSON correctly', () => {
    const profile = new Profile({
      id: 'uuid-456',
      username: new Username('janedoe'),
      fullName: new FullName('Jane Doe'),
      email: 'jane@example.com',
      avatar_path: 'avatars/jane.jpg',
      bio: 'My bio',
      role: 'buyer',
    });

    expect(profile.username).toBe('janedoe');
    expect(profile.fullName).toBe('Jane Doe');
    expect(profile.isBuyer()).toBe(true);

    const json = profile.toJSON();
    expect(json).toEqual({
      id: 'uuid-456',
      username: 'janedoe',
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      avatar_path: 'avatars/jane.jpg',
      bio: 'My bio',
      locale: 'en',
      created_at: expect.any(String),
      updated_at: expect.any(String),
    });
  });

  it('should throw when missing required fields', () => {
    expect(() => new Profile({ username: 'test', fullName: 'Test' })).toThrow(
      'Profile id is required'
    );
    expect(() => new Profile({ id: '1', fullName: 'Test' })).toThrow(
      'Profile username is required'
    );
    expect(() => new Profile({ id: '1', username: 'test' })).toThrow(
      'Profile full name is required'
    );
  });

  it.each([
    ['seller', 2],
    ['admin', 3],
    ['custom-role', 1],
  ])('assigns the role id for %s', (role, roleId) => {
    const profile = new Profile({
      id: 'uuid-role',
      username: 'roleuser',
      fullName: 'Role User',
      role,
    });

    expect(profile.role).toBe(role);
    expect(profile.roles).toEqual([expect.objectContaining({ id: roleId, name: role })]);
    expect(profile.isBuyer()).toBe(false);
  });

  it('honours a provided roles array and reports buyer membership', () => {
    const roles = [{ id: 2, name: 'seller' }];
    const seller = new Profile({
      id: 'uuid-seller',
      username: 'selleruser',
      fullName: 'Seller User',
      role: 'seller',
      roles,
    });
    const buyerAmongSellers = new Profile({
      id: 'uuid-both',
      username: 'bothuser',
      fullName: 'Both User',
      role: 'seller',
      roles: [...roles, { id: 1, name: 'buyer' }],
    });

    expect(seller.roles).toBe(roles);
    expect(seller.isBuyer()).toBe(false);
    expect(buyerAmongSellers.isBuyer()).toBe(true);
  });

  it('supports camelCase avatar, snake_case full name and dates, and defaults locale', () => {
    const profile = new Profile({
      id: 'uuid-aliases',
      username: 'aliasuser',
      full_name: 'Alias User',
      avatarPath: null,
      avatar_path: 'avatars/alias.jpg',
      locale: '',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-02T00:00:00.000Z',
    });

    expect(profile.fullName).toBe('Alias User');
    expect(profile.avatarPath).toBe('avatars/alias.jpg');
    expect(profile.avatar_path).toBe('avatars/alias.jpg');
    expect(profile.locale).toBe('en');
    expect(profile.createdAt).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    expect(profile.updatedAt).toEqual(new Date('2026-10-02T00:00:00.000Z'));
  });

  it('falls back to a null avatar when neither alias is provided', () => {
    const profile = new Profile({
      id: 'uuid-no-avatar',
      username: 'noavatar',
      fullName: 'No Avatar',
    });

    expect(profile.avatarPath).toBeNull();
    expect(profile.avatar_path).toBeNull();
  });

  it('keeps the camelCase avatar path when provided', () => {
    const profile = new Profile({
      id: 'uuid-avatar',
      username: 'avataruser',
      fullName: 'Avatar User',
      avatarPath: 'avatars/camel.jpg',
      avatar_path: 'avatars/snake.jpg',
    });

    expect(profile.avatarPath).toBe('avatars/camel.jpg');
    expect(profile.avatar_path).toBe('avatars/camel.jpg');
  });
});
