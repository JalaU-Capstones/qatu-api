export class GetProfileByIdRequestDTO {
  /**
   * @param {Object|string} params
   * @param {string} [params.id]
   * @param {string} [params.profileId]
   */
  constructor(params = {}) {
    if (typeof params === 'string') {
      this.profileId = params.trim();
      return;
    }
    const rawId = params?.profileId ?? params?.id ?? '';
    this.profileId = typeof rawId === 'string' ? rawId.trim() : '';
  }
}

export class UpdateProfileRequestDTO {
  /**
   * @param {Object} params
   * @param {string} params.userId
   * @param {Object} [params.updates]
   * @param {string} [params.full_name]
   * @param {string} [params.fullName]
   * @param {string|null} [params.bio]
   * @param {string|null} [params.avatar_path]
   * @param {string|null} [params.avatarPath]
   * @param {string} [params.locale]
   */
  constructor(params = {}) {
    this.userId = typeof params.userId === 'string' ? params.userId.trim() : '';

    const source = params.updates && typeof params.updates === 'object' ? params.updates : params;

    this.updates = {};

    if (source.full_name !== undefined || source.fullName !== undefined) {
      const rawFullName = source.full_name !== undefined ? source.full_name : source.fullName;
      this.updates.full_name = typeof rawFullName === 'string' ? rawFullName.trim() : rawFullName;
    }

    if (source.bio !== undefined) {
      this.updates.bio =
        typeof source.bio === 'string'
          ? source.bio.trim() === ''
            ? null
            : source.bio.trim()
          : source.bio;
    }

    if (source.avatar_path !== undefined || source.avatarPath !== undefined) {
      const rawAvatar = source.avatar_path !== undefined ? source.avatar_path : source.avatarPath;
      this.updates.avatar_path =
        typeof rawAvatar === 'string'
          ? rawAvatar.trim() === ''
            ? null
            : rawAvatar.trim()
          : rawAvatar;
    }

    if (source.locale !== undefined) {
      this.updates.locale =
        typeof source.locale === 'string' ? source.locale.trim() : source.locale;
    }
  }
}

export class ProfileResponseDTO {
  /**
   * @param {import('../../domain/entities/Profile.js').Profile|Object} profile
   * @param {string} [timestamp]
   */
  constructor(profile = {}, timestamp = new Date().toISOString()) {
    const raw = typeof profile?.toJSON === 'function' ? profile.toJSON() : profile;
    this.id = raw.id;
    this.username = raw.username;
    this.full_name = raw.full_name ?? raw.fullName ?? null;
    this.email = raw.email ?? null;
    this.avatar_path = raw.avatar_path ?? raw.avatarPath ?? null;
    this.bio = raw.bio ?? null;
    this.locale = raw.locale || 'en';
    this.created_at = raw.created_at
      ? new Date(raw.created_at).toISOString()
      : raw.createdAt
        ? new Date(raw.createdAt).toISOString()
        : new Date().toISOString();
    this.updated_at = raw.updated_at
      ? new Date(raw.updated_at).toISOString()
      : raw.updatedAt
        ? new Date(raw.updatedAt).toISOString()
        : new Date().toISOString();
    this.timestamp = timestamp;
  }

  toJSON() {
    return {
      data: {
        id: this.id,
        username: this.username,
        full_name: this.full_name,
        email: this.email,
        avatar_path: this.avatar_path,
        bio: this.bio,
        locale: this.locale,
        created_at: this.created_at,
        updated_at: this.updated_at,
      },
      meta: {
        timestamp: this.timestamp,
      },
    };
  }
}
