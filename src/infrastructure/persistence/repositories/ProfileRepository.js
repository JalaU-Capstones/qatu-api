import { Profile } from '../../../domain/entities/Profile.js';
import { IProfileRepository } from '../../../domain/repositories/IProfileRepository.js';
import { sequelize } from '../../config/sequelize.js';

export class ProfileRepository extends IProfileRepository {
  /**
   * @param {Object} [options]
   * @param {import('sequelize').Sequelize} [options.db=sequelize]
   */
  constructor({ db = sequelize } = {}) {
    super();
    this.db = db;
  }

  /**
   * Maps a database row and optional roles into a domain Profile entity.
   *
   * @param {Object} row
   * @param {Array<Object>} [roles]
   * @returns {Profile|null}
   */
  toDomain(row, roles) {
    if (!row) return null;
    return new Profile({
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      full_name: row.full_name,
      email: row.email || null,
      avatarPath: row.avatar_path || null,
      avatar_path: row.avatar_path || null,
      bio: row.bio || null,
      locale: row.locale || 'en',
      roles: roles || undefined,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    });
  }

  /**
   * Alias for backwards compatibility with tests and callers.
   *
   * @param {Object} row
   * @returns {Profile|null}
   */
  mapRowToEntity(row) {
    return this.toDomain(row);
  }

  /**
   * Persists a Profile entity into the application PostgreSQL database.
   *
   * @param {Profile} profile
   * @param {Object} [options]
   * @param {import('sequelize').Transaction} [options.transaction]
   * @returns {Promise<Profile>}
   */
  async create(profile, { transaction } = {}) {
    // Satisfy foreign-key constraint if present (migration 003 references auth.users).
    await this.db.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES (:id, :email, :metadata::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      {
        replacements: {
          id: profile.id,
          email: profile.email,
          metadata: JSON.stringify({
            username: profile.username,
            full_name: profile.fullName || profile.full_name,
          }),
        },
        transaction,
      }
    );

    const query = `
      INSERT INTO profiles (id, username, full_name, email, avatar_path, bio, locale)
      VALUES (:id, :username, :full_name, :email, :avatar_path, :bio, :locale)
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        avatar_path = EXCLUDED.avatar_path,
        bio = EXCLUDED.bio,
        locale = EXCLUDED.locale
      RETURNING id, username, full_name, email, avatar_path, bio, locale, created_at, updated_at
    `;

    const [rows] = await this.db.query(query, {
      replacements: {
        id: profile.id,
        username: profile.username,
        full_name: profile.fullName || profile.full_name,
        email: profile.email,
        avatar_path: profile.avatarPath || profile.avatar_path || null,
        bio: profile.bio || null,
        locale: profile.locale || 'en',
      },
      transaction,
    });

    // Ensure role assignment exists in user_roles
    await this.db.query(
      `INSERT INTO user_roles (profile_id, role_id)
       SELECT :profile_id, r.id FROM roles r WHERE r.name = 'buyer'
       ON CONFLICT (profile_id, role_id) DO NOTHING`,
      {
        replacements: {
          profile_id: profile.id,
        },
        transaction,
      }
    );

    return this.toDomain(rows[0], profile.roles);
  }

  /**
   * Finds a Profile by primary key (id).
   *
   * @param {string} id
   * @param {Object} [options]
   * @param {import('sequelize').Transaction} [options.transaction]
   * @returns {Promise<Profile|null>}
   */
  async findById(id, { transaction } = {}) {
    const query = `
      SELECT id, username, full_name, email, avatar_path, bio, locale, created_at, updated_at
      FROM profiles
      WHERE id = :id
      LIMIT 1
    `;

    const [rows] = await this.db.query(query, {
      replacements: { id },
      transaction,
    });

    if (!rows || rows.length === 0) {
      return null;
    }

    const [roleRows] = await this.db.query(
      `SELECT r.id, r.name, ur.created_at
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.profile_id = :id`,
      {
        replacements: { id },
        transaction,
      }
    );

    const roles =
      roleRows && roleRows.length > 0
        ? roleRows.map((r) => ({
            id: r.id,
            name: r.name,
            created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
          }))
        : undefined;

    return this.toDomain(rows[0], roles);
  }

  /**
   * Finds a Profile by username (case-insensitive).
   *
   * @param {string} username
   * @param {Object} [options]
   * @param {import('sequelize').Transaction} [options.transaction]
   * @returns {Promise<Profile|null>}
   */
  async findByUsername(username, { transaction } = {}) {
    const query = `
      SELECT id, username, full_name, email, avatar_path, bio, locale, created_at, updated_at
      FROM profiles
      WHERE lower(username) = lower(:username)
      LIMIT 1
    `;

    const [rows] = await this.db.query(query, {
      replacements: { username },
      transaction,
    });

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toDomain(rows[0]);
  }
}
