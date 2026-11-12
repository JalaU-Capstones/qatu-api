import cors from 'cors';
import { env } from '../../infrastructure/config/env.js';

/**
 * Creates CORS middleware configured with explicit allowed origins.
 *
 * `allowedHeaders` includes every custom header the browser may send during
 * a cross-origin request. This MUST stay in sync with the headers the
 * frontend sends:
 *  - `Content-Type`    — for JSON bodies
 *  - `Authorization`   — Bearer fallback during the Sprint 4 migration window
 *  - `X-CSRF-Token`    — double-submit CSRF defense (see ADR-012)
 *  - `Accept`          — standard; some fetch implementations send it in the
 *                        preflight `Access-Control-Request-Headers`
 *
 * If a future header is added to the frontend, it MUST also be added here,
 * or the browser preflight will silently reject the request. This is a class
 * of bug that is invisible to curl/Postman/supertest (they skip preflight)
 * but breaks the browser immediately.
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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Accept'],
    // Expose the CSRF cookie metadata if the frontend ever needs it
    // (today it reads document.cookie directly — no exposedHeaders needed).
  });
}

export const corsMiddleware = createCorsMiddleware();
