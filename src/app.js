import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { registerApiDocs } from './presentation/docs/swagger.js';
import { corsMiddleware } from './presentation/middleware/corsMiddleware.js';
import { errorHandler } from './presentation/middleware/errorHandler.js';
import { authRouter } from './presentation/routes/authRoutes.js';

export function createApp({ authRoutes = authRouter } = {}) {
  const app = express();

  // Security Headers
  app.use(helmet());

  // Dedicated CORS Middleware
  app.use(corsMiddleware);

  // Payload Limit & JSON Body Parser
  app.use(express.json({ limit: '10kb' }));

  // Interactive Swagger UI API Documentation
  registerApiDocs(app);

  // Rate Limiting on Authentication Endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per window
    message: {
      error: {
        code: 'TOO_MANY_REQUESTS',
        message:
          'Too many registration/auth requests from this IP. Please try again after 15 minutes.',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Health Endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // API Routes (mounted on /v1/auth and /auth for compatibility)
  app.use('/v1/auth', authLimiter, authRoutes);
  app.use('/auth', authLimiter, authRoutes);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
