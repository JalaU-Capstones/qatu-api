import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Profile } from '../../../../domain/entities/Profile.js';
import { ProfileRepository } from '../ProfileRepository.js';

describe('ProfileRepository', () => {
  let mockClient;
  let repositoryWithClient;
  let repositoryInMemory;

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
  });

  beforeEach(() => {
    mockClient = {
      from: vi.fn(),
    };
    repositoryWithClient = new ProfileRepository({ client: mockClient });
    repositoryInMemory = new ProfileRepository();
  });

  describe('mapRowToEntity', () => {
    it('should map a database row to a Profile entity with full fields', () => {
      const entity = repositoryWithClient.mapRowToEntity(sampleDbRow);

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

    it('should return null if row is null or undefined', () => {
      expect(repositoryWithClient.mapRowToEntity(null)).toBeNull();
      expect(repositoryWithClient.mapRowToEntity(undefined)).toBeNull();
    });
  });

  describe('create', () => {
    it('should insert into database and return mapped entity when client is present', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: sampleDbRow,
        error: null,
      });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      mockClient.from.mockReturnValue({ insert: insertMock });

      const result = await repositoryWithClient.create(sampleProfile);

      expect(mockClient.from).toHaveBeenCalledWith('profiles');
      expect(result).toBeInstanceOf(Profile);
      expect(result.id).toBe(sampleProfile.id);
    });

    it('should throw an error when database insertion fails', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection error' },
      });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      mockClient.from.mockReturnValue({ insert: insertMock });

      await expect(repositoryWithClient.create(sampleProfile)).rejects.toThrow(
        'Failed to create profile: Database connection error'
      );
    });

    it('should save to in-memory store when client is not provided', async () => {
      const result = await repositoryInMemory.create(sampleProfile);
      expect(result).toBe(sampleProfile);

      const retrieved = await repositoryInMemory.findById(sampleProfile.id);
      expect(retrieved).toBe(sampleProfile);
    });
  });

  describe('findById', () => {
    it('should find profile by ID via client', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: sampleDbRow,
        error: null,
      });
      const eqMock = vi.fn().mockReturnValue({ single: singleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      mockClient.from.mockReturnValue({ select: selectMock });

      const result = await repositoryWithClient.findById(sampleProfile.id);

      expect(result).toBeInstanceOf(Profile);
      expect(result.id).toBe(sampleProfile.id);
    });

    it('should return null when client does not find the profile', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });
      const eqMock = vi.fn().mockReturnValue({ single: singleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      mockClient.from.mockReturnValue({ select: selectMock });

      const result = await repositoryWithClient.findById('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return null when not found in in-memory store', async () => {
      const result = await repositoryInMemory.findById('unknown-id');
      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should find profile by username via client', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: sampleDbRow,
        error: null,
      });
      const ilikeMock = vi.fn().mockReturnValue({ single: singleMock });
      const selectMock = vi.fn().mockReturnValue({ ilike: ilikeMock });
      mockClient.from.mockReturnValue({ select: selectMock });

      const result = await repositoryWithClient.findByUsername('test_user');

      expect(result).toBeInstanceOf(Profile);
      expect(result.username).toBe('test_user');
    });

    it('should return null when client cannot find username', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });
      const ilikeMock = vi.fn().mockReturnValue({ single: singleMock });
      const selectMock = vi.fn().mockReturnValue({ ilike: ilikeMock });
      mockClient.from.mockReturnValue({ select: selectMock });

      const result = await repositoryWithClient.findByUsername('unknown_user');
      expect(result).toBeNull();
    });

    it('should find profile case-insensitively in in-memory store', async () => {
      await repositoryInMemory.create(sampleProfile);

      const foundUpper = await repositoryInMemory.findByUsername('TEST_USER');
      expect(foundUpper).toBe(sampleProfile);

      const notFound = await repositoryInMemory.findByUsername('non_existing');
      expect(notFound).toBeNull();
    });
  });
});
