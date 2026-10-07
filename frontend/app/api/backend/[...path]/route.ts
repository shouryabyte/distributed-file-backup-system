import { NextRequest, NextResponse } from 'next/server';
import {
  backendToken,
  backendUrl,
  errorResponse,
  sameOrigin,
  sessionCookie,
  upstreamFailure,
} from '@/lib/server/backend';

export const runtime = 'nodejs';

type Context = { params: Promise<{ path: string[] }> };
const uuid = '[0-9a-fA-F-]{36}';
const routes: Record<string, RegExp[]> = {
  GET: [
    /^files$/,
    new RegExp(`^files/${uuid}$`),
    new RegExp(`^files/${uuid}/chunks$`),
    new RegExp(`^files/${uuid}/download$`),
    new RegExp(`^uploads/${uuid}/status$`),
  ],
  POST: [
    /^files\/upload$/,
    new RegExp(`^files/${uuid}/verify$`),
    /^uploads\/initiate$/,
    new RegExp(`^uploads/${uuid}/chunks$`),
    new RegExp(`^uploads/${uuid}/complete$`),
  ],
  DELETE: [new RegExp(`^files/${uuid}$`)],
};

async function proxy(request: NextRequest, context: Context) {
  const path = (await context.params).path.join('/');
  if (!routes[request.method]?.some((pattern) => pattern.test(path))) {
    return errorResponse(404, 'NOT_FOUND', 'Route not found.');
  }
  if (request.method !== 'GET' && !sameOrigin(request)) {
    return errorResponse(403, 'FORBIDDEN', 'Invalid request origin.');
  }
  const token = backendToken(request);
  if (!token) return errorResponse(401, 'UNAUTHORIZED', 'Sign in to continue.');

  const headers = new Headers({ Authorization: `Bearer ${token}` });
  const isBinary = request.method === 'POST' && (path === 'files/upload' || /\/chunks$/.test(path));
  if (isBinary) {
    const size = request.headers.get('x-file-size') ?? request.headers.get('content-length');
    const maxSize = Number(process.env.MAX_FILE_SIZE_BYTES ?? 1073741824);
    if (!size || !/^\d+$/.test(size) || Number(size) > maxSize) {
      return errorResponse(413, 'FILE_TOO_LARGE', 'Invalid or excessive upload size.');
    }
    if (request.headers.get('content-length') && request.headers.get('content-length') !== size) {
      return errorResponse(400, 'SIZE_MISMATCH', 'Upload size does not match the request body.');
    }
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Content-Length', size);
    if (path === 'files/upload') {
      const fileName = request.headers.get('x-file-name');
      if (!fileName) return errorResponse(400, 'VALIDATION_ERROR', 'File name is required.');
      headers.set('x-file-name', fileName);
    }
  } else if (request.method === 'POST' && request.headers.get('content-type')) {
    headers.set('Content-Type', 'application/json');
  }

  const query = request.nextUrl.search;
  try {
    const upstream = await fetch(backendUrl(`/api/${path}${query}`), {
      method: request.method,
      headers,
      body: request.method === 'POST' ? request.body : undefined,
      duplex: request.method === 'POST' ? 'half' : undefined,
      cache: 'no-store',
    } as RequestInit & { duplex?: 'half' });
    const responseHeaders = new Headers();
    for (const name of ['content-type', 'content-length', 'content-disposition']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set('Cache-Control', 'no-store');
    const response = new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
    if (upstream.status === 401) response.cookies.delete(sessionCookie);
    return response;
  } catch {
    return upstreamFailure();
  }
}

export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
