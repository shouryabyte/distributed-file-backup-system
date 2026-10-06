import type { Node } from './client.js';
import { listNodes } from '../repositories/nodes.js';
import { AppError } from '../errors/AppError.js';

export function placement(hash: string, nodes: Node[]): Node[] {
  const healthy = nodes
    .filter((n) => n.enabled && n.healthy)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!healthy.length) return [];
  const start = Number.parseInt(hash.slice(0, 8), 16) % healthy.length;
  return [...healthy.slice(start), ...healthy.slice(0, start)];
}
export async function primaryFor(hash: string, available?: Node[]): Promise<Node> {
  const node = placement(hash, available ?? (await listNodes()))[0];
  if (!node) throw new AppError(503, 'NO_STORAGE_NODE', 'No healthy storage node is available');
  return node;
}
