import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { registerApiDocs } from './presentation/docs/swagger.js';
import { corsMiddleware } from './presentation/middleware/corsMiddleware.js';
import { errorHandler } from './presentation/middleware/errorHandler.js';
import { authRouter } from './presentation/routes/authRoutes.js';
import { cartRouter } from './presentation/routes/cartRoutes.js';
import { categoryRouter } from './presentation/routes/categoryRoutes.js';
import { productRouter } from './presentation/routes/productRoutes.js';

export function createApp({
  authRoutes = authRouter,
  productRoutes = productRouter,
  categoryRoutes = categoryRouter,
  cartRoutes = cartRouter,
} = {}) {
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

  // Rate Limiting on Public Endpoints
  const publicLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // Limit each IP to 100 requests per window
    message: {
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests from this IP. Please try again after 1 minute.',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Rate Limiting on authenticated cart endpoints
  const cartLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // Limit each IP to 60 requests per window
    message: {
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many cart requests from this IP. Please try again after 1 minute.',
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

  // API Routes
  app.use('/v1/auth', authLimiter, authRoutes);
  app.use('/v1/products', publicLimiter, productRoutes);
  app.use('/v1/categories', publicLimiter, categoryRoutes);
  app.use('/v1/cart', cartLimiter, cartRoutes);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
