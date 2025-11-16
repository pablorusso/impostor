import { nextTurn } from '../../../../../lib/redis-store';
import { emit } from '../../../../../lib/events';

export async function POST(_: Request, { params }: { params: { code: string } }) {
  const ok = await nextTurn(params.code);
  if (ok) {
    emit(params.code, 'next-turn');
  }
  return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 400 });
}