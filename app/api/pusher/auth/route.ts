
import { NextRequest, NextResponse } from 'next/server';
import { pusher } from '../../../../lib/pusher';
import { isPlayerInGame } from '../../../../lib/redis-store';

export async function POST(req: NextRequest) {
  const playerId = req.headers.get('x-player-id');
  if (!playerId) {
    return new Response('Forbidden', { status: 403 });
  }

  const data = await req.formData();
  const socketId = data.get('socket_id') as string;
  const channel = data.get('channel_name') as string;

  // El canal debe ser privado y seguir el formato 'private-game-<code>'
  const gameCodeMatch = channel.match(/^private-game-(.*)$/);
  if (!gameCodeMatch) {
    return new Response('Invalid channel name', { status: 400 });
  }
  const gameCode = gameCodeMatch[1];

  try {
    const { inGame, currentGameCode } = await isPlayerInGame(playerId, gameCode);

    if (!inGame || currentGameCode !== gameCode) {
      return new Response('Forbidden', { status: 403 });
    }

    const authResponse = pusher.authorizeChannel(socketId, channel);
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('[Pusher Auth] Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
