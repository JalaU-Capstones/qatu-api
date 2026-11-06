import crypto from 'node:crypto';
import { Profile } from '../../domain/entities/Profile.js';
import { logger } from '../../infrastructure/logging/logger.js';

/**
 * Backoff delays (ms) for the profile lookup retry.
 */
const PROFILE_RETRY_DELAYS_MS = [100, 250, 500];

/**
 * Maximum number of suffix iterations when resolving a unique username.
 */
const MAX_USERNAME_SUFFIX = 9999;

/**
 * Resolves after the given delay.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Strips characters not allowed by profiles_username_format and clamps the result.
 *
 * @param {string} part
 * @returns {string}
 */
const sanitizeUsernamePart = (part) =>
  (part || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);

/**
 * Generates a short random hex string for username suffixes.
 *
 * @returns {string}
 */
const shortHex = () => crypto.randomBytes(2).toString('hex');

/**
 * Builds the base username for the fallback profile, mirroring migration 29's trigger:
 * metadata username → email prefix + short hex → user_<uuid>.
 *
 * @param {Object} user - verified Supabase user
 * @returns {string}
 */
const buildFallbackUsername = (user) => {
  const metadataUsername = sanitizeUsernamePart(user.user_metadata?.username);
  if (metadataUsername.length >= 3) {
    return metadataUsername;
  }

  const emailPrefix = sanitizeUsernamePart(user.email?.split('@')[0]);
  if (emailPrefix.length >= 3) {
    return `${emailPrefix.slice(0, 20)}_${shortHex()}`;
  }

  return `user_${user.id.replace(/-/g, '').slice(0, 10)}`;
};

/**
 * Appends a suffix to a username keeping it within the 30-char DB limit.
 *
 * @param {string} base
 * @param {number} suffix
 * @returns {string}
 */
const withSuffix = (base, suffix) => {
  const suffixText = `_${suffix}`;
  return `${base.slice(0, 30 - suffixText.length)}${suffixText}`;
};

export class ExchangeOAuthTokenUseCase {
  /**
   * @param {Object} dependencies
   * @param {import('../../infrastructure/auth/SupabaseAuthService.js').SupabaseAuthService} dependencies.authService
   * @param {import('../../domain/repositories/IProfileRepository.js').IProfileRepository} dependencies.profileRepository
   * @param {Object} [dependencies.userRoleRepository]
   */
  constructor({ authService, profileRepository, userRoleRepository } = {}) {
    this.authService = authService;
    this.profileRepository = profileRepository;
    this.userRoleRepository = userRoleRepository;
  }

  /**
   * Verifies the OAuth access token server-side, loads (or recovers) the
   * profile created by the handle_new_user trigger, and returns the data
   * needed by the controller to set session cookies.
   *
   * @param {Object} params
   * @param {string} params.accessToken
   * @param {string} params.refreshToken
   * @returns {Promise<{ user: Object, profile: Object, roles: Array<Object>, accessToken: string, refreshToken: string }>}
   * @throws {Error & { code: 'UNAUTHORIZED' }} when tokens are missing or rejected by Supabase
   * @throws {Error & { code: 'PROFILE_SETUP_IN_PROGRESS' }} when the profile could not be recovered
   */
  async execute({ accessToken, refreshToken } = {}) {
    if (!accessToken || !refreshToken) {
      const err = new Error('access_token and refresh_token are required');
      err.status = 401;
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    const verified = await this.authService.exchangeOAuthToken(accessToken, refreshToken);
    if (!verified || !verified.user) {
      const err = new Error('Invalid or expired OAuth access token');
      err.status = 401;
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    const profile = await this.lookupProfile(verified.user);
    if (!profile) {
      const err = new Error(
        'Account created but profile setup is in progress. Please try again.'
      );
      err.status = 503;
      err.statusCode = 503;
      err.code = 'PROFILE_SETUP_IN_PROGRESS';
      throw err;
    }

    const roles = this.userRoleRepository?.findByProfileId
      ? await this.userRoleRepository.findByProfileId(verified.user.id)
      : profile.roles || [];

    return {
      user: verified.user,
      profile,
      roles,
      accessToken: verified.accessToken,
      refreshToken: verified.refreshToken,
    };
  }

  /**
   * Finds the profile for an OAuth user, tolerating transaction-visibility
   * delays after the auth.users insert, and creating the profile in-process
   * as a last-resort fallback if the handle_new_user trigger did not.
   *
   * @param {Object} user - verified Supabase user
   * @returns {Promise<Object|null>} profile or null when recovery failed
   */
  async lookupProfile(user) {
    for (const delay of PROFILE_RETRY_DELAYS_MS) {
      const profile = await this.profileRepository.findById(user.id);
      if (profile) return profile;
      await sleep(delay);
    }

    const profile = await this.profileRepository.findById(user.id);
    if (profile) return profile;

    logger.error(
      {
        authUserId: user.id,
        email: user.email,
        raw_user_metadata: user.user_metadata,
      },
      '[oauth] profile not found after retries (trigger did not fire); attempting fallback creation'
    );

    try {
      return await this.createFallbackProfile(user);
    } catch (cause) {
      logger.error(
        { authUserId: user.id, email: user.email, err: cause?.message },
        '[oauth] fallback profile creation failed'
      );
      return null;
    }
  }

  /**
   * Last-resort profile creation replicating the handle_new_user trigger
   * logic (username generation, avatar/full-name mapping, buyer role).
   *
   * @param {Object} user - verified Supabase user
   * @returns {Promise<Object>} created profile
   */
  async createFallbackProfile(user) {
    const metadata = user.user_metadata || {};
    const avatar = metadata.avatar_path || metadata.avatar_url || metadata.picture || null;
    const fullName = metadata.full_name || metadata.name || null;
    const emailPrefix = user.email?.split('@')[0] || '';

    const baseUsername = buildFallbackUsername(user);
    let candidate = baseUsername;
    if (typeof this.profileRepository.findByUsername === 'function') {
      let suffix = 0;
      while (
        suffix < MAX_USERNAME_SUFFIX &&
        (await this.profileRepository.findByUsername(candidate))
      ) {
        suffix += 1;
        candidate = withSuffix(baseUsername, suffix);
      }
    }

    const profile = await this.profileRepository.create(
      new Profile({
        id: user.id,
        username: candidate,
        fullName: fullName || emailPrefix || 'New User',
        email: user.email,
        avatarPath: avatar,
        role: 'buyer',
      })
    );

    return profile;
  }
}
