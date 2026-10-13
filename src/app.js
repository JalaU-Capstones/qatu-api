import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { errorHandler } from './presentation/middleware/errorHandler.js';
import { authRouter } from './presentation/routes/authRoutes.js';

dotenv.config();

export function createApp({ authRoutes = authRouter } = {}) {
  const app = express();

  // Security Headers
  app.use(helmet());

  // CORS Configuration
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:3000',
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Payload Limit & JSON Body Parser
  app.use(express.json({ limit: '10kb' }));

  // Rate Limiting on Authentication Endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per window
    message: {
      error: 'Too Many Requests',
      message:
        'Too many registration/auth requests from this IP. Please try again after 15 minutes.',
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

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
