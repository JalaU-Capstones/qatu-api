import { IAuthService } from '../../application/ports/IAuthService.js';
import { ROLES } from '../../domain/constants/roles.js';

export class SupabaseAuthService extends IAuthService {
  /**
   * @param {Object} [options]
   * @param {import('@supabase/supabase-js').SupabaseClient} [options.client]
   */
  constructor({ client } = {}) {
    super();
    this.client = client;
  }

  /**
   * Registers a user in Supabase Auth and acquires a real JWT session via signInWithPassword.
   *
   * @param {Object} params
   * @param {string} params.email
   * @param {string} params.password
   * @param {string} [params.role='buyer']
   * @param {Object} [params.metadata]
   * @returns {Promise<{ id: string, email: string, created_at: string, token: string, refresh_token?: string, session?: Object }>}
   */
  async registerUser({ email, password, role = ROLES.BUYER, metadata = {} }) {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    let userId;
    let userEmail;
    let createdAt;

    // Admin create user method (service role)
    if (this.client.auth?.admin?.createUser) {
      const { data: created, error: createError } = await this.client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          ...metadata,
          role,
        },
      });

      if (createError) {
        if (
          createError.message?.toLowerCase().includes('already') ||
          createError.status === 422 ||
          createError.status === 409
        ) {
          const err = new Error('Email already registered');
          err.code = 'EMAIL_ALREADY_EXISTS';
          err.statusCode = 409;
          throw err;
        }
        throw new Error(`Failed to create user in Supabase: ${createError.message}`);
      }

      userId = created.user.id;
      userEmail = created.user.email;
      createdAt = created.user.created_at || new Date().toISOString();
    } else {
      // Standard client fallback
      const { data: created, error: createError } = await this.client.auth.signUp({
        email,
        password,
        options: {
          data: {
            ...metadata,
            role,
          },
        },
      });

      if (createError) {
        if (
          createError.message?.toLowerCase().includes('already') ||
          createError.status === 422 ||
          createError.status === 409
        ) {
          const err = new Error('Email already registered');
          err.code = 'EMAIL_ALREADY_EXISTS';
          err.statusCode = 409;
          throw err;
        }
        throw new Error(`Failed to sign up in Supabase: ${createError.message}`);
      }

      userId = created.user.id;
      userEmail = created.user.email;
      createdAt = created.user.created_at || new Date().toISOString();
    }

    // Immediately authenticate with credentials to obtain a real Supabase session
    const { data: signed, error: signInError } = await this.client.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signed?.session?.access_token) {
      throw new Error(
        `Failed to sign in newly created user: ${signInError?.message || 'No session returned'}`
      );
    }

    return {
      id: userId,
      email: userEmail,
      created_at: createdAt,
      token: signed.session.access_token,
      refresh_token: signed.session.refresh_token,
      session: signed.session,
    };
  }

  /**
   * Authenticates user credentials via Supabase Auth signInWithPassword.
   * Never leaks internal Supabase error details or service keys to clients.
   *
   * @param {Object} params
   * @param {string} params.email
   * @param {string} params.password
   * @returns {Promise<{ id: string, email: string, created_at: string, token: string, refresh_token: string, user_metadata: Object }>}
   */
  async loginUser({ email, password }) {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await this.client.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data?.session?.access_token || !data?.user) {
      const rawMessage = error?.message?.toLowerCase() || '';
      if (rawMessage.includes('email not confirmed') || rawMessage.includes('not confirmed')) {
        const unconfirmedErr = new Error('Please confirm your email before logging in');
        unconfirmedErr.code = 'EMAIL_NOT_CONFIRMED';
        unconfirmedErr.statusCode = 401;
        throw unconfirmedErr;
      }

      const authErr = new Error('Authentication failed');
      authErr.code = 'UNAUTHORIZED';
      authErr.statusCode = 401;
      throw authErr;
    }

    return {
      id: data.user.id,
      email: data.user.email || normalizedEmail,
      created_at: data.user.created_at || new Date().toISOString(),
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user_metadata: data.user.user_metadata || {},
    };
  }

  /**
   * Exchanges a refresh token for a new session (rotated access_token +
   * rotated refresh_token, per Supabase defaults). Used by the
   * `POST /v1/auth/refresh` endpoint.
   *
   * Supabase rotates the refresh token on each call — the caller MUST
   * update the `refresh_token` cookie with the new value or the next
   * refresh will fail.
   *
   * @param {string} refreshToken
   * @returns {Promise<{
   *   accessToken: string,
   *   refreshToken: string,
   *   userId: string,
   *   expiresAt: number,
   *   session: Object,
   * }>}
   * @throws {Error & { code: string, statusCode: number }}
   */
  async refreshSession(refreshToken) {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    if (!refreshToken || typeof refreshToken !== 'string') {
      const err = new Error('Refresh token is required');
      err.code = 'INVALID_REQUEST';
      err.statusCode = 400;
      throw err;
    }

    const { data, error } = await this.client.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data?.session?.access_token || !data?.session?.refresh_token) {
      const err = new Error('Refresh failed');
      err.code = 'UNAUTHORIZED';
      err.statusCode = 401;
      throw err;
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      userId: data.session.user?.id ?? null,
      expiresAt: data.session.expires_at ?? null,
      session: data.session,
    };
  }

  /**
   * Revokes the current session on Supabase. Per ADR-012 / decision A3:
   *
   *  1. Try `admin.signOut(accessToken)` — revokes the current session
   *     (default scope 'local').
   *  2. If that fails (e.g. the access token is expired), attempt
   *     `refreshSession(refreshToken)` to obtain a fresh JWT, then
   *     `admin.signOut(freshToken)`.
   *  3. If BOTH attempts fail, return `{ success: false, reason: 'revocation_failed' }`.
   *
   * The caller (`LogoutUseCase` in API-35-08) MUST clear the session cookies
   * regardless of the result. This method never throws for revocation
   * failures — it returns a result object so the caller can decide. It only
   * throws when the Supabase client is not initialized (programming error).
   *
   * @param {Object} params
   * @param {string} [params.accessToken]
   * @param {string} [params.refreshToken]
   * @returns {Promise<{ success: boolean, reason?: string }>}
   */
  async logoutUser({ accessToken, refreshToken }) {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    // Attempt 1: direct signOut with the current access token.
    if (accessToken) {
      try {
        const { error } = await this.client.auth.admin.signOut(accessToken);
        if (!error) return { success: true };
      } catch {
        // fall through to attempt 2
      }
    }

    // Attempt 2: refresh first, then signOut with the fresh token.
    if (refreshToken) {
      try {
        const { data: refreshed, error: refreshError } = await this.client.auth.refreshSession({
          refresh_token: refreshToken,
        });

        if (!refreshError && refreshed?.session?.access_token) {
          const { error: signOutError } = await this.client.auth.admin.signOut(
            refreshed.session.access_token
          );
          if (!signOutError) return { success: true };
        }
      } catch {
        // fall through
      }
    }

    // Both attempts failed. Return non-throwing failure so caller clears cookies.
    return { success: false, reason: 'revocation_failed' };
  }

  /**
   * Checks if an email is already registered in Supabase Auth.
   *
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  async emailExists(email) {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    if (this.client.auth?.admin?.listUsers) {
      const { data, error } = await this.client.auth.admin.listUsers();
      if (!error && data?.users) {
        return data.users.some((u) => u.email?.toLowerCase() === email.toLowerCase());
      }
    }

    return false;
  }
}
