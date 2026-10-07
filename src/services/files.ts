import { Readable } from 'node:stream';
import { withTransaction } from '../config/db.js';
import { sha256 } from '../chunking/chunks.js';
import { AppError } from '../errors/AppError.js';
import {
  enqueue,
  getFile,
  getOrderedChunks,
  getReplicas,
  listFiles,
} from '../repositories/files.js';
import { getChunk } from '../storage/client.js';
import type { Node } from '../storage/client.js';
import { log } from '../utils/log.js';
import { cached, invalidate } from '../cache/redis.js';

export { listFiles };
export async function fileDetails(id: string, userId: string) {
  const file = await cached(`file:${userId}:${id}`, () => getFile(id, userId));
  if (!file) throw new AppError(404, 'FILE_NOT_FOUND', 'File not found');
  return file;
}

export async function fileChunks(id: string, userId: string) {
  await fileDetails(id, userId);
  const chunks = await getOrderedChunks(id);
  return Promise.all(
    chunks.map(async (chunk) => ({
      sequenceNumber: chunk.sequence_number,
      hash: chunk.hash.trim(),
      size: chunk.size,
      replicas: (await getReplicas(chunk.id)).map((replica) => ({
        nodeId: replica.node_id,
        status: replica.status,
        enabled: replica.enabled,
        healthy: replica.healthy,
      })),
    })),
  );
}

export async function download(
  id: string,
  userId: string,
): Promise<{ file: Awaited<ReturnType<typeof fileDetails>>; stream: Readable }> {
  const file = await fileDetails(id, userId);
  const chunks = await cached(`file-chunks:${id}`, () => getOrderedChunks(id));
  const sources = await Promise.all(
    chunks.map(async (chunk) => ({
      chunk,
      replicas: (await getReplicas(chunk.id)).filter(
        (r) => r.enabled && r.healthy && r.status === 'ACTIVE',
      ),
    })),
  );
  if (sources.some((s) => !s.replicas.length))
    throw new AppError(503, 'CHUNK_UNAVAILABLE', 'A required chunk has no healthy replica');
  async function* bytes() {
    for (const { chunk, replicas } of sources) {
      let found = false;
      for (const replica of replicas) {
        try {
          const data = await getChunk(replica as Node, chunk.hash.trim());
          if (sha256(data) !== chunk.hash.trim()) throw new Error('Corrupted chunk');
          yield data;
          found = true;
          break;
        } catch (error) {
          log('warn', 'replica_read_failed', {
            chunkHash: chunk.hash,
            nodeId: replica.node_id,
            error: String(error),
          });
        }
      }
      if (!found)
        throw new AppError(503, 'CHUNK_UNAVAILABLE', 'All replicas for a chunk are unavailable');
    }
  }
  return { file, stream: Readable.from(bytes()) };
}

export async function removeFile(id: string, userId: string): Promise<void> {
  await withTransaction(async (client) => {
    const file = (
      await client.query('SELECT id FROM files WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId])
    ).rows[0];
    if (!file) throw new AppError(404, 'FILE_NOT_FOUND', 'File not found');
    const counts = (
      await client.query<{ chunk_id: string; n: string }>(
        'SELECT chunk_id,count(*)::text AS n FROM file_chunks WHERE file_id=$1 GROUP BY chunk_id',
        [id],
      )
    ).rows;
    await client.query('DELETE FROM files WHERE id=$1', [id]);
    for (const count of counts) {
      const chunk = (
        await client.query<{ hash: string; reference_count: string }>(
          'UPDATE chunks SET reference_count=reference_count-$2 WHERE id=$1 RETURNING hash,reference_count',
          [count.chunk_id, count.n],
        )
      ).rows[0];
      if (Number(chunk.reference_count) === 0)
        await enqueue(client, 'cleanup-events', chunk.hash.trim(), {
          eventType: 'CLEANUP_CHUNK',
          chunkId: count.chunk_id,
          chunkHash: chunk.hash.trim(),
        });
    }
  });
  await invalidate(`file:${userId}:${id}`);
  await invalidate(`file-chunks:${id}`);
}

export async function verifyFile(id: string, userId: string): Promise<{ queued: number }> {
  await fileDetails(id, userId);
  const chunks = await getOrderedChunks(id);
  await withTransaction(async (client) => {
    for (const chunk of chunks)
      await enqueue(client, 'verification-events', chunk.hash.trim(), {
        eventType: 'VERIFY_CHUNK',
        chunkId: chunk.id,
        chunkHash: chunk.hash.trim(),
      });
  });
  return { queued: chunks.length };
}
