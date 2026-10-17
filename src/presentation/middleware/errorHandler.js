/**
 * Global Express error handling middleware conforming to OpenAPI Error schema.
 *
 * @param {Error & { statusCode?: number, code?: string }} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const timestamp = new Date().toISOString();

  // AUTHENTICATION OR UNAUTHORIZED
  if (err.statusCode === 401 || err.code === 'UNAUTHORIZED' || err.code === 'EMAIL_NOT_CONFIRMED') {
    const message =
      err.code === 'EMAIL_NOT_CONFIRMED'
        ? 'Please confirm your email before logging in'
        : 'Authentication failed';

    return res.status(401).json({
      error: {
        code: err.code || 'UNAUTHORIZED',
        message,
      },
      meta: { timestamp },
    });
  }

  // CONFLICTS
  if (err.code === 'EMAIL_ALREADY_EXISTS' || err.statusCode === 409) {
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'A resource with these attributes already exists',
      },
      meta: { timestamp },
    });
  }

  // DVO VALIDATIONS
  if (
    err.message?.includes('Password must be at least') ||
    err.message?.includes('Invalid email') ||
    err.message?.includes('Username must be') ||
    err.message?.includes('Full name must be') ||
    err.message?.includes('is required') ||
    err.statusCode === 400
  ) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message || 'Invalid input data',
      },
      meta: { timestamp },
    });
  }

  // RATE LIMITING
  if (err.statusCode === 429) {
    return res.status(429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded. Please retry later.',
      },
      meta: { timestamp },
    });
  }

  // GENERIC SERVER ERROR HANDLING
  const statusCode = err.statusCode || 500;
  const isServer = statusCode >= 500;

  return res.status(statusCode).json({
    error: {
      code: isServer ? 'INTERNAL_SERVER_ERROR' : err.code || 'ERROR',
      message: isServer
        ? 'An unexpected server error occurred'
        : err.message || 'An error occurred',
    },
    meta: { timestamp },
  });
}
