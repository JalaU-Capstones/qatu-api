import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { env } from './infrastructure/config/env.js';
import { registerApiDocs } from './presentation/docs/swagger.js';
import { corsMiddleware } from './presentation/middleware/corsMiddleware.js';
import { csrfMiddleware } from './presentation/middleware/csrfMiddleware.js';
import { errorHandler } from './presentation/middleware/errorHandler.js';
import {
  createAuthenticatedLimiter,
  createAuthLimiter,
  createPublicLimiter,
} from './presentation/middleware/rateLimiter.js';
import { adminCategoryRouter } from './presentation/routes/adminCategoryRoutes.js';
import { adminReportRouter } from './presentation/routes/adminReportRoutes.js';
import { adminSellerApplicationRouter } from './presentation/routes/adminSellerApplicationRoutes.js';
import { authRouter } from './presentation/routes/authRoutes.js';
import { cartRouter } from './presentation/routes/cartRoutes.js';
import { categoryRouter } from './presentation/routes/categoryRoutes.js';
import { conversationRouter } from './presentation/routes/conversationRoutes.js';
import { notificationRouter } from './presentation/routes/notificationRoutes.js';
import { orderRouter } from './presentation/routes/orderRoutes.js';
import { productRouter } from './presentation/routes/productRoutes.js';
import { profileRouter } from './presentation/routes/profileRoutes.js';
import { sellerApplicationRouter } from './presentation/routes/sellerApplicationRoutes.js';
import { sellerProductsRouter } from './presentation/routes/sellerProductsRoutes.js';

export function createApp({
  authRoutes = authRouter,
  productRoutes = productRouter,
  sellerProductRoutes = sellerProductsRouter,
  sellerApplicationRoutes = sellerApplicationRouter,
  adminReportRoutes = adminReportRouter,
  adminSellerApplicationRoutes = adminSellerApplicationRouter,
  categoryRoutes = categoryRouter,
  cartRoutes = cartRouter,
  orderRoutes = orderRouter,
  profileRoutes = profileRouter,
  adminCategoryRoutes = adminCategoryRouter,
  conversationRoutes = conversationRouter,
  notificationRoutes = notificationRouter,
} = {}) {
  const app = express();

  if (env.TRUST_PROXY !== false) {
    app.set('trust proxy', env.TRUST_PROXY);
  }

  // Security Headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.)
  app.use(helmet());

  // Dedicated CORS Middleware
  app.use(corsMiddleware);

  // Payload Limit & JSON Body Parser
  app.use(express.json({ limit: '10kb' }));

  // Cookie Parser
  app.use(cookieParser());

  // Interactive Swagger UI API Documentation
  registerApiDocs(app);

  // Rate Limiters (10 req/min auth, 100 req/min public, 1000 req/min authenticated)
  const authLimiter = createAuthLimiter();
  const publicLimiter = createPublicLimiter();
  const authenticatedLimiter = createAuthenticatedLimiter();

  const authTierLimiter = (req, res, next) => {
    if (req.path === '/me' || req.path === '/password') {
      return authenticatedLimiter(req, res, next);
    }
    return authLimiter(req, res, next);
  };

  const productTierLimiter = (req, res, next) => {
    if (req.method === 'GET') {
      return publicLimiter(req, res, next);
    }
    return authenticatedLimiter(req, res, next);
  };

  const profileTierLimiter = (req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/me')) {
      return publicLimiter(req, res, next);
    }
    return authenticatedLimiter(req, res, next);
  };

  // Health Endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // CSRF Protection (verifies X-CSRF-Token on mutating requests that authenticate via cookies)
  app.use(csrfMiddleware);

  // API Routes
  app.use('/v1/auth', authTierLimiter, authRoutes);
  app.use('/v1/products', productTierLimiter, productRoutes);
  app.use('/v1/seller', authenticatedLimiter, sellerProductRoutes);
  app.use('/v1/categories', publicLimiter, categoryRoutes);
  app.use('/v1/cart', authenticatedLimiter, cartRoutes);
  app.use('/v1/orders', authenticatedLimiter, orderRoutes);
  app.use('/v1/profiles', profileTierLimiter, profileRoutes);
  app.use('/v1/seller-applications', authenticatedLimiter, sellerApplicationRoutes);
  app.use('/v1/admin/reports', authenticatedLimiter, adminReportRoutes);
  app.use('/v1/admin/seller-applications', authenticatedLimiter, adminSellerApplicationRoutes);
  app.use('/v1/admin/categories', authenticatedLimiter, adminCategoryRoutes);
  app.use('/v1/conversations', authenticatedLimiter, conversationRoutes);
  app.use('/v1/notifications', authenticatedLimiter, notificationRoutes);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
