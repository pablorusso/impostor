import { closeGame } from '../../../../../lib/redis-store';
import { emit } from '../../../../../lib/events';

export async function POST(_: Request, { params }: { params: { code: string } }) {
  const ok = await closeGame(params.code);
  if (ok) emit(params.code, 'game-close');
  return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 404 });
}
