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
   * @param {string} [params.userId]
   * @param {string} [params.targetUserId]
   * @param {string} [params.requestingUserId]
   * @param {Object} [params.updates]
   * @param {string} [params.full_name]
   * @param {string} [params.fullName]
   * @param {string|null} [params.bio]
   * @param {string|null} [params.avatar_path]
   * @param {string|null} [params.avatarPath]
   * @param {string} [params.locale]
   */
  constructor(params = {}) {
    const rawTargetId = params.targetUserId !== undefined ? params.targetUserId : params.userId;
    this.userId = typeof rawTargetId === 'string' ? rawTargetId.trim() : '';
    this.targetUserId = this.userId;

    const rawRequestingId =
      params.requestingUserId !== undefined ? params.requestingUserId : params.userId;
    this.requestingUserId = typeof rawRequestingId === 'string' ? rawRequestingId.trim() : '';

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

export class UploadAvatarRequestDTO {
  /**
   * @param {Object} params
   * @param {string} [params.userId]
   * @param {string} [params.targetUserId]
   * @param {string} [params.requestingUserId]
   * @param {Object} [params.file]
   * @param {Buffer} [params.buffer]
   * @param {string} [params.mimeType]
   * @param {string} [params.originalName]
   * @param {number} [params.size]
   */
  constructor(params = {}) {
    const rawTargetId = params.targetUserId !== undefined ? params.targetUserId : params.userId;
    this.userId = typeof rawTargetId === 'string' ? rawTargetId.trim() : '';
    this.targetUserId = this.userId;

    const rawRequestingId =
      params.requestingUserId !== undefined ? params.requestingUserId : params.userId;
    this.requestingUserId = typeof rawRequestingId === 'string' ? rawRequestingId.trim() : '';

    const fileSource = params.file && typeof params.file === 'object' ? params.file : params;
    this.buffer = Buffer.isBuffer(fileSource.buffer) ? fileSource.buffer : null;
    this.mimeType =
      typeof fileSource.mimeType === 'string'
        ? fileSource.mimeType.trim().toLowerCase()
        : typeof fileSource.mimetype === 'string'
          ? fileSource.mimetype.trim().toLowerCase()
          : '';
    this.originalName =
      typeof fileSource.originalName === 'string'
        ? fileSource.originalName.trim()
        : typeof fileSource.originalname === 'string'
          ? fileSource.originalname.trim()
          : '';
    this.size =
      typeof fileSource.size === 'number' ? fileSource.size : this.buffer ? this.buffer.length : 0;
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
