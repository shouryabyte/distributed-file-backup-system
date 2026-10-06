import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';
import { log } from '../utils/log.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  void _next;
  if (error instanceof ZodError)
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: error.issues },
    });
  if (error instanceof AppError)
    return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  if (error instanceof SyntaxError && 'body' in error)
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON' } });
  if (
    error instanceof Error &&
    'type' in error &&
    (error as { type?: string }).type === 'entity.too.large'
  )
    return res
      .status(413)
      .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large' } });
  log('error', 'request_failed', {
    requestId: req.requestId,
    error: error instanceof Error ? error.message : String(error),
  });
  return res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
};
