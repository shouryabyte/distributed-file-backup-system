import { Router } from 'express';
import { z } from 'zod';
import { pipeline } from 'node:stream/promises';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { requireAuth } from '../middleware/auth.js';
import * as files from '../services/files.js';
import { uploadStream } from '../services/directUpload.js';

export const fileRouter = Router();
fileRouter.use(requireAuth);
fileRouter.post('/upload', async (req, res) => {
  const fileName = z.string().min(1).max(255).parse(req.header('x-file-name'));
  const size = z.coerce
    .number()
    .int()
    .min(0)
    .max(env.MAX_FILE_SIZE_BYTES)
    .parse(req.header('content-length'));
  if (req.header('content-type') !== 'application/octet-stream')
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/octet-stream');
  res.status(201).json(await uploadStream(req.userId!, fileName, size, req));
});
fileRouter.get('/', async (req, res) => {
  res.json(await files.listFiles(req.userId!));
});
fileRouter.get('/:id', async (req, res) => {
  res.json(await files.fileDetails(z.uuid().parse(req.params.id), req.userId!));
});
fileRouter.get('/:id/download', async (req, res) => {
  const { file, stream } = await files.download(z.uuid().parse(req.params.id), req.userId!);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', file.file_size);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
  );
  await pipeline(stream, res);
});
fileRouter.delete('/:id', async (req, res) => {
  await files.removeFile(z.uuid().parse(req.params.id), req.userId!);
  res.sendStatus(204);
});
fileRouter.post('/:id/verify', async (req, res) => {
  res.status(202).json(await files.verifyFile(z.uuid().parse(req.params.id), req.userId!));
});
