import { kafka } from '../kafka/client.js';
import { withRetry } from './retry.js';
import { replicateChunk } from './replication.js';
import { verifyChunk } from './integrity.js';
import { cleanupChunk } from './cleanup.js';
import { log } from '../utils/log.js';
import { createServer } from 'node:http';
import { registry } from '../monitoring/metrics.js';
import { pool } from '../config/db.js';

const kind = process.env.WORKER_KIND;
const handlers = {
  replication: { topic: 'replication-events', fn: replicateChunk },
  integrity: { topic: 'verification-events', fn: verifyChunk },
  cleanup: { topic: 'cleanup-events', fn: cleanupChunk },
};
if (!kind || !(kind in handlers)) throw new Error('Invalid WORKER_KIND');
const config = handlers[kind as keyof typeof handlers];
async function main() {
  const metricsServer = createServer(async (req, res) => {
    if (req.url !== '/metrics') {
      res.writeHead(404).end();
      return;
    }
    res.setHeader('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  }).listen(9090);
  const consumer = kafka.consumer({ groupId: `${kind}-worker`, sessionTimeout: 120000 });
  const shutdown = async () => {
    try {
      await consumer.disconnect();
      metricsServer.close();
      await pool.end();
    } catch (error) {
      log('error', 'worker_shutdown_failed', { kind, error: String(error) });
      process.exitCode = 1;
    }
  };
  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());
  await consumer.connect();
  await consumer.subscribe({ topic: config.topic, fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ message, heartbeat }) => {
      if (!message.value) return;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(message.value.toString()) as Record<string, unknown>;
        if (typeof event.chunkId !== 'string' || typeof event.chunkHash !== 'string')
          throw new Error('Invalid event');
      } catch {
        await withRetry(
          { eventType: 'INVALID_EVENT' },
          async () => {
            throw new Error('Invalid event payload');
          },
          heartbeat,
        );
        return;
      }
      await withRetry(
        event,
        async () => {
          await config.fn(event.chunkId as string, event.chunkHash as string);
        },
        heartbeat,
      );
    },
  });
  log('info', 'worker_started', { kind });
}
main().catch((error) => {
  log('error', 'worker_start_failed', { kind, error: String(error) });
  process.exitCode = 1;
});
