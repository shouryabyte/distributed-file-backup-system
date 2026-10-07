import 'server-only';
import type { NextRequest } from 'next/server';

export const sessionCookie = 'backup_session';

export function backendUrl(path: string): string {
  const base = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';
  return new URL(path, base).toString();
}

export function backendToken(request: NextRequest): string | undefined {
  return request.cookies.get(sessionCookie)?.value;
}

export async function currentUser(token?: string): Promise<{ id: string; email: string } | null> {
  if (!token) return null;
  try {
    const response = await fetch(backendUrl('/api/auth/me'), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as { id: string; email: string };
  } catch {
    return null;
  }
}

export function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}

export function upstreamFailure(): Response {
  return errorResponse(503, 'NETWORK_ERROR', 'The API is unavailable.');
}
