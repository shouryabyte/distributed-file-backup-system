import express from 'express';
import { randomUUID } from 'node:crypto';
import { authRouter } from './routes/auth.js';
import { fileRouter } from './routes/files.js';
import { uploadRouter } from './routes/uploads.js';
import { internalRouter } from './routes/internal.js';
import { errorHandler } from './middleware/errors.js';
import { log } from './utils/log.js';
import {
  registry,
  httpRequests,
  httpLatency,
  uploadRequests,
  downloadRequests,
  uploadLatency,
  downloadLatency,
} from './monitoring/metrics.js';
import { rateLimit } from './middleware/rateLimit.js';
import { env } from './config/env.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    const start = performance.now();
    res.on('finish', () => {
      const duration = (performance.now() - start) / 1000;
      const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : 'unmatched';
      httpRequests.inc({ method: req.method, route, status: String(res.statusCode) });
      httpLatency.observe({ method: req.method, route }, duration);
      if (req.path === '/api/files/upload') {
        uploadRequests.inc();
        uploadLatency.observe(duration);
      }
      if (req.path.endsWith('/download')) {
        downloadRequests.inc();
        downloadLatency.observe(duration);
      }
      log('info', 'http_request', {
        requestId: req.requestId,
        userId: req.userId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Math.round(duration * 1000),
      });
    });
    next();
  });
  app.use(express.json({ limit: '64kb' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/metrics', async (_req, res) => {
    res.setHeader('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });
  app.use('/api', rateLimit(env.API_RATE_LIMIT_PER_MINUTE));
  app.use('/api/auth', authRouter);
  app.use('/api/files', fileRouter);
  app.use('/api/uploads', uploadRouter);
  app.use('/internal', internalRouter);
  app.use((_req, res) =>
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }),
  );
  app.use(errorHandler);
  return app;
}
