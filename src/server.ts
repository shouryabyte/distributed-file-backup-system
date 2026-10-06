import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { seedNodes } from './repositories/nodes.js';
import { log } from './utils/log.js';
import { ensureTopics } from './kafka/client.js';
import { startOutboxLoop } from './kafka/outbox.js';
import { startHealthLoop } from './services/health.js';

async function main() {
  await pool.query('SELECT 1');
  await seedNodes();
  await ensureTopics();
  startOutboxLoop();
  startHealthLoop();
  createApp().listen(env.PORT, () => log('info', 'api_started', { port: env.PORT }));
}
main().catch((error) => {
  log('error', 'api_start_failed', { error: String(error) });
  process.exitCode = 1;
});
