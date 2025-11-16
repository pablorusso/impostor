import { leaveGame } from '../../../../../lib/store';
import { emit } from '../../../../../lib/events';

export async function POST(request: Request, { params }: { params: { code: string } }) {
  const { playerId } = await request.json();
  
  if (!playerId) {
    return new Response(JSON.stringify({ ok: false, error: 'Player ID required' }), { status: 400 });
  }

  const result = leaveGame(params.code, playerId);
  if (result.ok) {
    emit(params.code, result.gameEnded ? 'game-close' : 'player-leave');
  }
  
  return new Response(JSON.stringify(result), { status: result.ok ? 200 : 400 });
}