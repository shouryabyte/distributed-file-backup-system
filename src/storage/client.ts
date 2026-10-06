import { AppError } from '../errors/AppError.js';
import { env } from '../config/env.js';

export interface Node {
  id: string;
  url: string;
  enabled: boolean;
  healthy: boolean;
}
const headers = { 'x-internal-token': env.INTERNAL_TOKEN };

async function request(node: Node, hash: string, method: string, data?: Buffer): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(`${node.url}/internal/chunks/${hash}`, {
      method,
      headers,
      body: data ? Uint8Array.from(data) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
export async function putChunk(node: Node, hash: string, data: Buffer): Promise<void> {
  const response = await request(node, hash, 'PUT', data);
  if (!response.ok)
    throw new AppError(503, 'STORAGE_UNAVAILABLE', `Storage write failed on ${node.id}`);
}
export async function getChunk(node: Node, hash: string): Promise<Buffer> {
  const response = await request(node, hash, 'GET');
  if (!response.ok)
    throw new AppError(503, 'STORAGE_UNAVAILABLE', `Storage read failed on ${node.id}`);
  return Buffer.from(await response.arrayBuffer());
}
export async function deleteChunk(node: Node, hash: string): Promise<void> {
  const response = await request(node, hash, 'DELETE');
  if (!response.ok)
    throw new AppError(503, 'STORAGE_UNAVAILABLE', `Storage delete failed on ${node.id}`);
}
export async function isHealthy(node: Node): Promise<boolean> {
  try {
    const response = await fetch(`${node.url}/internal/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
