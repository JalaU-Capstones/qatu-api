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
          role: profile.role,
          created_at: profile.createdAt.toISOString(),
          updated_at: profile.updatedAt.toISOString(),
        })
        .select()
        .single();

      if (!error && data) {
        return new Profile({
          id: data.id,
          username: data.username,
          fullName: data.full_name,
          role: data.role,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
        });
      }
    }

    // Fallback in-memory storage (e.g. for offline dev or unit testing)
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
        return new Profile({
          id: data.id,
          username: data.username,
          fullName: data.full_name,
          role: data.role,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
        });
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
        .eq('username', username)
        .single();

      if (!error && data) {
        return new Profile({
          id: data.id,
          username: data.username,
          fullName: data.full_name,
          role: data.role,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
        });
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
