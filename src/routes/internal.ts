import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { getNode, listNodes, setEnabled, setHealth } from '../repositories/nodes.js';
import { scheduleUnderReplicated } from '../services/health.js';
import { isHealthy } from '../storage/client.js';
import { pool } from '../config/db.js';

export const internalRouter = Router();
internalRouter.use((req, _res, next) =>
  req.header('x-internal-token') === env.INTERNAL_TOKEN
    ? next()
    : next(new AppError(401, 'UNAUTHORIZED', 'Internal token required')),
);
internalRouter.get('/storage-nodes', async (_req, res) => {
  res.json(await listNodes());
});
internalRouter.get('/chunks/:hash', async (req, res) => {
  const hash = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(req.params.hash);
  const chunk = (
    await pool.query<{ id: string; hash: string; size: number; reference_count: string }>(
      'SELECT id,hash,size,reference_count FROM chunks WHERE hash=$1',
      [hash],
    )
  ).rows[0];
  if (!chunk) throw new AppError(404, 'CHUNK_NOT_FOUND', 'Chunk not found');
  const replicas = (
    await pool.query<{ node_id: string; status: string; enabled: boolean; healthy: boolean }>(
      'SELECT r.node_id,r.status,n.enabled,n.healthy FROM chunk_replicas r JOIN storage_nodes n ON n.id=r.node_id WHERE r.chunk_id=$1 ORDER BY r.node_id',
      [chunk.id],
    )
  ).rows;
  res.json({ ...chunk, replicas });
});
internalRouter.get('/storage-nodes/:id', async (req, res) => {
  const node = await getNode(z.string().min(1).parse(req.params.id));
  if (!node) throw new AppError(404, 'NODE_NOT_FOUND', 'Storage node not found');
  res.json(node);
});
for (const [action, enabled] of [
  ['disable', false],
  ['enable', true],
] as const) {
  internalRouter.post(`/storage-nodes/:id/${action}`, async (req, res) => {
    const node = await setEnabled(z.string().min(1).parse(req.params.id), enabled);
    if (!node) throw new AppError(404, 'NODE_NOT_FOUND', 'Storage node not found');
    await setHealth(node.id, enabled && (await isHealthy(node)));
    await scheduleUnderReplicated();
    res.json(await getNode(node.id));
  });
}
