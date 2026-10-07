import { NextRequest } from 'next/server';
import type { FileChunk } from '@/lib/types';
import {
  backendToken,
  backendUrl,
  currentUser,
  errorResponse,
  upstreamFailure,
} from '@/lib/server/backend';

type Context = { params: Promise<{ hash: string }> };

export async function GET(request: NextRequest, context: Context) {
  const token = backendToken(request);
  if (!(await currentUser(token))) {
    return errorResponse(401, 'UNAUTHORIZED', 'Sign in to continue.');
  }
  const { hash } = await context.params;
  const fileId = request.nextUrl.searchParams.get('fileId');
  if (!/^[a-f0-9]{64}$/.test(hash) || !fileId || !/^[0-9a-fA-F-]{36}$/.test(fileId)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Invalid file or chunk identifier.');
  }
  try {
    const ownedFile = await fetch(backendUrl(`/api/files/${fileId}/chunks`), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!ownedFile.ok) {
      return errorResponse(ownedFile.status, 'FILE_NOT_FOUND', 'File not found.');
    }
    const chunks = (await ownedFile.json()) as FileChunk[];
    if (!chunks.some((chunk) => chunk.hash === hash)) {
      return errorResponse(404, 'CHUNK_NOT_FOUND', 'Chunk not found in this file.');
    }
    const response = await fetch(backendUrl(`/internal/chunks/${hash}`), {
      headers: { 'x-internal-token': process.env.INTERNAL_TOKEN ?? '' },
      cache: 'no-store',
    });
    return new Response(response.body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return upstreamFailure();
  }
}
