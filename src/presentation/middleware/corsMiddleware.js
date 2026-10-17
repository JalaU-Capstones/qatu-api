import cors from 'cors';
import { env } from '../../infrastructure/config/env.js';

/**
 * Creates CORS middleware configured with explicit allowed origins.
 *
 * @param {Object} [options]
 * @param {string[]} [options.allowedOrigins]
 * @returns {import('express').RequestHandler}
 */
export function createCorsMiddleware({ allowedOrigins = env.ALLOWED_ORIGINS } = {}) {
  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}

export const corsMiddleware = createCorsMiddleware();
