import type { RequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';

const buckets = new Map<string, { count: number; reset: number }>();
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of buckets) if (value.reset <= now) buckets.delete(key);
}, 300_000);
sweep.unref();
export function rateLimit(maxPerMinute = 120): RequestHandler {
  return (req, _res, next) => {
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    const bucket = buckets.get(key);
    if (!bucket || bucket.reset <= now) {
      buckets.set(key, { count: 1, reset: now + 60_000 });
      next();
      return;
    }
    bucket.count++;
    if (bucket.count > maxPerMinute) {
      next(new AppError(429, 'RATE_LIMITED', 'Too many requests'));
      return;
    }
    next();
  };
}
