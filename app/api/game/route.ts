import { NextRequest } from 'next/server';
import { createGame } from '../../../lib/redis-store';

export async function POST(req: NextRequest) {
  const body = await req.text();
  let data: any = {};
  try { data = body ? JSON.parse(body) : {}; } catch {}
  
  const hostPlayerId: string = data.hostPlayerId || '';
  const hostName: string = (data.hostName || '').trim();
  const words: string[] | undefined = Array.isArray(data.words) ? data.words : undefined;
  const shareCategories: boolean = !!data.shareCategories;
  const allowAllKick: boolean = data.allowAllKick !== false; // default true
  const isPublic: boolean = !!data.isPublic;
  const rawImpostorMin = Number(data.impostorCountMin);
  const rawImpostorMax = Number(data.impostorCountMax);
  const impostorCountMin = Number.isFinite(rawImpostorMin) ? Math.floor(rawImpostorMin) : 1;
  const impostorCountMax = Number.isFinite(rawImpostorMax) ? Math.floor(rawImpostorMax) : impostorCountMin;

  if (!hostName) {
    return new Response(JSON.stringify({ error: 'Host requerido' }), { status: 400 });
  }
  if (!hostPlayerId) {
    return new Response(JSON.stringify({ error: 'PlayerID requerido' }), { status: 400 });
  }
  if (impostorCountMin < 1) {
    return new Response(JSON.stringify({ error: 'Impostores invalidos' }), { status: 400 });
  }
  if (impostorCountMax < impostorCountMin) {
    return new Response(JSON.stringify({ error: 'Impostores invalidos' }), { status: 400 });
  }
  
  const game = await createGame(
    hostPlayerId,
    hostName,
    words,
    shareCategories,
    allowAllKick,
    isPublic,
    impostorCountMin,
    impostorCountMax
  );
  return new Response(JSON.stringify(game), { status: 201 });
}
