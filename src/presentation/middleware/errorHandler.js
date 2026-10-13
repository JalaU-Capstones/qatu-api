// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err.code === 'EMAIL_ALREADY_EXISTS' || err.statusCode === 409) {
    return res.status(409).json({
      error: 'Conflict',
      message: 'Email already registered',
    });
  }

  if (
    err.message?.includes('Password must be at least') ||
    err.message?.includes('Invalid email') ||
    err.message?.includes('Username must be') ||
    err.message?.includes('Full name must be')
  ) {
    return res.status(400).json({
      error: 'Bad Request',
      message: err.message,
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : 'Error',
    message,
  });
}
