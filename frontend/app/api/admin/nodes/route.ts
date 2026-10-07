import { NextRequest } from 'next/server';
import {
  backendToken,
  backendUrl,
  currentUser,
  errorResponse,
  upstreamFailure,
} from '@/lib/server/backend';

export async function GET(request: NextRequest) {
  if (!(await currentUser(backendToken(request)))) {
    return errorResponse(401, 'UNAUTHORIZED', 'Sign in to continue.');
  }
  try {
    const response = await fetch(backendUrl('/internal/storage-nodes'), {
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
