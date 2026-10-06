import Redis from 'ioredis';
import { env } from '../config/env.js';
import { cacheHits, cacheMisses } from '../monitoring/metrics.js';

const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: 700,
  retryStrategy: () => null,
});
redis.on('error', () => undefined);
let connecting: Promise<void> | undefined;
async function ready() {
  if (redis.status === 'ready') return;
  connecting ??= redis
    .connect()
    .then(() => undefined)
    .finally(() => {
      connecting = undefined;
    });
  await connecting;
}
export async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  try {
    await ready();
    const value = await redis.get(key);
    if (value !== null) {
      cacheHits.inc();
      return JSON.parse(value) as T;
    }
  } catch {
    /* PostgreSQL remains authoritative. */
  }
  cacheMisses.inc();
  const value = await load();
  try {
    await ready();
    await redis.set(key, JSON.stringify(value), 'EX', env.CACHE_TTL_SECONDS);
  } catch {
    /* Cache outage must not fail the request. */
  }
  return value;
}
export async function invalidate(key: string) {
  try {
    await ready();
    await redis.del(key);
  } catch {
    /* Best effort. */
  }
}
