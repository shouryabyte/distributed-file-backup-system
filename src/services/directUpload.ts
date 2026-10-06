import { splitChunks } from '../chunking/chunks.js';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import * as uploads from './uploads.js';

export async function uploadStream(
  userId: string,
  fileName: string,
  size: number,
  input: AsyncIterable<Buffer>,
) {
  const session = await uploads.initiate(userId, fileName, size);
  let sequence = 0;
  for await (const chunk of splitChunks(input, env.CHUNK_SIZE_BYTES)) {
    sequence++;
    await uploads.stageChunk(userId, session.id, sequence, chunk);
  }
  if (sequence !== session.total_chunks)
    throw new AppError(400, 'SIZE_MISMATCH', 'Uploaded bytes do not match Content-Length');
  return uploads.complete(userId, session.id);
}
