import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '12h' });
}

export function verifyToken(token: string): string {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload === 'string' || !payload.sub) throw new Error('Invalid token');
  return payload.sub;
}
