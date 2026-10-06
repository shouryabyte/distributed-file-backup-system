import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from './config/db.js';
import { log } from './utils/log.js';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(14271987)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const dir = path.join(process.cwd(), 'migrations');
    for (const name of (await readdir(dir)).filter((n) => n.endsWith('.sql')).sort()) {
      if ((await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name])).rowCount)
        continue;
      await client.query('BEGIN');
      try {
        await client.query(await readFile(path.join(dir, name), 'utf8'));
        await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
        await client.query('COMMIT');
        log('info', 'migration_applied', { name });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(14271987)');
    client.release();
    await pool.end();
  }
}
main().catch((error) => {
  log('error', 'migration_failed', { error: String(error) });
  process.exitCode = 1;
});
