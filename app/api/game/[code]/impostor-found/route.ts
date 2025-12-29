import { reportImpostorFound } from '../../../../../lib/redis-store';
import { emit } from '../../../../../lib/events';

export async function POST(req: Request, { params }: { params: { code: string } }) {
  let data: any = {};
  try {
    data = await req.json();
  } catch {}
  const playerId = typeof data?.playerId === 'string' ? data.playerId : '';
  const result = await reportImpostorFound(params.code, playerId);
  if (result.ok) {
    emit(params.code, 'impostor-found', { allFound: result.allFound });
  }
  return new Response(JSON.stringify(result), { status: result.ok ? 200 : 400 });
}
