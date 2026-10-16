import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Profile } from '../../../../domain/entities/Profile.js';
import { ProfileRepository } from '../ProfileRepository.js';

describe('ProfileRepository', () => {
  let mockDb;
  let repository;

  const sampleDbRow = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    username: 'test_user',
    full_name: 'Test User',
    email: 'test@example.com',
    avatar_path: 'avatars/pic.jpg',
    bio: 'A bio description',
    locale: 'en',
    created_at: '2026-10-15T12:00:00.000Z',
    updated_at: '2026-10-15T12:00:00.000Z',
  };

  const sampleProfile = new Profile({
    id: sampleDbRow.id,
    username: sampleDbRow.username,
    fullName: sampleDbRow.full_name,
    email: sampleDbRow.email,
    avatarPath: sampleDbRow.avatar_path,
    bio: sampleDbRow.bio,
    locale: sampleDbRow.locale,
  });

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };
    repository = new ProfileRepository({ db: mockDb });
  });

  describe('constructor', () => {
    it('should initialize with default sequelize instance when no db is passed', () => {
      const repo = new ProfileRepository();
      expect(repo.db).toBeDefined();
    });
  });

  describe('toDomain / mapRowToEntity', () => {
    it('should map a database row to a Profile entity with full fields', () => {
      const entity = repository.toDomain(sampleDbRow);

      expect(entity).toBeInstanceOf(Profile);
      expect(entity.id).toBe(sampleDbRow.id);
      expect(entity.username).toBe(sampleDbRow.username);
      expect(entity.fullName).toBe(sampleDbRow.full_name);
      expect(entity.email).toBe(sampleDbRow.email);
      expect(entity.avatarPath).toBe(sampleDbRow.avatar_path);
      expect(entity.bio).toBe(sampleDbRow.bio);
      expect(entity.locale).toBe('en');
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
    });

    it('should map a minimal database row when optional fields are missing', () => {
      const minimalRow = {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        username: 'test_user',
        full_name: 'Test User',
      };
      const entity = repository.toDomain(minimalRow);

      expect(entity).toBeInstanceOf(Profile);
      expect(entity.email).toBeNull();
      expect(entity.avatarPath).toBeNull();
      expect(entity.bio).toBeNull();
      expect(entity.locale).toBe('en');
    });

    it('should support mapRowToEntity alias', () => {
      const entity = repository.mapRowToEntity(sampleDbRow);
      expect(entity).toBeInstanceOf(Profile);
      expect(entity.id).toBe(sampleDbRow.id);
    });

    it('should return null if row is null or undefined', () => {
      expect(repository.toDomain(null)).toBeNull();
      expect(repository.toDomain(undefined)).toBeNull();
      expect(repository.mapRowToEntity(null)).toBeNull();
    });
  });

  describe('create', () => {
    it('should execute queries for shadow user, profile upsert, and role assignment, returning Profile', async () => {
      mockDb.query
        .mockResolvedValueOnce([[]]) // auth.users insert
        .mockResolvedValueOnce([[sampleDbRow]]) // profiles upsert
        .mockResolvedValueOnce([[]]); // user_roles insert

      const result = await repository.create(sampleProfile);

      expect(mockDb.query).toHaveBeenCalledTimes(3);

      const firstCallSql = mockDb.query.mock.calls[0][0];
      expect(firstCallSql).toContain('INSERT INTO auth.users');

      const secondCallSql = mockDb.query.mock.calls[1][0];
      expect(secondCallSql).toContain('INSERT INTO profiles');
      expect(secondCallSql).toContain('ON CONFLICT (id) DO UPDATE SET');

      const thirdCallSql = mockDb.query.mock.calls[2][0];
      expect(thirdCallSql).toContain('INSERT INTO user_roles');

      expect(result).toBeInstanceOf(Profile);
      expect(result.id).toBe(sampleProfile.id);
      expect(result.username).toBe(sampleProfile.username);
    });

    it('should propagate error when database query fails during create', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));

      await expect(repository.create(sampleProfile)).rejects.toThrow(
        'Connection terminated unexpectedly'
      );
    });
  });

  describe('findById', () => {
    it('should find profile by ID and attach assigned roles', async () => {
      mockDb.query
        .mockResolvedValueOnce([[sampleDbRow]]) // profile SELECT
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              name: 'buyer',
              created_at: '2026-10-15T12:00:00.000Z',
            },
            {
              id: 2,
              name: 'seller',
              created_at: null,
            },
          ],
        ]); // roles SELECT

      const result = await repository.findById(sampleProfile.id);

      expect(result).toBeInstanceOf(Profile);
      expect(result.id).toBe(sampleProfile.id);
      expect(result.roles).toHaveLength(2);
      expect(result.roles[0].name).toBe('buyer');
      expect(result.roles[1].name).toBe('seller');
    });

    it('should return profile without roles if no roles are assigned', async () => {
      mockDb.query
        .mockResolvedValueOnce([[sampleDbRow]]) // profile SELECT
        .mockResolvedValueOnce([[]]); // empty roles SELECT

      const result = await repository.findById(sampleProfile.id);
      expect(result).toBeInstanceOf(Profile);
      expect(result.id).toBe(sampleProfile.id);
    });

    it('should return null when profile is not found by ID', async () => {
      mockDb.query.mockResolvedValueOnce([[]]); // empty rows

      const result = await repository.findById('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should find profile by username case-insensitively', async () => {
      mockDb.query.mockResolvedValueOnce([[sampleDbRow]]);

      const result = await repository.findByUsername('TEST_USER');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('lower(username) = lower(:username)'),
        expect.objectContaining({ replacements: { username: 'TEST_USER' } })
      );
      expect(result).toBeInstanceOf(Profile);
      expect(result.username).toBe('test_user');
    });

    it('should return null when username is not found', async () => {
      mockDb.query.mockResolvedValueOnce([[]]);

      const result = await repository.findByUsername('non_existing');
      expect(result).toBeNull();
    });
  });
});
