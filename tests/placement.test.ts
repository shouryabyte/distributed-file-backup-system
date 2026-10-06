import { placement } from '../src/storage/manager.js';
import type { Node } from '../src/storage/client.js';

const nodes: Node[] = ['node-1', 'node-2', 'node-3', 'node-4'].map((id) => ({
  id,
  url: `http://${id}`,
  enabled: true,
  healthy: true,
}));
test('placement is deterministic, distinct, and skips disabled nodes', () => {
  const hash = 'abcdef1234567890';
  const first = placement(hash, nodes).map((n) => n.id);
  expect(placement(hash, [...nodes].reverse()).map((n) => n.id)).toEqual(first);
  expect(new Set(first).size).toBe(4);
  const disabled = nodes.map((n) => (n.id === first[1] ? { ...n, enabled: false } : n));
  expect(placement(hash, disabled).map((n) => n.id)).not.toContain(first[1]);
});
