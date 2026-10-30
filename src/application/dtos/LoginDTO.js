export class LoginRequestDTO {
  /**
   * @param {Object} payload
   * @param {string} payload.email
   * @param {string} payload.password
   */
  constructor({ email, password } = {}) {
    this.email = typeof email === 'string' ? email.trim().toLowerCase() : email;
    this.password = password;
  }
}

export class LoginResponseDTO {
  /**
   * @param {Object} params
   * @param {Object} params.user
   * @param {Object} params.profile
   * @param {Array<Object>} params.roles
   * @param {string} [params.timestamp]
   */
  constructor({ user, profile, roles, timestamp }) {
    this.user = {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    };
    this.profile = {
      id: profile.id,
      username: profile.username,
      full_name: profile.full_name,
      email: profile.email,
      avatar_path: profile.avatar_path ?? null,
      bio: profile.bio ?? null,
      locale: profile.locale || 'en',
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };
    this.roles = roles.map((r) => ({
      id: r.id,
      name: r.name,
      created_at: r.created_at,
    }));
    this.timestamp = timestamp || new Date().toISOString();

    this.data = {
      user: this.user,
      profile: this.profile,
      roles: this.roles,
    };
    this.meta = {
      timestamp: this.timestamp,
    };
  }

  toJSON() {
    return {
      data: {
        user: this.user,
        profile: this.profile,
        roles: this.roles,
      },
      meta: { timestamp: this.timestamp },
    };
  }
}
