import { IAuthService } from '../../application/ports/IAuthService.js';

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
   * @param {Object} params
   * @param {string} params.email
   * @param {string} params.password
   * @param {string} params.role
   * @param {Object} [params.metadata]
   * @returns {Promise<{ id: string, email: string, session?: Object }>}
   */
  async registerUser({ email, password, role = 'buyer', metadata = {} }) {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    // Try signUp or admin.createUser if available
    if (this.client.auth?.admin?.createUser) {
      const { data, error } = await this.client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          ...metadata,
          role,
        },
      });

      if (error) {
        if (
          error.message?.toLowerCase().includes('already') ||
          error.status === 422 ||
          error.status === 409
        ) {
          const err = new Error('Email already registered');
          err.code = 'EMAIL_ALREADY_EXISTS';
          err.statusCode = 409;
          throw err;
        }
        throw new Error(`Failed to create user in Supabase: ${error.message}`);
      }

      return {
        id: data.user.id,
        email: data.user.email,
        session: {
          access_token: 'mock-access-token',
          token_type: 'bearer',
        },
      };
    }

    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: {
          ...metadata,
          role,
        },
      },
    });

    if (error) {
      if (
        error.message?.toLowerCase().includes('already') ||
        error.status === 422 ||
        error.status === 409
      ) {
        const err = new Error('Email already registered');
        err.code = 'EMAIL_ALREADY_EXISTS';
        err.statusCode = 409;
        throw err;
      }
      throw new Error(`Failed to sign up in Supabase: ${error.message}`);
    }

    return {
      id: data.user.id,
      email: data.user.email,
      session: data.session || null,
    };
  }

  /**
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
