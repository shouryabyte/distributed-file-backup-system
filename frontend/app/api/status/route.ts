import { backendUrl, upstreamFailure } from '@/lib/server/backend';

export async function GET() {
  try {
    const response = await fetch(backendUrl('/health'), { cache: 'no-store' });
    return Response.json({ healthy: response.ok }, { status: response.ok ? 200 : 503 });
  } catch {
    return upstreamFailure();
  }
}
