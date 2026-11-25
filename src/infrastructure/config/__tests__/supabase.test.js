import { describe, expect, it, vi } from 'vitest';
import { createSupabaseClient, createUserScopedSupabaseClient } from '../supabase.js';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ id: 'client' })),
  env: {
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    SUPABASE_ANON_KEY: 'anon-key',
  },
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('../env.js', () => ({ env: mocks.env }));

describe('supabase client factory', () => {
  it('creates a server client with non-persistent auth by default', () => {
    mocks.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    expect(createSupabaseClient()).toBe(mocks.createClient.mock.results.at(-1).value);
    expect(mocks.createClient).toHaveBeenLastCalledWith(
      mocks.env.SUPABASE_URL,
      'service-role-key',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  });

  it('falls back to the anon key when the service role key is missing', () => {
    mocks.env.SUPABASE_SERVICE_ROLE_KEY = '';
    expect(createSupabaseClient()).toBeDefined();
    expect(mocks.createClient.mock.calls.at(-1)[1]).toBe('anon-key');
    mocks.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('supports explicit options and validates url and key', () => {
    const options = { auth: { persistSession: true } };
    createSupabaseClient('https://other.supabase.co', 'other-key', options);
    expect(mocks.createClient).toHaveBeenLastCalledWith(
      'https://other.supabase.co',
      'other-key',
      options
    );

    expect(() => createSupabaseClient('', 'key')).toThrow('SUPABASE_URL is required');
    expect(() => createSupabaseClient('https://url', '')).toThrow(
      'SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required'
    );
  });

  it('creates a user-scoped client forwarding the access token', () => {
    expect(() => createUserScopedSupabaseClient()).toThrow('accessToken is required');

    createUserScopedSupabaseClient('jwt-token');
    expect(mocks.createClient).toHaveBeenLastCalledWith(
      mocks.env.SUPABASE_URL,
      mocks.env.SUPABASE_ANON_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: 'Bearer jwt-token' } },
      }
    );
  });
});
