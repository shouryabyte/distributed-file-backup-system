import { NextRequest, NextResponse } from 'next/server';
import {
  backendToken,
  backendUrl,
  currentUser,
  errorResponse,
  sameOrigin,
  sessionCookie,
  upstreamFailure,
} from '@/lib/server/backend';

export const runtime = 'nodejs';

type Context = { params: Promise<{ action: string }> };

export async function GET(request: NextRequest, context: Context) {
  const { action } = await context.params;
  if (action !== 'me') return errorResponse(404, 'NOT_FOUND', 'Route not found.');
  const user = await currentUser(backendToken(request));
  if (!user) {
    const response = NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Sign in to continue.' } },
      { status: 401 },
    );
    response.cookies.delete(sessionCookie);
    return response;
  }
  return NextResponse.json(user);
}

export async function POST(request: NextRequest, context: Context) {
  if (!sameOrigin(request)) return errorResponse(403, 'FORBIDDEN', 'Invalid request origin.');
  const { action } = await context.params;
  if (action === 'logout') {
    const response = new NextResponse(null, { status: 204 });
    response.cookies.delete(sessionCookie);
    return response;
  }
  if (action !== 'login' && action !== 'register') {
    return errorResponse(404, 'NOT_FOUND', 'Route not found.');
  }
  try {
    const upstream = await fetch(backendUrl(`/api/auth/${action}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: await request.text(),
      cache: 'no-store',
    });
    const payload = await upstream.json();
    if (!upstream.ok) return NextResponse.json(payload, { status: upstream.status });
    if (typeof payload.token !== 'string' || !payload.user) return upstreamFailure();
    const response = NextResponse.json({ user: payload.user }, { status: upstream.status });
    response.cookies.set(sessionCookie, payload.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'true',
      path: '/',
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch {
    return upstreamFailure();
  }
}
