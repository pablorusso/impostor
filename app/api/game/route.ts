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
  
  if (!hostName) {
    return new Response(JSON.stringify({ error: 'Host requerido' }), { status: 400 });
  }
  if (!hostPlayerId) {
    return new Response(JSON.stringify({ error: 'PlayerID requerido' }), { status: 400 });
  }
  
  const game = await createGame(hostPlayerId, hostName, words, shareCategories);
  return new Response(JSON.stringify(game), { status: 201 });
}
