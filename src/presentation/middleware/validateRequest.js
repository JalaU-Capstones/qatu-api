export function validateRequest(schema, { source = 'body' } = {}) {
  return (req, res, next) => {
    let data = req.body;
    if (source === 'query') {
      data = req.query;
    } else if (source === 'params') {
      data = req.params;
    }

    const { error, value } = schema.validate(data, {
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

    if (source === 'query') {
      req.validatedQuery = value;
    } else if (source === 'params') {
      req.validatedParams = value;
    } else {
      req.validatedBody = value;
    }

    return next();
  };
}
