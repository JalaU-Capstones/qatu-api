import { describe, expect, it } from 'vitest';
import { Profile } from '../../../domain/entities/Profile.js';
import {
  GetProfileByIdRequestDTO,
  ProfileResponseDTO,
  UpdateProfileRequestDTO,
} from '../ProfileDTO.js';

describe('ProfileDTO', () => {
  describe('GetProfileByIdRequestDTO', () => {
    it('should accept a string id and trim it', () => {
      const dto = new GetProfileByIdRequestDTO('  a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  ');
      expect(dto.profileId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    });

    it('should accept an object with profileId or id', () => {
      const dto1 = new GetProfileByIdRequestDTO({ profileId: ' uuid-1 ' });
      expect(dto1.profileId).toBe('uuid-1');

      const dto2 = new GetProfileByIdRequestDTO({ id: ' uuid-2 ' });
      expect(dto2.profileId).toBe('uuid-2');
    });

    it('should default to empty string when missing', () => {
      const dto = new GetProfileByIdRequestDTO();
      expect(dto.profileId).toBe('');
    });
  });

  describe('UpdateProfileRequestDTO', () => {
    it('should normalize updates from nested updates object or top-level fields', () => {
      const dto = new UpdateProfileRequestDTO({
        userId: ' user-123 ',
        updates: {
          full_name: '  Jane Doe  ',
          bio: '  Artisan collector  ',
          avatar_path: '  avatars/jane.webp  ',
          locale: ' es ',
        },
      });

      expect(dto.userId).toBe('user-123');
      expect(dto.updates).toEqual({
        full_name: 'Jane Doe',
        bio: 'Artisan collector',
        avatar_path: 'avatars/jane.webp',
        locale: 'es',
      });
    });

    it('should convert empty string bio and avatar_path to null', () => {
      const dto = new UpdateProfileRequestDTO({
        userId: 'user-123',
        bio: '   ',
        avatarPath: '',
      });

      expect(dto.updates).toEqual({
        bio: null,
        avatar_path: null,
      });
    });
  });

  describe('ProfileResponseDTO', () => {
    it('should serialize a Profile entity into the standard response envelope', () => {
      const profile = new Profile({
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        username: 'john_doe',
        fullName: 'John Doe',
        email: 'john@example.com',
        avatarPath: 'avatars/john.webp',
        bio: 'Hello world',
        locale: 'en',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-02T00:00:00.000Z',
      });

      const responseDto = new ProfileResponseDTO(profile, '2026-10-14T12:00:00.000Z');
      expect(responseDto.toJSON()).toEqual({
        data: {
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          username: 'john_doe',
          full_name: 'John Doe',
          email: 'john@example.com',
          avatar_path: 'avatars/john.webp',
          bio: 'Hello world',
          locale: 'en',
          created_at: '2026-10-01T00:00:00.000Z',
          updated_at: '2026-10-02T00:00:00.000Z',
        },
        meta: {
          timestamp: '2026-10-14T12:00:00.000Z',
        },
      });
    });
  });
});
