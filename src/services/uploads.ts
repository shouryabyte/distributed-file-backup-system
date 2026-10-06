import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { sha256 } from '../chunking/chunks.js';
import { AppError } from '../errors/AppError.js';
import { createUpload, getUpload, listUploadChunks } from '../repositories/uploads.js';
import type { UploadRow } from '../repositories/uploads.js';
import { enqueue, lockHash } from '../repositories/files.js';
import { primaryFor } from '../storage/manager.js';
import { putChunk } from '../storage/client.js';
import type { Node } from '../storage/client.js';
import { recordChunk } from '../monitoring/metrics.js';

export async function initiate(userId: string, name: string, size: number): Promise<UploadRow> {
  if (size > env.MAX_FILE_SIZE_BYTES)
    throw new AppError(413, 'FILE_TOO_LARGE', 'File exceeds configured limit');
  const total = Math.ceil(size / env.CHUNK_SIZE_BYTES);
  return createUpload(userId, name, size, total);
}

export async function stageChunk(userId: string, uploadId: string, sequence: number, data: Buffer) {
  if (!data.length || data.length > env.CHUNK_SIZE_BYTES)
    throw new AppError(400, 'INVALID_CHUNK_SIZE', 'Invalid chunk size');
  const hash = sha256(data);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const session = (
      await client.query<UploadRow>(
        'SELECT * FROM upload_sessions WHERE id=$1 AND user_id=$2 FOR UPDATE',
        [uploadId, userId],
      )
    ).rows[0];
    if (!session) throw new AppError(404, 'UPLOAD_NOT_FOUND', 'Upload not found');
    if (session.status !== 'OPEN') throw new AppError(409, 'UPLOAD_CLOSED', 'Upload is closed');
    if (sequence < 1 || sequence > session.total_chunks)
      throw new AppError(400, 'INVALID_SEQUENCE', 'Invalid chunk sequence');
    const expected =
      sequence === session.total_chunks
        ? Number(session.file_size) - (sequence - 1) * env.CHUNK_SIZE_BYTES
        : env.CHUNK_SIZE_BYTES;
    if (data.length !== expected)
      throw new AppError(400, 'INVALID_CHUNK_SIZE', 'Chunk length does not match file metadata');
    const prior = (
      await client.query<{ chunk_hash: string }>(
        'SELECT chunk_hash FROM upload_chunks WHERE upload_id=$1 AND sequence_number=$2',
        [uploadId, sequence],
      )
    ).rows[0];
    if (prior) {
      if (prior.chunk_hash.trim() !== hash)
        throw new AppError(
          409,
          'CHUNK_CONFLICT',
          'A different chunk was already uploaded at this sequence',
        );
      await client.query('COMMIT');
      recordChunk(true);
      return { hash, deduplicated: true };
    }
    await lockHash(client, hash);
    const nodes = (
      await client.query<Node>('SELECT id,url,enabled,healthy FROM storage_nodes ORDER BY id')
    ).rows;
    let chunk = (await client.query<{ id: string }>('SELECT id FROM chunks WHERE hash=$1', [hash]))
      .rows[0];
    const deduplicated = Boolean(chunk);
    if (!chunk) {
      const node = await primaryFor(hash, nodes);
      await putChunk(node, hash, data);
      chunk = (
        await client.query<{ id: string }>(
          'INSERT INTO chunks(hash,size) VALUES($1,$2) ON CONFLICT(hash) DO UPDATE SET hash=EXCLUDED.hash RETURNING id',
          [hash, data.length],
        )
      ).rows[0];
      await client.query(
        "INSERT INTO chunk_replicas(chunk_id,node_id,status) VALUES($1,$2,'ACTIVE') ON CONFLICT(chunk_id,node_id) DO UPDATE SET status='ACTIVE',updated_at=now()",
        [chunk.id, node.id],
      );
      await enqueue(client, 'replication-events', hash, {
        eventType: 'REPLICATE_CHUNK',
        chunkId: chunk.id,
        chunkHash: hash,
      });
    } else {
      const available = (
        await client.query(
          `SELECT 1 FROM chunk_replicas r JOIN storage_nodes n ON n.id=r.node_id
        WHERE r.chunk_id=$1 AND r.status='ACTIVE' AND n.enabled AND n.healthy LIMIT 1`,
          [chunk.id],
        )
      ).rowCount;
      if (!available) {
        const node = await primaryFor(hash, nodes);
        await putChunk(node, hash, data);
        await client.query(
          "INSERT INTO chunk_replicas(chunk_id,node_id,status) VALUES($1,$2,'ACTIVE') ON CONFLICT(chunk_id,node_id) DO UPDATE SET status='ACTIVE',updated_at=now()",
          [chunk.id, node.id],
        );
        await enqueue(client, 'replication-events', hash, {
          eventType: 'REPLICATE_CHUNK',
          chunkId: chunk.id,
          chunkHash: hash,
        });
      }
    }
    await client.query(
      "INSERT INTO upload_chunks(upload_id,sequence_number,chunk_hash,size,status) VALUES($1,$2,$3,$4,'UPLOADED')",
      [uploadId, sequence, hash, data.length],
    );
    await client.query('UPDATE upload_sessions SET updated_at=now() WHERE id=$1', [uploadId]);
    await client.query('COMMIT');
    recordChunk(deduplicated);
    return { hash, deduplicated };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function status(userId: string, uploadId: string) {
  const session = await getUpload(uploadId, userId);
  if (!session) throw new AppError(404, 'UPLOAD_NOT_FOUND', 'Upload not found');
  const chunks = session.status === 'COMPLETED' ? [] : await listUploadChunks(uploadId);
  const uploadedChunks =
    session.status === 'COMPLETED'
      ? Array.from({ length: session.total_chunks }, (_, i) => i + 1)
      : chunks.map((c) => c.sequence_number);
  const uploaded = new Set(uploadedChunks);
  const missingChunks = Array.from({ length: session.total_chunks }, (_, i) => i + 1).filter(
    (i) => !uploaded.has(i),
  );
  return {
    id: session.id,
    status: session.status,
    fileId: session.file_id,
    uploadedChunks,
    missingChunks,
  };
}

export async function complete(userId: string, uploadId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const session = (
      await client.query<UploadRow>(
        'SELECT * FROM upload_sessions WHERE id=$1 AND user_id=$2 FOR UPDATE',
        [uploadId, userId],
      )
    ).rows[0];
    if (!session) throw new AppError(404, 'UPLOAD_NOT_FOUND', 'Upload not found');
    if (session.status === 'COMPLETED') {
      await client.query('COMMIT');
      return { fileId: session.file_id };
    }
    if (session.status !== 'OPEN') throw new AppError(409, 'UPLOAD_CLOSED', 'Upload is closed');
    const check = (
      await client.query<{ count: string; bytes: string }>(
        'SELECT count(*)::text AS count,coalesce(sum(size),0)::text AS bytes FROM upload_chunks WHERE upload_id=$1',
        [uploadId],
      )
    ).rows[0];
    if (
      Number(check.count) !== session.total_chunks ||
      Number(check.bytes) !== Number(session.file_size)
    )
      throw new AppError(409, 'INCOMPLETE_UPLOAD', 'Upload is missing chunks');
    const file = (
      await client.query<{ id: string }>(
        "INSERT INTO files(user_id,file_name,file_size,total_chunks,status) VALUES($1,$2,$3,$4,'READY') RETURNING id",
        [userId, session.file_name, session.file_size, session.total_chunks],
      )
    ).rows[0];
    await client.query(
      'INSERT INTO file_chunks(file_id,chunk_id,sequence_number) SELECT $1,c.id,uc.sequence_number FROM upload_chunks uc JOIN chunks c ON c.hash=uc.chunk_hash WHERE uc.upload_id=$2',
      [file.id, uploadId],
    );
    await client.query(
      'UPDATE chunks c SET reference_count=reference_count+counts.n FROM (SELECT chunk_hash,count(*) AS n FROM upload_chunks WHERE upload_id=$1 GROUP BY chunk_hash) counts WHERE c.hash=counts.chunk_hash',
      [uploadId],
    );
    await client.query('DELETE FROM upload_chunks WHERE upload_id=$1', [uploadId]);
    await client.query(
      "UPDATE upload_sessions SET status='COMPLETED',file_id=$2,updated_at=now() WHERE id=$1",
      [uploadId, file.id],
    );
    await client.query('COMMIT');
    return { fileId: file.id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
