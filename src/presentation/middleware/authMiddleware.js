import jwt from 'jsonwebtoken';
import { env } from '../../infrastructure/config/env.js';

/**
 * Express middleware to verify Supabase JWTs and enforce expiration.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function authMiddleware(req, res, next) {
  const timestamp = new Date().toISOString();
  const authHeader = req.headers?.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication failed',
      },
      meta: { timestamp },
    });
  }

  const token = authHeader.split(' ')[1]?.trim();

  if (!token) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication failed',
      },
      meta: { timestamp },
    });
  }

  const secret = process.env.JWT_SECRET || env.JWT_SECRET;

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      ignoreExpiration: true,
    });

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!decoded || typeof decoded.exp !== 'number' || decoded.exp <= nowSeconds) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication failed',
        },
        meta: { timestamp },
      });
    }

    req.user = {
      id: decoded.sub,
      role: decoded.role,
      email: decoded.email,
    };

    return next();
  } catch {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication failed',
      },
      meta: { timestamp },
    });
  }
}

export const requireAuth = authMiddleware;
