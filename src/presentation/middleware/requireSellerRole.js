import { ProfileRepository } from '../../infrastructure/persistence/repositories/ProfileRepository.js';

/**
 * Reusable middleware that verifies the authenticated user has the `seller`
 * role by querying `public.user_roles`. MUST run AFTER `authMiddleware` (which
 * populates `req.user.id`).
 *
 * On success: sets `req.user.roles = string[]` (role names) and calls `next()`.
 * On failure: responds 403 FORBIDDEN.
 *
 * Why this exists: `authMiddleware` only sets `req.user.role` from the JWT
 * claim (`authenticated` for every Supabase user). The actual application roles
 * (buyer/seller/admin) live in `public.user_roles` and are NOT in the JWT.
 * The comment in `authMiddleware.js` documents this gap — this middleware
 * completes it for seller-scoped routes.
 *
 * @param {Object} [options]
 * @param {import('../../infrastructure/persistence/repositories/ProfileRepository.js').ProfileRepository} [options.profileRepository]
 */
export function requireSellerRole({ profileRepository = new ProfileRepository() } = {}) {
  return async function requireSellerRoleMiddleware(req, res, next) {
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

      if (!roleNames.includes('seller')) {
        const err = new Error('Seller role required');
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
