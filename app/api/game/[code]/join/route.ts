import { NextRequest } from 'next/server';
import { joinGame } from '../../../../../lib/redis-store';
import { emit } from '../../../../../lib/events';

export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const body = await req.text();
  let data: any = {};
  try { data = body ? JSON.parse(body) : {}; } catch {}
  
  const name: string = (data.name || '').trim();
  const playerId: string = data.playerId || '';
  
  if (!name) return new Response(JSON.stringify({ error: 'Nombre requerido' }), { status: 400 });
  if (!playerId) return new Response(JSON.stringify({ error: 'PlayerID requerido' }), { status: 400 });
  
  const result = await joinGame(playerId, params.code, name);
  if (!result) return new Response(JSON.stringify({ error: 'Partida no existe' }), { status: 404 });
  
  // Emitir evento de join (sin perspectiva de jugador específica)
  emit(params.code, 'player-join', { playerId: result.playerId });
  return new Response(JSON.stringify(result), { status: 200 });
}
