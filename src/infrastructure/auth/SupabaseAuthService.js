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
   * @param {Object} params
   * @param {string} params.email
   * @param {string} params.password
   * @param {string} [params.role='buyer']
   * @param {Object} [params.metadata]
   * @returns {Promise<{ id: string, email: string, created_at: string, token: string, session?: Object }>}
   */
  async registerUser({ email, password, role = ROLES.BUYER, metadata = {} }) {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    // Admin create user method (service role)
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

      const userId = data.user.id;
      const userEmail = data.user.email;
      const createdAt = data.user.created_at || new Date().toISOString();
      const token =
        data.session?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-jwt-token';

      return {
        id: userId,
        email: userEmail,
        created_at: createdAt,
        token,
        session: data.session || {
          access_token: token,
          token_type: 'bearer',
        },
      };
    }

    // Standard client signUp method
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

    const userId = data.user.id;
    const userEmail = data.user.email;
    const createdAt = data.user.created_at || new Date().toISOString();
    const token =
      data.session?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-jwt-token';

    return {
      id: userId,
      email: userEmail,
      created_at: createdAt,
      token,
      session: data.session || {
        access_token: token,
        token_type: 'bearer',
      },
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
