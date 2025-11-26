import { NextRequest, NextResponse } from 'next/server';
import { leaveGame, getGame } from '../../../../../lib/redis-store';
import { pusher } from '../../../../../lib/pusher';

export async function POST(request: NextRequest, { params }: { params: { code: string } }) {
  try {
    const { hostPlayerId, targetPlayerId } = await request.json();
    
    if (!hostPlayerId || !targetPlayerId) {
      return NextResponse.json({ error: 'hostPlayerId y targetPlayerId son requeridos' }, { status: 400 });
    }

    const game = await getGame(params.code);
    if (!game) {
      return NextResponse.json({ error: 'Juego no encontrado' }, { status: 404 });
    }

    if (game.hostId !== hostPlayerId) {
      return NextResponse.json({ error: 'Solo el host puede expulsar jugadores' }, { status: 403 });
    }

    const targetPlayer = game.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer) {
      return NextResponse.json({ error: 'Jugador no encontrado en la partida' }, { status: 404 });
    }

    if (hostPlayerId === targetPlayerId) {
      return NextResponse.json({ error: 'El host no puede expulsarse a sí mismo' }, { status: 400 });
    }

    const updatedGame = await leaveGame(params.code, targetPlayerId);

    // Notificar a todos los clientes sobre el cambio
    await pusher.trigger(`private-game-${params.code.toUpperCase()}`, 'game-update', {
      sender: hostPlayerId,
    });
    
    return NextResponse.json({ 
      success: true, 
      message: `Jugador ${targetPlayer.name} expulsado`,
      game: updatedGame 
    });
    
  } catch (error) {
    console.error('Error expulsando jugador:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}