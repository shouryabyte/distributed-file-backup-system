import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  JWT_SECRET: z.string().min(16),
  INTERNAL_TOKEN: z.string().min(16),
  CHUNK_SIZE_BYTES: z.coerce.number().int().positive().default(5242880),
  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(1073741824),
  REPLICATION_FACTOR: z.coerce.number().int().positive().default(3),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  API_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(1000),
  WORKER_MAX_RETRIES: z.coerce.number().int().nonnegative().default(3),
  STORAGE_NODES: z
    .string()
    .default(
      'node-1:http://localhost:3101,node-2:http://localhost:3102,node-3:http://localhost:3103',
    ),
});

export const env = schema.parse(process.env);
