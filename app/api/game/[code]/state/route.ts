import { NextRequest } from 'next/server';
import { getState } from '../../../../../lib/redis-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const pid = req.nextUrl.searchParams.get('pid') || undefined;
  const state = await getState(params.code, pid || undefined);
  const headers = { 'Cache-Control': 'no-store' };
  if (!state) return new Response(JSON.stringify({ error: 'No existe' }), { status: 404, headers });
  return new Response(JSON.stringify(state), { status: 200, headers });
}
