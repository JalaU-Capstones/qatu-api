export class RegisterRequestDTO {
  /**
   * @param {Object} data
   * @param {string} data.email
   * @param {string} data.password
   * @param {string} data.username
   * @param {string} [data.fullName]
   * @param {string} [data.full_name]
   */
  constructor({ email, password, username, fullName, full_name }) {
    this.email = email;
    this.password = password;
    this.username = username;
    this.fullName = full_name !== undefined ? full_name : fullName;
    this.full_name = this.fullName;
  }
}

export class RegisterResponseDTO {
  /**
   * Constructs the standardized registration response matching OpenAPI contract:
   * { data: { user, profile, roles, token }, meta: { timestamp } }
   *
   * @param {Object} params
   * @param {Object} params.user
   * @param {string} params.user.id
   * @param {string} params.user.email
   * @param {string} [params.user.created_at]
   * @param {Object} [params.profile]
   * @param {Array<Object>} [params.roles]
   * @param {string} [params.token]
   * @param {Object} [params.session]
   * @param {string} [params.timestamp]
   */
  constructor({
    user,
    profile = null,
    roles = null,
    token = null,
    session = null,
    timestamp = null,
  }) {
    const defaultCreatedAt = new Date().toISOString();
    const resolvedUser = {
      id: user.id,
      email: user.email,
      created_at:
        user.created_at || (user.createdAt ? user.createdAt.toISOString() : defaultCreatedAt),
    };

    const resolvedProfile = profile
      ? {
          id: profile.id,
          username: profile.username,
          full_name: profile.full_name !== undefined ? profile.full_name : profile.fullName || null,
          email: profile.email || user.email,
          avatar_path:
            profile.avatar_path !== undefined ? profile.avatar_path : profile.avatarPath || null,
          bio: profile.bio || null,
          locale: profile.locale || 'en',
          created_at:
            profile.created_at ||
            (profile.createdAt ? profile.createdAt.toISOString() : defaultCreatedAt),
          updated_at:
            profile.updated_at ||
            (profile.updatedAt ? profile.updatedAt.toISOString() : defaultCreatedAt),
        }
      : {
          id: user.id,
          username: user.username || user.email.split('@')[0],
          full_name: user.fullName || user.full_name || null,
          email: user.email,
          avatar_path: null,
          bio: null,
          locale: 'en',
          created_at: defaultCreatedAt,
          updated_at: defaultCreatedAt,
        };

    const resolvedRoles =
      Array.isArray(roles) && roles.length > 0
        ? roles
        : [
            {
              id: 1,
              name: 'buyer',
              created_at: defaultCreatedAt,
            },
          ];

    const resolvedToken = token || session?.access_token || '';

    this.data = {
      user: resolvedUser,
      profile: resolvedProfile,
      roles: resolvedRoles,
      token: resolvedToken,
    };

    this.meta = {
      timestamp: timestamp || new Date().toISOString(),
    };
  }

  get user() {
    return this.data.user;
  }

  get profile() {
    return this.data.profile;
  }

  get roles() {
    return this.data.roles;
  }

  get token() {
    return this.data.token;
  }

  get session() {
    return {
      access_token: this.data.token,
      token_type: 'bearer',
    };
  }
}
