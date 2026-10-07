import type { Producer } from 'kafkajs';
import { withTransaction } from '../config/db.js';
import { kafka } from './client.js';
import { log } from '../utils/log.js';

async function sendBatch(producer: Producer): Promise<boolean> {
  return withTransaction(async (client) => {
    const rows = (
      await client.query<{ id: string; topic: string; event_key: string; payload: object }>(
        'SELECT id,topic,event_key,payload FROM outbox WHERE sent_at IS NULL ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED',
      )
    ).rows;
    for (const row of rows) {
      await producer.send({
        topic: row.topic,
        messages: [{ key: row.event_key, value: JSON.stringify(row.payload) }],
      });
      await client.query('UPDATE outbox SET sent_at=now() WHERE id=$1', [row.id]);
    }
    return rows.length > 0;
  });
}

export async function dispatchOutbox(): Promise<void> {
  const producer = kafka.producer();
  await producer.connect();
  try {
    while (true) {
      const foundEvents = await sendBatch(producer);
      if (!foundEvents) break;
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
