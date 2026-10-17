import express, { Router } from 'express';
import { LoginUseCase } from '../../application/use-cases/LoginUseCase.js';
import { RegisterBuyerUseCase } from '../../application/use-cases/RegisterBuyerUseCase.js';
import { SupabaseAuthService } from '../../infrastructure/auth/SupabaseAuthService.js';
import { supabase } from '../../infrastructure/config/supabase.js';
import { ProfileRepository } from '../../infrastructure/persistence/repositories/ProfileRepository.js';
import { AuthController } from '../controllers/AuthController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { loginSchema } from '../validators/LoginSchema.js';
import { registerSchema } from '../validators/registerSchema.js';

export function createAuthRouter({
  authService = new SupabaseAuthService({ client: supabase }),
  profileRepository = new ProfileRepository(),
  registerBuyerUseCase,
  loginUseCase,
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
    validateRequest(loginSchema),
    (req, res, next) => controller.login(req, res, next)
  );

  return router;
}

export const authRouter = createAuthRouter();
