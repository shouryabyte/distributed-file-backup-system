import express from 'express';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

const hashPattern = /^[a-f0-9]{64}$/;

async function storedChunkMatches(filePath: string, hash: string): Promise<boolean> {
  try {
    const data = await readFile(filePath);
    return createHash('sha256').update(data).digest('hex') === hash;
  } catch {
    return false;
  }
}

export function createStorageNode(dataDir: string, internalToken: string, maxChunkSize: number) {
  const app = express();
  app.get('/internal/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/internal/chunks', (req, res, next) => {
    if (req.header('x-internal-token') !== internalToken) return res.sendStatus(401);
    next();
  });
  app.param('hash', (req, res, next, value) =>
    hashPattern.test(value) ? next() : res.sendStatus(400),
  );
  app.put('/internal/chunks/:hash', async (req, res) => {
    const hash = req.params.hash;
    const target = path.join(dataDir, hash.slice(0, 2), hash);
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await mkdir(path.dirname(target), { recursive: true });
      let count = 0;
      const digest = createHash('sha256');
      const guard = new Transform({
        transform(chunk: Buffer, _enc, cb) {
          count += chunk.length;
          if (count > maxChunkSize) return cb(new Error('Chunk too large'));
          digest.update(chunk);
          cb(null, chunk);
        },
      });
      await pipeline(req, guard, createWriteStream(temporary, { flags: 'wx' }));
      if (digest.digest('hex') !== hash) {
        await rm(temporary, { force: true });
        return res.status(422).json({ error: 'Hash mismatch' });
      }
      if (await storedChunkMatches(target, hash)) await rm(temporary, { force: true });
      else await rename(temporary, target);
      res.status(201).json({ hash, size: count });
    } catch (error) {
      await rm(temporary, { force: true });
      res.status(500).json({ error: String(error) });
    }
  });
  app.get('/internal/chunks/:hash', async (req, res) => {
    try {
      const data = await readFile(path.join(dataDir, req.params.hash.slice(0, 2), req.params.hash));
      res.type('application/octet-stream').send(data);
    } catch {
      res.sendStatus(404);
    }
  });
  app.delete('/internal/chunks/:hash', async (req, res) => {
    await rm(path.join(dataDir, req.params.hash.slice(0, 2), req.params.hash), { force: true });
    res.sendStatus(204);
  });
  return app;
}
