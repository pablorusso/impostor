import { leaveGame } from '../../../../../lib/redis-store';
import { emit } from '../../../../../lib/events';

export async function POST(request: Request, { params }: { params: { code: string } }) {
  const { playerId } = await request.json();
  
  if (!playerId) {
    return new Response(JSON.stringify({ ok: false, error: 'Player ID required' }), { status: 400 });
  }

  const success = await leaveGame(params.code, playerId);
  if (success) {
    emit(params.code, 'player-leave');
  }
  
  return new Response(JSON.stringify({ ok: success }), { status: success ? 200 : 400 });
}