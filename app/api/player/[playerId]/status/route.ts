import { NextRequest } from 'next/server';
import { isPlayerInGame } from '../../../../../lib/redis-store';

export async function GET(req: NextRequest, { params }: { params: { playerId: string } }) {
  const playerId = params.playerId;
  
  if (!playerId) {
    return new Response(JSON.stringify({ error: 'PlayerID requerido' }), { status: 400 });
  }

  try {
    const status = await isPlayerInGame(playerId);
    return new Response(JSON.stringify(status), { status: 200 });
  } catch (error) {
    console.error('Error checking player status:', error);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500 });
  }
}