import { NextRequest } from 'next/server';
import {
  backendToken,
  backendUrl,
  currentUser,
  errorResponse,
  sameOrigin,
  upstreamFailure,
} from '@/lib/server/backend';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  if (!sameOrigin(request)) return errorResponse(403, 'FORBIDDEN', 'Invalid request origin.');
  if (!(await currentUser(backendToken(request)))) {
    return errorResponse(401, 'UNAUTHORIZED', 'Sign in to continue.');
  }
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id))
    return errorResponse(400, 'VALIDATION_ERROR', 'Invalid node ID.');
  let enabled: unknown;
  try {
    enabled = (await request.json()).enabled;
  } catch {
    return errorResponse(400, 'INVALID_JSON', 'Invalid request body.');
  }
  if (typeof enabled !== 'boolean') {
    return errorResponse(400, 'VALIDATION_ERROR', 'Enabled must be a boolean.');
  }
  try {
    const action = enabled ? 'enable' : 'disable';
    const response = await fetch(backendUrl(`/internal/storage-nodes/${id}/${action}`), {
      method: 'POST',
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
