import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { sha256 } from '../src/chunking/chunks.js';
import { execFileSync } from 'node:child_process';

const run = process.env.RUN_INTEGRATION === '1' ? test : test.skip;
const api = request(process.env.API_URL ?? 'http://localhost:3000');
const internalToken = process.env.INTERNAL_TOKEN ?? 'replace-with-another-long-random-secret';
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor<T>(fn: () => Promise<T | undefined>, timeoutMs = 90000): Promise<T> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const result = await fn();
    if (result) return result;
    await pause(500);
  }
  throw new Error('Timed out waiting for asynchronous work');
}

run(
  'register, deduplicate, replicate, survive failure, recover, and clean up',
  async () => {
    const email = `${randomUUID()}@example.test`;
    const password = 'correct-horse-battery-staple';
    const registered = await api.post('/api/auth/register').send({ email, password }).expect(201);
    const loggedIn = await api.post('/api/auth/login').send({ email, password }).expect(200);
    expect(loggedIn.body.token).toBeTruthy();
    const token = registered.body.token as string;
    const bytes = Buffer.alloc(6 * 1024 * 1024, 0x41);
    bytes.write(randomUUID());
    const hash = sha256(bytes.subarray(0, 5 * 1024 * 1024));
    async function upload() {
      const response = await api
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${token}`)
        .set('x-file-name', 'test.bin')
        .set('Content-Type', 'application/octet-stream')
        .send(bytes)
        .expect(201);
      return response.body.fileId as string;
    }
    const first = await upload();
    const second = await upload();
    const chunkInfo = async () =>
      (await api.get(`/internal/chunks/${hash}`).set('x-internal-token', internalToken).expect(200))
        .body as {
        reference_count: string;
        replicas: { node_id: string; status: string; enabled: boolean; healthy: boolean }[];
      };
    expect((await chunkInfo()).reference_count).toBe('2');
    const ready = await waitFor(async () => {
      const c = await chunkInfo();
      return c.replicas.filter((r) => r.status === 'ACTIVE' && r.enabled && r.healthy).length === 3
        ? c
        : undefined;
    });
    const disabled = ready.replicas.find((r) => r.status === 'ACTIVE' && r.enabled)!;
    await api
      .post(`/internal/storage-nodes/${disabled.node_id}/disable`)
      .set('x-internal-token', internalToken)
      .expect(200);
    const downloaded = await api
      .get(`/api/files/${first}/download`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(downloaded.body).toEqual(bytes);
    await waitFor(async () => {
      const c = await chunkInfo();
      return c.replicas.filter((r) => r.status === 'ACTIVE' && r.enabled && r.healthy).length === 3
        ? c
        : undefined;
    });
    await api
      .post(`/internal/storage-nodes/${disabled.node_id}/enable`)
      .set('x-internal-token', internalToken)
      .expect(200);
    await api.delete(`/api/files/${first}`).set('Authorization', `Bearer ${token}`).expect(204);
    expect((await chunkInfo()).reference_count).toBe('1');
    await api.delete(`/api/files/${second}`).set('Authorization', `Bearer ${token}`).expect(204);
    await waitFor(async () => {
      const response = await api
        .get(`/internal/chunks/${hash}`)
        .set('x-internal-token', internalToken);
      return response.status === 404 ? true : undefined;
    });
  },
  240000,
);

run(
  'resumable upload reports missing chunks and enforces ownership',
  async () => {
    const password = 'correct-horse-battery-staple';
    const owner = await api
      .post('/api/auth/register')
      .send({ email: `${randomUUID()}@example.test`, password })
      .expect(201);
    const stranger = await api
      .post('/api/auth/register')
      .send({ email: `${randomUUID()}@example.test`, password })
      .expect(201);
    const data = Buffer.from('resumable-content');
    const initiated = await api
      .post('/api/uploads/initiate')
      .set('Authorization', `Bearer ${owner.body.token}`)
      .send({ fileName: 'resume.bin', fileSize: data.length })
      .expect(201);
    const uploadId = initiated.body.id as string;
    const before = await api
      .get(`/api/uploads/${uploadId}/status`)
      .set('Authorization', `Bearer ${owner.body.token}`)
      .expect(200);
    expect(before.body.missingChunks).toEqual([1]);
    await api
      .post(`/api/uploads/${uploadId}/chunks?sequence=1`)
      .set('Authorization', `Bearer ${owner.body.token}`)
      .set('Content-Type', 'application/octet-stream')
      .send(data)
      .expect(201);
    const after = await api
      .get(`/api/uploads/${uploadId}/status`)
      .set('Authorization', `Bearer ${owner.body.token}`)
      .expect(200);
    expect(after.body.uploadedChunks).toEqual([1]);
    expect(after.body.missingChunks).toEqual([]);
    const completed = await api
      .post(`/api/uploads/${uploadId}/complete`)
      .set('Authorization', `Bearer ${owner.body.token}`)
      .expect(200);
    const fileId = completed.body.fileId as string;
    await api
      .get(`/api/files/${fileId}`)
      .set('Authorization', `Bearer ${stranger.body.token}`)
      .expect(404);
    await api
      .get(`/api/uploads/${uploadId}/status`)
      .set('Authorization', `Bearer ${stranger.body.token}`)
      .expect(404);
    execFileSync('docker', ['compose', 'stop', 'redis']);
    try {
      await api
        .get(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${owner.body.token}`)
        .expect(200);
    } finally {
      execFileSync('docker', ['compose', 'start', 'redis']);
    }
    await api
      .delete(`/api/files/${fileId}`)
      .set('Authorization', `Bearer ${owner.body.token}`)
      .expect(204);
  },
  90000,
);

run(
  'integrity worker repairs a corrupted replica',
  async () => {
    const account = await api
      .post('/api/auth/register')
      .send({ email: `${randomUUID()}@example.test`, password: 'correct-horse-battery-staple' })
      .expect(201);
    const token = account.body.token as string;
    const data = Buffer.from(`integrity-${randomUUID()}`);
    const hash = sha256(data);
    const uploaded = await api
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('x-file-name', 'integrity.bin')
      .set('Content-Type', 'application/octet-stream')
      .send(data)
      .expect(201);
    const fileId = uploaded.body.fileId as string;
    const info = async () =>
      (await api.get(`/internal/chunks/${hash}`).set('x-internal-token', internalToken).expect(200))
        .body as {
        replicas: { node_id: string; status: string; enabled: boolean; healthy: boolean }[];
      };
    const ready = await waitFor(async () => {
      const value = await info();
      return value.replicas.filter((r) => r.status === 'ACTIVE' && r.enabled && r.healthy)
        .length === 3
        ? value
        : undefined;
    });
    const nodeId = ready.replicas[0].node_id;
    const service = `storage-${nodeId}`;
    const chunkPath = `/data/${hash.slice(0, 2)}/${hash}`;
    execFileSync('docker', [
      'compose',
      'exec',
      '-T',
      '--user',
      'root',
      service,
      'node',
      '-e',
      "require('node:fs').writeFileSync(process.argv[1],Buffer.from('corrupt'))",
      chunkPath,
    ]);
    await api
      .post(`/api/files/${fileId}/verify`)
      .set('Authorization', `Bearer ${token}`)
      .expect(202);
    await waitFor(async () => {
      const checksum = execFileSync(
        'docker',
        ['compose', 'exec', '-T', service, 'sha256sum', chunkPath],
        { encoding: 'utf8' },
      );
      return checksum.startsWith(hash) ? true : undefined;
    });
    await api.delete(`/api/files/${fileId}`).set('Authorization', `Bearer ${token}`).expect(204);
  },
  120000,
);

run(
  'concurrent users share one content-addressed chunk',
  async () => {
    const password = 'correct-horse-battery-staple';
    const [a, b] = await Promise.all([
      api
        .post('/api/auth/register')
        .send({ email: `${randomUUID()}@example.test`, password })
        .expect(201),
      api
        .post('/api/auth/register')
        .send({ email: `${randomUUID()}@example.test`, password })
        .expect(201),
    ]);
    const data = Buffer.from(`concurrent-${randomUUID()}`);
    const hash = sha256(data);
    const send = (token: string) =>
      api
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${token}`)
        .set('x-file-name', 'same.bin')
        .set('Content-Type', 'application/octet-stream')
        .send(data)
        .expect(201);
    const [first, second] = await Promise.all([send(a.body.token), send(b.body.token)]);
    const chunk = await api
      .get(`/internal/chunks/${hash}`)
      .set('x-internal-token', internalToken)
      .expect(200);
    expect(chunk.body.reference_count).toBe('2');
    const ids = chunk.body.replicas.map((replica: { node_id: string }) => replica.node_id);
    expect(new Set(ids).size).toBe(ids.length);
    await Promise.all([
      api
        .delete(`/api/files/${first.body.fileId}`)
        .set('Authorization', `Bearer ${a.body.token}`)
        .expect(204),
      api
        .delete(`/api/files/${second.body.fileId}`)
        .set('Authorization', `Bearer ${b.body.token}`)
        .expect(204),
    ]);
  },
  30000,
);
