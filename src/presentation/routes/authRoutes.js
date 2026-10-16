import { Router } from 'express';
import { RegisterBuyerUseCase } from '../../application/use-cases/RegisterBuyerUseCase.js';
import { SupabaseAuthService } from '../../infrastructure/auth/SupabaseAuthService.js';
import { supabase } from '../../infrastructure/config/supabase.js';
import { ProfileRepository } from '../../infrastructure/persistence/repositories/ProfileRepository.js';
import { AuthController } from '../controllers/AuthController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { registerSchema } from '../validators/registerSchema.js';

export function createAuthRouter({
  authService = new SupabaseAuthService({ client: supabase }),
  profileRepository = new ProfileRepository(),
  registerBuyerUseCase,
  authController,
} = {}) {
  const router = Router();

  const useCase =
    registerBuyerUseCase ||
    new RegisterBuyerUseCase({
      authService,
      profileRepository,
    });

  const controller =
    authController ||
    new AuthController({
      registerBuyerUseCase: useCase,
    });

  router.post('/register', validateRequest(registerSchema), (req, res, next) =>
    controller.register(req, res, next)
  );

  return router;
}

export const authRouter = createAuthRouter();
