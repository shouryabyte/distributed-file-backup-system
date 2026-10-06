import { Kafka, logLevel } from 'kafkajs';
import { env } from '../config/env.js';

export const kafka = new Kafka({
  clientId: 'backup-system',
  brokers: env.KAFKA_BROKERS.split(','),
  logLevel: logLevel.ERROR,
});
export const topics = [
  'replication-events',
  'verification-events',
  'cleanup-events',
  'dead-letter-events',
] as const;
export async function ensureTopics() {
  const admin = kafka.admin();
  await admin.connect();
  try {
    const existing = new Set(await admin.listTopics());
    const missing = topics.filter((topic) => !existing.has(topic));
    if (missing.length) {
      await admin.createTopics({
        waitForLeaders: true,
        topics: missing.map((topic) => ({ topic, numPartitions: 3, replicationFactor: 1 })),
      });
    }
  } finally {
    await admin.disconnect();
  }
}
