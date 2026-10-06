import type { RequestHandler } from 'express';
import { verifyToken } from '../auth/jwt.js';
import { AppError } from '../errors/AppError.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
    requestId?: string;
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = /^Bearer (.+)$/i.exec(req.header('authorization') ?? '')?.[1];
  if (!token) return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
  try {
    req.userId = verifyToken(token);
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }
};
