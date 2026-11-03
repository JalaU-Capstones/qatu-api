import pino from 'pino';

/** Log identifiers only (event_id, routing_key), never payloads or credentials. */
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
});
