import { ROLES } from '../../domain/constants/roles.js';
import { ProfileRepository } from '../../infrastructure/persistence/repositories/ProfileRepository.js';

export function requireAdminRole({ profileRepository = new ProfileRepository() } = {}) {
  return async function requireAdminRoleMiddleware(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        const err = new Error('Authentication required');
        err.code = 'UNAUTHORIZED';
        err.statusCode = 401;
        return next(err);
      }

      const roleNames = await profileRepository.getRoleNames(userId);
      req.user.roles = roleNames;

      if (!roleNames.includes(ROLES.ADMIN)) {
        const err = new Error('Admin role required');
        err.code = 'FORBIDDEN';
        err.statusCode = 403;
        return next(err);
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
