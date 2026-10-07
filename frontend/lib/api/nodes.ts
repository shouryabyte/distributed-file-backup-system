import { apiRequest } from './client';
import type { InspectedChunk, StorageNode } from '@/lib/types';

export const nodesApi = {
  list: () => apiRequest<StorageNode[]>('/api/admin/nodes'),
  setEnabled: (id: string, enabled: boolean) =>
    apiRequest<StorageNode>(`/api/admin/nodes/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }),
  chunk: (fileId: string, hash: string) =>
    apiRequest<InspectedChunk>(
      `/api/admin/chunks/${encodeURIComponent(hash)}?fileId=${encodeURIComponent(fileId)}`,
    ),
};
