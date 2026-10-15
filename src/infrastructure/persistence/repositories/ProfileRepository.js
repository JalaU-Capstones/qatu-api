import { Profile } from '../../../domain/entities/Profile.js';
import { IProfileRepository } from '../../../domain/repositories/IProfileRepository.js';

export class ProfileRepository extends IProfileRepository {
  /**
   * @param {Object} [options]
   * @param {import('@supabase/supabase-js').SupabaseClient} [options.client]
   */
  constructor({ client } = {}) {
    super();
    this.client = client;
    this.inMemoryStore = new Map();
  }

  /**
   * Maps a database row into a domain Profile entity.
   *
   * @param {Object} row
   * @returns {Profile}
   */
  mapRowToEntity(row) {
    if (!row) return null;
    return new Profile({
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      email: row.email || null,
      avatarPath: row.avatar_path || null,
      bio: row.bio || null,
      locale: row.locale || 'en',
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    });
  }

  /**
   * @param {Profile} profile
   * @returns {Promise<Profile>}
   */
  async create(profile) {
    if (this.client?.from) {
      const { data, error } = await this.client
        .from('profiles')
        .insert({
          id: profile.id,
          username: profile.username,
          full_name: profile.fullName,
          email: profile.email,
          avatar_path: profile.avatarPath,
          bio: profile.bio,
          locale: profile.locale,
        })
        .select()
        .single();

      if (!error && data) {
        return this.mapRowToEntity(data);
      }
      if (error) {
        throw new Error(`Failed to create profile: ${error.message}`);
      }
    }

    // In-memory store fallback (useful for tests or standalone mode)
    this.inMemoryStore.set(profile.id, profile);
    return profile;
  }

  /**
   * @param {string} id
   * @returns {Promise<Profile|null>}
   */
  async findById(id) {
    if (this.client?.from) {
      const { data, error } = await this.client.from('profiles').select('*').eq('id', id).single();

      if (!error && data) {
        return this.mapRowToEntity(data);
      }
    }

    return this.inMemoryStore.get(id) || null;
  }

  /**
   * @param {string} username
   * @returns {Promise<Profile|null>}
   */
  async findByUsername(username) {
    if (this.client?.from) {
      const { data, error } = await this.client
        .from('profiles')
        .select('*')
        .ilike('username', username)
        .single();

      if (!error && data) {
        return this.mapRowToEntity(data);
      }
    }

    for (const p of this.inMemoryStore.values()) {
      if (p.username.toLowerCase() === username.toLowerCase()) {
        return p;
      }
    }
    return null;
  }
}
