import client from 'prom-client';

client.collectDefaultMetrics();
export const registry = client.register;
export const uploadRequests = new client.Counter({
  name: 'upload_requests_total',
  help: 'Upload requests',
});
export const downloadRequests = new client.Counter({
  name: 'download_requests_total',
  help: 'Download requests',
});
export const uploadLatency = new client.Histogram({
  name: 'upload_latency_seconds',
  help: 'Upload latency',
  buckets: [0.01, 0.1, 0.5, 1, 5, 15, 60],
});
export const downloadLatency = new client.Histogram({
  name: 'download_latency_seconds',
  help: 'Download latency',
  buckets: [0.01, 0.1, 0.5, 1, 5, 15, 60],
});
export const chunksCreated = new client.Counter({
  name: 'chunks_created_total',
  help: 'New chunks',
});
export const dedupHits = new client.Counter({
  name: 'deduplication_hits_total',
  help: 'Reused chunks',
});
export const dedupRatio = new client.Gauge({
  name: 'deduplication_ratio',
  help: 'Deduplication hits divided by all staged chunks',
});
export const replicationSuccess = new client.Counter({
  name: 'replication_success_total',
  help: 'Successful replica writes',
});
export const replicationFailure = new client.Counter({
  name: 'replication_failure_total',
  help: 'Failed replica operations',
});
export const workerRetry = new client.Counter({
  name: 'worker_retry_total',
  help: 'Worker retries',
  labelNames: ['worker'],
});
export const workerFailure = new client.Counter({
  name: 'worker_failure_total',
  help: 'Dead-lettered events',
  labelNames: ['worker'],
});
export const integrityFailure = new client.Counter({
  name: 'integrity_failure_total',
  help: 'Damaged replicas',
});
export const cacheHits = new client.Counter({ name: 'redis_cache_hits_total', help: 'Redis hits' });
export const cacheMisses = new client.Counter({
  name: 'redis_cache_misses_total',
  help: 'Redis misses',
});
export const nodeHealth = new client.Gauge({
  name: 'storage_node_health',
  help: 'Healthy enabled node',
  labelNames: ['node_id'],
});
export const activeUploads = new client.Gauge({
  name: 'active_uploads',
  help: 'Open upload sessions',
});
export const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'API requests',
  labelNames: ['method', 'route', 'status'],
});
export const httpLatency = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'API latency',
  labelNames: ['method', 'route'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 30],
});

let created = 0,
  reused = 0;
export function recordChunk(deduplicated: boolean) {
  if (deduplicated) {
    dedupHits.inc();
    reused++;
  } else {
    chunksCreated.inc();
    created++;
  }
  dedupRatio.set(reused / (created + reused));
}
