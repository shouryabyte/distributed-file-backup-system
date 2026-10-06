import request from 'supertest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStorageNode } from '../src/storage/nodeServer.js';
import { sha256 } from '../src/chunking/chunks.js';

test('storage node verifies hashes and reads stored bytes', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'backup-node-'));
  const token = 'secret-token-for-test';
  const app = createStorageNode(dir, token, 1024);
  const data = Buffer.from('real chunk bytes');
  const hash = sha256(data);
  try {
    expect(
      (await request(app).put(`/internal/chunks/${hash}`).set('x-internal-token', token).send(data))
        .status,
    ).toBe(201);
    expect(
      (await request(app).get(`/internal/chunks/${hash}`).set('x-internal-token', token)).body,
    ).toEqual(data);
    expect(await readFile(path.join(dir, hash.slice(0, 2), hash))).toEqual(data);
    expect(
      (
        await request(app)
          .put(`/internal/chunks/${'0'.repeat(64)}`)
          .set('x-internal-token', token)
          .send(data)
      ).status,
    ).toBe(422);
    expect(
      (await request(app).get('/internal/chunks/../../etc/passwd').set('x-internal-token', token))
        .status,
    ).toBe(404);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
