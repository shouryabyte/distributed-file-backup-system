import { Router, raw } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';
import * as uploads from '../services/uploads.js';
import { AppError } from '../errors/AppError.js';

export const uploadRouter = Router();
uploadRouter.use(requireAuth);
const initSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().min(0).max(env.MAX_FILE_SIZE_BYTES),
});
const idSchema = z.uuid();
uploadRouter.post('/initiate', async (req, res) => {
  const body = initSchema.parse(req.body);
  res.status(201).json(await uploads.initiate(req.userId!, body.fileName, body.fileSize));
});
uploadRouter.post(
  '/:id/chunks',
  raw({ type: 'application/octet-stream', limit: env.CHUNK_SIZE_BYTES }),
  async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const sequence = z.coerce.number().int().positive().parse(req.query.sequence);
    if (!Buffer.isBuffer(req.body))
      throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/octet-stream');
    res.status(201).json(await uploads.stageChunk(req.userId!, id, sequence, req.body));
  },
);
uploadRouter.get('/:id/status', async (req, res) => {
  res.json(await uploads.status(req.userId!, idSchema.parse(req.params.id)));
});
uploadRouter.post('/:id/complete', async (req, res) => {
  res.json(await uploads.complete(req.userId!, idSchema.parse(req.params.id)));
});
