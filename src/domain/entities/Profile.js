import { ROLES } from '../constants/roles.js';

export class Profile {
  /**
   * @param {Object} params
   * @param {string} params.id
   * @param {string|import('../value-objects/Username.js').Username} params.username
   * @param {string|import('../value-objects/FullName.js').FullName} [params.fullName]
   * @param {string} [params.full_name]
   * @param {string|null} [params.email]
   * @param {string|null} [params.avatarPath]
   * @param {string|null} [params.avatar_path]
   * @param {string|null} [params.bio]
   * @param {string} [params.locale='en']
   * @param {string} [params.role='buyer']
   * @param {Array<Object>} [params.roles]
   * @param {Date|string} [params.createdAt]
   * @param {Date|string} [params.updatedAt]
   * @param {Date|string} [params.created_at]
   * @param {Date|string} [params.updated_at]
   */
  constructor({
    id,
    username,
    fullName,
    full_name,
    email = null,
    avatarPath,
    avatar_path,
    bio = null,
    locale = 'en',
    role = ROLES.BUYER,
    roles = null,
    createdAt,
    updatedAt,
    created_at,
    updated_at,
  }) {
    if (!id) {
      throw new Error('Profile id is required');
    }
    if (!username) {
      throw new Error('Profile username is required');
    }

    const rawFullName = fullName !== undefined ? fullName : full_name;
    if (!rawFullName) {
      throw new Error('Profile full name is required');
    }

    const rawAvatar =
      avatarPath !== undefined && avatarPath !== null
        ? avatarPath
        : avatar_path !== undefined
          ? avatar_path
          : null;

    this.id = id;
    this.username = typeof username === 'string' ? username : username.getValue();
    this.fullName = typeof rawFullName === 'string' ? rawFullName : rawFullName.getValue();
    this.full_name = this.fullName;
    this.email = email;
    this.avatarPath = rawAvatar;
    this.avatar_path = rawAvatar;
    this.bio = bio;
    this.locale = locale || 'en';
    this.role = role;

    let roleId = 1;
    if (role === ROLES.SELLER) roleId = 2;
    else if (role === ROLES.ADMIN) roleId = 3;

    const defaultRoleEntry = {
      id: roleId,
      name: role,
      created_at: new Date().toISOString(),
    };
    this.roles = Array.isArray(roles) && roles.length > 0 ? roles : [defaultRoleEntry];

    const rawCreated = createdAt || created_at;
    const rawUpdated = updatedAt || updated_at;
    this.createdAt = rawCreated ? new Date(rawCreated) : new Date();
    this.updatedAt = rawUpdated ? new Date(rawUpdated) : new Date();
  }

  isBuyer() {
    return this.role === ROLES.BUYER || this.roles.some((r) => r.name === ROLES.BUYER);
  }

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      full_name: this.fullName,
      email: this.email,
      avatar_path: this.avatarPath,
      bio: this.bio,
      locale: this.locale,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    };
  }
}
