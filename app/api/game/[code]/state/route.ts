import { NextRequest } from 'next/server';
import { getState } from '../../../../../lib/store';

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const pid = req.nextUrl.searchParams.get('pid') || undefined;
  const state = getState(params.code, pid || undefined);
  if (!state) return new Response(JSON.stringify({ error: 'No existe' }), { status: 404 });
  return new Response(JSON.stringify(state), { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
