import dotenv from 'dotenv';

dotenv.config();

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Validates and normalizes environment variables for the application.
 */
function createEnvConfig(source = process.env) {
  const nodeEnv = source.NODE_ENV || 'development';
  const port = parseInt(source.PORT || '3000', 10);

  const supabaseUrl = source.SUPABASE_URL || 'http://localhost:54321';
  const supabaseAnonKey = source.SUPABASE_ANON_KEY || 'dummy-supabase-anon-key-for-development';
  const supabaseServiceRoleKey =
    source.SUPABASE_SERVICE_ROLE_KEY ||
    source.SUPABASE_ANON_KEY ||
    'dummy-supabase-service-role-key';

  const frontendUrl = source.FRONTEND_URL || 'http://localhost:5173';
  const allowedOrigins = source.ALLOWED_ORIGINS
    ? source.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : [frontendUrl, 'http://localhost:3000'];

  return {
    NODE_ENV: nodeEnv,
    PORT: Number.isNaN(port) ? 3000 : port,
    DATABASE_URL:
      source.DATABASE_URL || 'postgresql://qatu:qatu_dev_password@localhost:5432/qatu_dev',
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey,
    SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
    RABBITMQ_URL: source.RABBITMQ_URL || 'amqp://qatu:qatu_dev_password@localhost:5672',
    // Off unless enabled, so tests and CI never need a broker.
    // Messaging (ADR-014). Off unless explicitly enabled so tests/CI never need a broker.
    RABBITMQ_ENABLED: source.RABBITMQ_ENABLED === 'true',
    RABBITMQ_VHOST: source.RABBITMQ_VHOST || null,
    RABBITMQ_EXCHANGE: source.RABBITMQ_EXCHANGE || 'qatu.events',
    RABBITMQ_NOTIFICATIONS_QUEUE: source.RABBITMQ_NOTIFICATIONS_QUEUE || 'qatu.notifications',
    RABBITMQ_DLX: source.RABBITMQ_DLX || 'qatu.dlx',
    RABBITMQ_DLQ: source.RABBITMQ_DLQ || 'qatu.notifications.dlq',
    OUTBOX_POLL_INTERVAL_MS: parsePositiveInt(source.OUTBOX_POLL_INTERVAL_MS, 2000),
    OUTBOX_MAX_ATTEMPTS: parsePositiveInt(source.OUTBOX_MAX_ATTEMPTS, 3),
    JWT_SECRET: source.JWT_SECRET || 'default-jwt-secret-for-dev',
    FRONTEND_URL: frontendUrl,
    ALLOWED_ORIGINS: allowedOrigins,
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
    isDevelopment: nodeEnv === 'development',
  };
}

export const env = createEnvConfig();
export { createEnvConfig };
