import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import type { Node } from '../storage/client.js';
import { cached, invalidate } from '../cache/redis.js';

export async function seedNodes(): Promise<void> {
  for (const entry of env.STORAGE_NODES.split(',')) {
    const split = entry.indexOf(':');
    const id = entry.slice(0, split),
      url = entry.slice(split + 1);
    if (!id || !url) throw new Error(`Invalid STORAGE_NODES entry: ${entry}`);
    await pool.query(
      'INSERT INTO storage_nodes(id,url) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET url=EXCLUDED.url',
      [id, url],
    );
  }
}
export async function listNodes(): Promise<Node[]> {
  return (await pool.query<Node>('SELECT id,url,enabled,healthy FROM storage_nodes ORDER BY id'))
    .rows;
}
export async function getNode(id: string): Promise<Node | undefined> {
  return cached(
    `node:${id}`,
    async () =>
      (await pool.query<Node>('SELECT id,url,enabled,healthy FROM storage_nodes WHERE id=$1', [id]))
        .rows[0],
  );
}
export async function setEnabled(id: string, enabled: boolean): Promise<Node | undefined> {
  const result = (
    await pool.query<Node>(
      'UPDATE storage_nodes SET enabled=$2 WHERE id=$1 RETURNING id,url,enabled,healthy',
      [id, enabled],
    )
  ).rows[0];
  await invalidate(`node:${id}`);
  return result;
}
export async function setHealth(id: string, healthy: boolean): Promise<void> {
  await pool.query('UPDATE storage_nodes SET healthy=$2,checked_at=now() WHERE id=$1', [
    id,
    healthy,
  ]);
  await invalidate(`node:${id}`);
}
