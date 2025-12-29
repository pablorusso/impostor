import { nextTurn } from '../../../../../lib/redis-store';
import { emit } from '../../../../../lib/events';

export async function POST(req: Request, { params }: { params: { code: string } }) {
  let data: any = {};
  try {
    data = await req.json();
  } catch {}
  const playerId = typeof data?.playerId === 'string' ? data.playerId : '';
  const ok = await nextTurn(params.code, playerId);
  if (ok) {
    emit(params.code, 'next-turn');
  }
  return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 400 });
}
