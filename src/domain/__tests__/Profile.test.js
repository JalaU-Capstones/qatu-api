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
});
