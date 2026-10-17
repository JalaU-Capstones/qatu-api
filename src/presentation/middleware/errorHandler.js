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

  // Conflict errors (e.g. duplicate email or resource)
  if (err.code === 'EMAIL_ALREADY_EXISTS' || err.statusCode === 409) {
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'A resource with these attributes already exists',
      },
      meta: { timestamp },
    });
  }

  // Domain Value Object validation errors
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

  // Rate limiting errors
  if (err.statusCode === 429) {
    return res.status(429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded. Please retry later.',
      },
      meta: { timestamp },
    });
  }

  // Generic internal server or unknown status errors
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
