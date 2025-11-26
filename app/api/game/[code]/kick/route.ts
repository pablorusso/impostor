import { NextRequest } from 'next/server';
import { leaveGame, getGame } from '../../../../../lib/redis-store';
import { emit } from '../../../../../lib/events';

export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const body = await req.text();
  let data: any = {};
  try { data = body ? JSON.parse(body) : {}; } catch {}

  const code = params.code?.toUpperCase();
  const playerId: string = data.playerId || data.hostPlayerId || '';
  const targetPlayerId: string = data.targetPlayerId || '';

  if (!code || !playerId || !targetPlayerId) {
    return new Response(JSON.stringify({ error: 'Datos incompletos' }), { status: 400 });
  }

  if (playerId === targetPlayerId) {
    return new Response(JSON.stringify({ error: 'No puedes expulsarte a ti mismo' }), { status: 400 });
  }

  const game = await getGame(code);
  if (!game) {
    return new Response(JSON.stringify({ error: 'Partida no encontrada' }), { status: 404 });
  }

  const actorInGame = game.players.find(p => p.id === playerId);
  const targetInGame = game.players.find(p => p.id === targetPlayerId);
  if (!actorInGame || !targetInGame) {
    return new Response(JSON.stringify({ error: 'Jugador no pertenece a la partida' }), { status: 403 });
  }

  const allowAll = game.allowAllKick !== false; // default true
  const isHost = game.hostId === playerId;

  if (!allowAll && !isHost) {
    return new Response(JSON.stringify({ error: 'Solo el host puede expulsar' }), { status: 403 });
  }

  if (!allowAll && targetPlayerId === game.hostId) {
    return new Response(JSON.stringify({ error: 'No se puede expulsar al host' }), { status: 403 });
  }

  const ok = await leaveGame(code, targetPlayerId);
  if (!ok) {
    return new Response(JSON.stringify({ error: 'No se pudo expulsar al jugador' }), { status: 500 });
  }

  emit(code, 'player-leave', { playerId: targetPlayerId });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
