import { apiRequest } from './client';
import type { FileChunk, FileRecord } from '@/lib/types';

const base = '/api/backend/files';

export const filesApi = {
  list: () => apiRequest<FileRecord[]>(base),
  detail: (id: string) => apiRequest<FileRecord>(`${base}/${encodeURIComponent(id)}`),
  chunks: (id: string) => apiRequest<FileChunk[]>(`${base}/${encodeURIComponent(id)}/chunks`),
  verify: (id: string) =>
    apiRequest<{ queued: number }>(`${base}/${encodeURIComponent(id)}/verify`, {
      method: 'POST',
    }),
  remove: (id: string) =>
    apiRequest<void>(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  downloadUrl: (id: string) => `${base}/${encodeURIComponent(id)}/download`,
};
