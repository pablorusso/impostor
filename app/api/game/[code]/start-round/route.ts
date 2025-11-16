import { startRound } from '../../../../../lib/redis-store';
import { emit } from '../../../../../lib/events';

export async function POST(_: Request, { params }: { params: { code: string } }) {
  const ok = await startRound(params.code);
  if (ok) {
    emit(params.code, 'round-start');
  }
  return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 400 });
}
