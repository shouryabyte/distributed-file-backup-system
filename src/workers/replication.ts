import { withTransaction } from '../config/db.js';
import { env } from '../config/env.js';
import { sha256 } from '../chunking/chunks.js';
import { getReplicas } from '../repositories/files.js';
import { listNodes } from '../repositories/nodes.js';
import { getChunk, putChunk } from '../storage/client.js';
import type { Node } from '../storage/client.js';
import { placement } from '../storage/manager.js';
import { log } from '../utils/log.js';
import { replicationSuccess, replicationFailure } from '../monitoring/metrics.js';

export async function replicateChunk(chunkId: string, hash: string): Promise<number> {
  try {
    return await withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [hash]);
      const chunk = (
        await client.query<{ id: string }>('SELECT id FROM chunks WHERE id=$1 AND hash=$2', [
          chunkId,
          hash,
        ])
      ).rows[0];
      if (!chunk) return 0;
      const nodes = placement(hash, await listNodes());
      const targets = nodes.slice(0, env.REPLICATION_FACTOR);
      const replicas = await getReplicas(chunkId);
      const active = replicas.filter((r) => r.enabled && r.healthy && r.status === 'ACTIVE');
      if (active.length >= Math.min(env.REPLICATION_FACTOR, nodes.length)) return 0;
      let data: Buffer | undefined;
      for (const source of active) {
        try {
          const candidate = await getChunk(source as Node, hash);
          if (sha256(candidate) === hash) {
            data = candidate;
            break;
          }
        } catch {
          continue;
        }
      }
      if (!data) throw new Error(`No readable healthy replica for ${hash}`);
      let created = 0;
      for (const target of targets) {
        if (active.some((r) => r.node_id === target.id)) continue;
        await client.query(
          "INSERT INTO chunk_replicas(chunk_id,node_id,status) VALUES($1,$2,'CREATING') ON CONFLICT(chunk_id,node_id) DO UPDATE SET status='CREATING',updated_at=now()",
          [chunkId, target.id],
        );
        await putChunk(target, hash, data);
        replicationSuccess.inc();
        await client.query(
          "UPDATE chunk_replicas SET status='ACTIVE',updated_at=now() WHERE chunk_id=$1 AND node_id=$2",
          [chunkId, target.id],
        );
        created++;
        log('info', 'replica_created', { chunkHash: hash, nodeId: target.id });
      }
      return created;
    });
  } catch (error) {
    replicationFailure.inc();
    throw error;
  }
}
