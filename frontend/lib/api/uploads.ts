import { ApiError, apiRequest, jsonBody, readError } from './client';
import type { UploadResult } from '@/lib/types';

export function uploadDirect(
  file: File,
  onProgress: (percent: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', '/api/backend/files/upload');
    request.withCredentials = true;
    request.setRequestHeader('Content-Type', 'application/octet-stream');
    request.setRequestHeader('x-file-name', file.name);
    request.setRequestHeader('x-file-size', String(file.size));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () =>
      reject(new ApiError(0, 'NETWORK_ERROR', 'The server could not be reached.'));
    request.onload = async () => {
      if (request.status < 200 || request.status >= 300) {
        reject(await readError(new Response(request.responseText, { status: request.status })));
        return;
      }
      try {
        resolve(JSON.parse(request.responseText) as UploadResult);
      } catch {
        reject(
          new ApiError(502, 'INVALID_RESPONSE', 'The server returned an invalid upload response.'),
        );
      }
    };
    request.send(file);
  });
}

export interface UploadSession {
  id: string;
  file_name: string;
  file_size: string;
  total_chunks: number;
  status: string;
}

export interface UploadStatus {
  id: string;
  status: string;
  fileId: string | null;
  uploadedChunks: number[];
  missingChunks: number[];
}

export const resumableApi = {
  initiate: (file: File) =>
    apiRequest<UploadSession>('/api/backend/uploads/initiate', {
      method: 'POST',
      ...jsonBody({ fileName: file.name, fileSize: file.size }),
    }),
  status: (id: string) => apiRequest<UploadStatus>(`/api/backend/uploads/${id}/status`),
  chunk: (id: string, sequence: number, data: Blob) =>
    apiRequest<{ hash: string; deduplicated: boolean }>(
      `/api/backend/uploads/${id}/chunks?sequence=${sequence}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-file-size': String(data.size),
        },
        body: data,
      },
    ),
  complete: (id: string) =>
    apiRequest<UploadResult>(`/api/backend/uploads/${id}/complete`, { method: 'POST' }),
};
