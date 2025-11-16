import { nextRound } from '../../../../../lib/redis-store';
import { emit } from '../../../../../lib/events';

export async function POST(_: Request, { params }: { params: { code: string } }) {
  const ok = await nextRound(params.code);
  if (ok) emit(params.code, 'round-next');
  return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 400 });
}
