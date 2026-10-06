import { createHash } from 'node:crypto';

export function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export async function* splitChunks(
  input: AsyncIterable<Buffer> | Iterable<Buffer>,
  size: number,
): AsyncGenerator<Buffer> {
  let pending = Buffer.alloc(0);
  for await (const part of input) {
    let offset = 0;
    while (offset < part.length) {
      const take = Math.min(size - pending.length, part.length - offset);
      pending = Buffer.concat([pending, part.subarray(offset, offset + take)]);
      offset += take;
      if (pending.length === size) {
        yield pending;
        pending = Buffer.alloc(0);
      }
    }
  }
  if (pending.length) yield pending;
}
