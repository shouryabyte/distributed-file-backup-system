import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { enqueue } from '../repositories/files.js';
import { listNodes, setHealth } from '../repositories/nodes.js';
import { isHealthy } from '../storage/client.js';
import { log } from '../utils/log.js';
import { activeUploads, nodeHealth } from '../monitoring/metrics.js';

export async function pollNodesAndRepair() {
  const nodes = await listNodes();
  await Promise.all(
    nodes.map(async (node) => {
      const healthy = node.enabled && (await isHealthy(node));
      nodeHealth.set({ node_id: node.id }, healthy ? 1 : 0);
      if (healthy !== node.healthy) {
        await setHealth(node.id, healthy);
        log('warn', 'node_health_changed', { nodeId: node.id, healthy });
      }
    }),
  );
  await scheduleUnderReplicated();
  await expireUploads();
  await scheduleUnreferenced();
  const count = (
    await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM upload_sessions WHERE status='OPEN'",
    )
  ).rows[0];
  activeUploads.set(Number(count.n));
}

export async function scheduleUnderReplicated() {
  const rows = (
    await pool.query<{ id: string; hash: string }>(
      `SELECT c.id,c.hash FROM chunks c
    LEFT JOIN chunk_replicas r ON r.chunk_id=c.id
    LEFT JOIN storage_nodes n ON n.id=r.node_id
    WHERE c.reference_count>0
    GROUP BY c.id
    HAVING count(*) FILTER (WHERE r.status='ACTIVE' AND n.enabled AND n.healthy) <
      LEAST($1::integer,(SELECT count(*) FROM storage_nodes WHERE enabled AND healthy))`,
      [env.REPLICATION_FACTOR],
    )
  ).rows;
  if (!rows.length) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      const pending = (
        await client.query(
          'SELECT 1 FROM outbox WHERE topic=$1 AND event_key=$2 AND sent_at IS NULL LIMIT 1',
          ['replication-events', row.hash.trim()],
        )
      ).rowCount;
      if (!pending)
        await enqueue(client, 'replication-events', row.hash.trim(), {
          eventType: 'REPLICATE_CHUNK',
          chunkId: row.id,
          chunkHash: row.hash.trim(),
        });
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function expireUploads() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const expired = (
      await client.query<{ id: string }>(
        "UPDATE upload_sessions SET status='FAILED',updated_at=now() WHERE status='OPEN' AND updated_at < now()-interval '24 hours' RETURNING id",
      )
    ).rows;
    if (expired.length) {
      await client.query('DELETE FROM upload_chunks WHERE upload_id=ANY($1::uuid[])', [
        expired.map((row) => row.id),
      ]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function scheduleUnreferenced() {
  const rows = (
    await pool.query<{
      id: string;
      hash: string;
    }>(`SELECT c.id,c.hash FROM chunks c WHERE c.reference_count=0
    AND NOT EXISTS(SELECT 1 FROM upload_chunks uc WHERE uc.chunk_hash=c.hash)
    AND NOT EXISTS(SELECT 1 FROM outbox o WHERE o.topic='cleanup-events' AND o.event_key=c.hash AND o.created_at>now()-interval '1 minute')`)
  ).rows;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows)
      await enqueue(client, 'cleanup-events', row.hash.trim(), {
        eventType: 'CLEANUP_CHUNK',
        chunkId: row.id,
        chunkHash: row.hash.trim(),
      });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function startHealthLoop() {
  void pollNodesAndRepair().catch((error) =>
    log('error', 'health_poll_failed', { error: String(error) }),
  );
  const timer = setInterval(
    () =>
      void pollNodesAndRepair().catch((error) =>
        log('error', 'health_poll_failed', { error: String(error) }),
      ),
    15000,
  );
  timer.unref();
}
