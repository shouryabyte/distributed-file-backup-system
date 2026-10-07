import type { ApiErrorBody } from '@/lib/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const messages: Record<string, string> = {
  UNAUTHORIZED: 'Your session has expired. Please sign in again.',
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  EMAIL_EXISTS: 'That email is already registered.',
  FILE_NOT_FOUND: 'This file could not be found.',
  UPLOAD_NOT_FOUND: 'This upload session could not be found.',
  CHUNK_UNAVAILABLE: 'A required chunk is unavailable. Try again after repair.',
  STORAGE_UNAVAILABLE: 'A storage node is unavailable. Please try again.',
  VALIDATION_ERROR: 'Please check the information you entered.',
  NETWORK_ERROR: 'The server could not be reached. Check that the stack is running.',
};

export async function readError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  const code = body.error?.code ?? 'REQUEST_FAILED';
  return new ApiError(
    response.status,
    code,
    messages[code] ?? body.error?.message ?? 'Request failed.',
  );
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', messages.NETWORK_ERROR);
  }
  if (!response.ok) {
    const error = await readError(response);
    if (error.status === 401 && !path.startsWith('/api/session/')) {
      window.dispatchEvent(new Event('vaultline:unauthorized'));
    }
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function jsonBody(value: unknown): RequestInit {
  return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) };
}
