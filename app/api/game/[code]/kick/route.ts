import { NextRequest, NextResponse } from 'next/server';
import { leaveGame, getGame } from '../../../../../lib/redis-store';

export async function POST(request: NextRequest, { params }: { params: { code: string } }) {
  try {
    const { hostPlayerId, targetPlayerId } = await request.json();
    
    if (!hostPlayerId || !targetPlayerId) {
      return NextResponse.json({ error: 'hostPlayerId y targetPlayerId son requeridos' }, { status: 400 });
    }

    // Verificar que el juego existe y que hostPlayerId es realmente el host
    const game = await getGame(params.code);
    if (!game) {
      return NextResponse.json({ error: 'Juego no encontrado' }, { status: 404 });
    }

    // Verificar que hostPlayerId es el host del juego
    if (game.hostId !== hostPlayerId) {
      return NextResponse.json({ error: 'Solo el host puede expulsar jugadores' }, { status: 403 });
    }

    // Verificar que el jugador objetivo existe en el juego
    const targetPlayer = game.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer) {
      return NextResponse.json({ error: 'Jugador no encontrado en la partida' }, { status: 404 });
    }

    // No permitir que el host se expulse a sí mismo
    if (hostPlayerId === targetPlayerId) {
      return NextResponse.json({ error: 'El host no puede expulsarse a sí mismo' }, { status: 400 });
    }

    // Expulsar al jugador (usar la misma lógica que abandonar partida)
    const updatedGame = await leaveGame(params.code, targetPlayerId);
    
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