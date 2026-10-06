import { pool } from '../config/db.js';
import { getReplicas } from '../repositories/files.js';
import { deleteChunk } from '../storage/client.js';
import type { Node } from '../storage/client.js';
import { log } from '../utils/log.js';

export async function cleanupChunk(chunkId: string, hash: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [hash]);
    const chunk = (
      await client.query<{ reference_count: string }>(
        'SELECT reference_count FROM chunks WHERE id=$1 AND hash=$2 FOR UPDATE',
        [chunkId, hash],
      )
    ).rows[0];
    if (!chunk || Number(chunk.reference_count) > 0) {
      await client.query('COMMIT');
      return;
    }
    const staged = (
      await client.query('SELECT 1 FROM upload_chunks WHERE chunk_hash=$1 LIMIT 1', [hash])
    ).rowCount;
    if (staged) {
      await client.query('COMMIT');
      return;
    }
    for (const replica of await getReplicas(chunkId)) {
      if (!replica.healthy) throw new Error(`Node ${replica.node_id} unavailable for cleanup`);
      await deleteChunk(replica as Node, hash);
      await client.query('DELETE FROM chunk_replicas WHERE id=$1', [replica.id]);
    }
    await client.query('DELETE FROM chunks WHERE id=$1', [chunkId]);
    await client.query('COMMIT');
    log('info', 'chunk_cleaned', { chunkHash: hash });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
