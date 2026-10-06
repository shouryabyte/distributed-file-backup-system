import type pg from 'pg';
import { pool } from '../config/db.js';

export interface FileRow {
  id: string;
  user_id: string;
  file_name: string;
  file_size: string;
  total_chunks: number;
  status: string;
  created_at: Date;
}
export interface ChunkRow {
  id: string;
  hash: string;
  size: number;
  sequence_number: number;
}
export interface ReplicaRow {
  id: string;
  node_id: string;
  url: string;
  enabled: boolean;
  healthy: boolean;
  status: string;
}

export async function listFiles(userId: string): Promise<FileRow[]> {
  return (
    await pool.query<FileRow>('SELECT * FROM files WHERE user_id=$1 ORDER BY created_at DESC', [
      userId,
    ])
  ).rows;
}
export async function getFile(id: string, userId: string): Promise<FileRow | undefined> {
  return (await pool.query<FileRow>('SELECT * FROM files WHERE id=$1 AND user_id=$2', [id, userId]))
    .rows[0];
}
export async function getOrderedChunks(fileId: string): Promise<ChunkRow[]> {
  return (
    await pool.query<ChunkRow>(
      'SELECT c.id,c.hash,c.size,fc.sequence_number FROM file_chunks fc JOIN chunks c ON c.id=fc.chunk_id WHERE fc.file_id=$1 ORDER BY fc.sequence_number',
      [fileId],
    )
  ).rows;
}
export async function getReplicas(chunkId: string): Promise<ReplicaRow[]> {
  return (
    await pool.query<ReplicaRow>(
      'SELECT cr.id,cr.node_id,n.url,n.enabled,n.healthy,cr.status FROM chunk_replicas cr JOIN storage_nodes n ON n.id=cr.node_id WHERE cr.chunk_id=$1 ORDER BY n.id',
      [chunkId],
    )
  ).rows;
}
export async function lockHash(client: pg.PoolClient, hash: string): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [hash]);
}
export async function enqueue(
  client: pg.PoolClient,
  topic: string,
  key: string,
  payload: object,
): Promise<void> {
  await client.query('INSERT INTO outbox(topic,event_key,payload) VALUES($1,$2,$3)', [
    topic,
    key,
    JSON.stringify(payload),
  ]);
}
