import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { LoginUseCase } from '../../application/use-cases/LoginUseCase.js';
import { RegisterBuyerUseCase } from '../../application/use-cases/RegisterBuyerUseCase.js';
import { SupabaseAuthService } from '../../infrastructure/auth/SupabaseAuthService.js';
import { supabase } from '../../infrastructure/config/supabase.js';
import { ProfileRepository } from '../../infrastructure/persistence/repositories/ProfileRepository.js';
import { AuthController } from '../controllers/AuthController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { loginSchema } from '../validators/LoginSchema.js';
import { registerSchema } from '../validators/registerSchema.js';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 login attempts per IP
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export function createAuthRouter({
  authService = new SupabaseAuthService({ client: supabase }),
  profileRepository = new ProfileRepository(),
  registerBuyerUseCase,
  loginUseCase,
  authController,
  rateLimiter = loginRateLimiter,
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

  const controller =
    authController ||
    new AuthController({
      registerBuyerUseCase: registerUC,
      loginUseCase: loginUC,
    });

  router.post('/register', validateRequest(registerSchema), (req, res, next) =>
    controller.register(req, res, next)
  );

  router.post(
    '/login',
    express.json({ limit: '1kb' }),
    rateLimiter,
    validateRequest(loginSchema),
    (req, res, next) => controller.login(req, res, next)
  );

  return router;
}

export const authRouter = createAuthRouter();
