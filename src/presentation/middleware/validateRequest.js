export function validateRequest(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    req.validatedBody = value;
    return next();
  };
}
