import { kafka } from '../kafka/client.js';
import { env } from '../config/env.js';
import { log } from '../utils/log.js';
import { workerRetry, workerFailure } from '../monitoring/metrics.js';

export async function withRetry(
  event: Record<string, unknown>,
  handler: () => Promise<void>,
  heartbeat: () => Promise<void> = async () => undefined,
) {
  let lastError = '';
  for (let attempt = 0; attempt <= env.WORKER_MAX_RETRIES; attempt++) {
    try {
      await heartbeat();
      await handler();
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < env.WORKER_MAX_RETRIES) {
        log('warn', 'worker_retry', {
          eventType: event.eventType,
          attemptCount: attempt + 1,
          lastError,
          lastAttemptAt: new Date().toISOString(),
        });
        workerRetry.inc({ worker: String(process.env.WORKER_KIND ?? 'unknown') });
        for (let second = 0; second < 2 ** attempt; second++) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await heartbeat();
        }
      }
    }
  }
  const producer = kafka.producer();
  await producer.connect();
  try {
    await producer.send({
      topic: 'dead-letter-events',
      messages: [
        {
          key: String(event.chunkHash ?? ''),
          value: JSON.stringify({
            ...event,
            attemptCount: env.WORKER_MAX_RETRIES + 1,
            lastError,
            lastAttemptAt: new Date().toISOString(),
          }),
        },
      ],
    });
  } finally {
    await producer.disconnect();
  }
  log('error', 'worker_dead_letter', {
    eventType: event.eventType,
    attemptCount: env.WORKER_MAX_RETRIES + 1,
    lastError,
  });
  workerFailure.inc({ worker: String(process.env.WORKER_KIND ?? 'unknown') });
}
