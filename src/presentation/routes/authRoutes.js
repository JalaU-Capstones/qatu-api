import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { GetCurrentUserUseCase } from '../../application/use-cases/GetCurrentUserUseCase.js';
import { LoginUseCase } from '../../application/use-cases/LoginUseCase.js';
import { LogoutUseCase } from '../../application/use-cases/LogoutUseCase.js';
import { RefreshSessionUseCase } from '../../application/use-cases/RefreshSessionUseCase.js';
import { RegisterBuyerUseCase } from '../../application/use-cases/RegisterBuyerUseCase.js';
import { SupabaseAuthService } from '../../infrastructure/auth/SupabaseAuthService.js';
import { supabase } from '../../infrastructure/config/supabase.js';
import { ProfileRepository } from '../../infrastructure/persistence/repositories/ProfileRepository.js';
import { AuthController } from '../controllers/AuthController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { loginSchema } from '../validators/LoginSchema.js';
import { registerSchema } from '../validators/registerSchema.js';

export function createAuthRouter({
  authService = new SupabaseAuthService({ client: supabase }),
  profileRepository = new ProfileRepository(),
  registerBuyerUseCase,
  loginUseCase,
  getCurrentUserUseCase,
  refreshSessionUseCase,
  logoutUseCase,
  authController,
} = {}) {
  const router = Router();

  const registerUC =
    registerBuyerUseCase ||
    new RegisterBuyerUseCase({
      authService,
      profileRepository,
    });

  const loginUC =
    loginUseCase ||
    new LoginUseCase({
      authService,
      profileRepository,
    });

  const getCurrentUserUC =
    getCurrentUserUseCase ||
    new GetCurrentUserUseCase({
      profileRepository,
    });

  const refreshSessionUC =
    refreshSessionUseCase ||
    new RefreshSessionUseCase({
      authService,
      profileRepository,
    });

  const logoutUC =
    logoutUseCase ||
    new LogoutUseCase({
      authService,
    });

  const controller =
    authController ||
    new AuthController({
      registerBuyerUseCase: registerUC,
      loginUseCase: loginUC,
      getCurrentUserUseCase: getCurrentUserUC,
      refreshSessionUseCase: refreshSessionUC,
      logoutUseCase: logoutUC,
    });

  // Rate limiter specifically for token refresh (100 req/min/IP per ADR-012)
  const refreshLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 req/min/IP
    message: {
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many refresh requests from this IP. Please try again after 1 minute.',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.post('/register', validateRequest(registerSchema), (req, res, next) =>
    controller.register(req, res, next)
  );

  router.post(
    '/login',
    express.json({ limit: '1kb' }),
    validateRequest(loginSchema),
    (req, res, next) => controller.login(req, res, next)
  );

  // POST /v1/auth/refresh — rotación de sesión (no authMiddleware, usa refreshLimiter)
  router.post('/refresh', refreshLimiter, (req, res, next) => controller.refresh(req, res, next));

  // POST /v1/auth/logout — revocación de sesión + clear cookies (204 No Content, no authMiddleware)
  router.post('/logout', (req, res, next) => controller.logout(req, res, next));

  // GET /v1/auth/me — perfil del usuario autenticado (requiere authMiddleware)
  router.get('/me', authMiddleware, (req, res, next) => controller.me(req, res, next));

  return router;
}

export const authRouter = createAuthRouter();
