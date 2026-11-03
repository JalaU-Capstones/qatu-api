import { describe, it, expect } from 'vitest';
import { createEnvConfig, env } from '../env.js';
import { createSupabaseClient } from '../supabase.js';

describe('Environment & Supabase Configuration', () => {
  it('should export a valid env object with defaults', () => {
    expect(env).toBeDefined();
    expect(env.PORT).toBeDefined();
    expect(Array.isArray(env.ALLOWED_ORIGINS)).toBe(true);
  });

  it('should parse custom environment variables accurately', () => {
    const customConfig = createEnvConfig({
      NODE_ENV: 'production',
      PORT: '8080',
      DATABASE_URL: 'postgresql://user:pass@remote:5432/db',
      SUPABASE_URL: 'https://custom.supabase.co',
      SUPABASE_ANON_KEY: 'custom-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'custom-service-key',
      ALLOWED_ORIGINS: 'https://qatu.example.com, https://admin.qatu.example.com',
    });

    expect(customConfig.isProduction).toBe(true);
    expect(customConfig.PORT).toBe(8080);
    expect(customConfig.DATABASE_URL).toBe('postgresql://user:pass@remote:5432/db');
    expect(customConfig.SUPABASE_URL).toBe('https://custom.supabase.co');
    expect(customConfig.SUPABASE_SERVICE_ROLE_KEY).toBe('custom-service-key');
    expect(customConfig.ALLOWED_ORIGINS).toEqual([
      'https://qatu.example.com',
      'https://admin.qatu.example.com',
    ]);
  });

  it('should fallback to default PORT if invalid number provided', () => {
    const config = createEnvConfig({ PORT: 'not-a-number' });
    expect(config.PORT).toBe(3000);
  });

  it('should throw an error in createSupabaseClient if URL is missing', () => {
    expect(() => createSupabaseClient('', 'some-key')).toThrow('SUPABASE_URL is required');
  });

  it('should throw an error in createSupabaseClient if key is missing', () => {
    expect(() => createSupabaseClient('https://example.supabase.co', '')).toThrow(
      'SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required'
    );
  });

  it('should return a supabase client when valid credentials are provided', () => {
    const client = createSupabaseClient('https://example.supabase.co', 'valid-anon-key');
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });
  describe('messaging configuration (ADR-014)', () => {
    it('keeps messaging OFF by default so tests and CI never need a broker', () => {
      const config = createEnvConfig({});

      expect(config.RABBITMQ_ENABLED).toBe(false);
      expect(config.RABBITMQ_VHOST).toBeNull();
      expect(config.RABBITMQ_EXCHANGE).toBe('qatu.events');
      expect(config.RABBITMQ_NOTIFICATIONS_QUEUE).toBe('qatu.notifications');
      expect(config.RABBITMQ_DLX).toBe('qatu.dlx');
      expect(config.RABBITMQ_DLQ).toBe('qatu.notifications.dlq');
      expect(config.OUTBOX_POLL_INTERVAL_MS).toBe(2000);
      expect(config.OUTBOX_MAX_ATTEMPTS).toBe(3);
    });

    it('only enables messaging for the exact string "true"', () => {
      expect(createEnvConfig({ RABBITMQ_ENABLED: 'true' }).RABBITMQ_ENABLED).toBe(true);
      expect(createEnvConfig({ RABBITMQ_ENABLED: '1' }).RABBITMQ_ENABLED).toBe(false);
      expect(createEnvConfig({ RABBITMQ_ENABLED: 'false' }).RABBITMQ_ENABLED).toBe(false);
    });

    it('reads custom values and falls back on invalid numbers', () => {
      const config = createEnvConfig({
        RABBITMQ_VHOST: 'qatu-prod',
        OUTBOX_POLL_INTERVAL_MS: '5000',
        OUTBOX_MAX_ATTEMPTS: 'abc',
      });

      expect(config.RABBITMQ_VHOST).toBe('qatu-prod');
      expect(config.OUTBOX_POLL_INTERVAL_MS).toBe(5000);
      expect(config.OUTBOX_MAX_ATTEMPTS).toBe(3);
    });
  });
});
