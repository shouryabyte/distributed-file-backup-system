import { pool } from '../config/db.js';
import { sha256 } from '../chunking/chunks.js';
import { getReplicas } from '../repositories/files.js';
import { getChunk } from '../storage/client.js';
import type { Node } from '../storage/client.js';
import { replicateChunk } from './replication.js';
import { log } from '../utils/log.js';
import { integrityFailure } from '../monitoring/metrics.js';

export async function verifyChunk(chunkId: string, hash: string): Promise<void> {
  const replicas = await getReplicas(chunkId);
  let damaged = false;
  for (const replica of replicas.filter((r) => r.enabled && r.healthy)) {
    let good = false;
    try {
      good = sha256(await getChunk(replica as Node, hash)) === hash;
    } catch {
      /* Mark unreadable replica failed. */
    }
    if (!good) {
      damaged = true;
      integrityFailure.inc();
      await pool.query(
        "UPDATE chunk_replicas SET status='CORRUPTED',updated_at=now() WHERE id=$1",
        [replica.id],
      );
      log('warn', 'integrity_failure', { chunkHash: hash, nodeId: replica.node_id });
    }
  }
  if (damaged) await replicateChunk(chunkId, hash);
}
