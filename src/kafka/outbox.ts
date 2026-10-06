import { pool } from '../config/db.js';
import { kafka } from './client.js';
import { log } from '../utils/log.js';

export async function dispatchOutbox(): Promise<void> {
  const producer = kafka.producer();
  await producer.connect();
  try {
    while (true) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const rows = (
          await client.query<{ id: string; topic: string; event_key: string; payload: object }>(
            'SELECT id,topic,event_key,payload FROM outbox WHERE sent_at IS NULL ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED',
          )
        ).rows;
        if (!rows.length) {
          await client.query('COMMIT');
          break;
        }
        for (const row of rows) {
          await producer.send({
            topic: row.topic,
            messages: [{ key: row.event_key, value: JSON.stringify(row.payload) }],
          });
          await client.query('UPDATE outbox SET sent_at=now() WHERE id=$1', [row.id]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  } finally {
    await producer.disconnect();
  }
}

export function startOutboxLoop() {
  const timer = setInterval(
    () =>
      dispatchOutbox().catch((error) =>
        log('error', 'outbox_dispatch_failed', { error: String(error) }),
      ),
    1000,
  );
  timer.unref();
}
