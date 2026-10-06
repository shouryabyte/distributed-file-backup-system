import { pool } from '../config/db.js';

export interface UploadRow {
  id: string;
  user_id: string;
  file_name: string;
  file_size: string;
  total_chunks: number;
  status: string;
  file_id: string | null;
}
export interface UploadChunkRow {
  sequence_number: number;
  chunk_hash: string;
  size: number;
}
export async function createUpload(
  userId: string,
  name: string,
  size: number,
  total: number,
): Promise<UploadRow> {
  return (
    await pool.query<UploadRow>(
      "INSERT INTO upload_sessions(user_id,file_name,file_size,total_chunks,status) VALUES($1,$2,$3,$4,'OPEN') RETURNING *",
      [userId, name, size, total],
    )
  ).rows[0];
}
export async function getUpload(id: string, userId: string): Promise<UploadRow | undefined> {
  return (
    await pool.query<UploadRow>('SELECT * FROM upload_sessions WHERE id=$1 AND user_id=$2', [
      id,
      userId,
    ])
  ).rows[0];
}
export async function listUploadChunks(id: string): Promise<UploadChunkRow[]> {
  return (
    await pool.query<UploadChunkRow>(
      'SELECT sequence_number,chunk_hash,size FROM upload_chunks WHERE upload_id=$1 ORDER BY sequence_number',
      [id],
    )
  ).rows;
}
