import { NextRequest, NextResponse } from 'next/server';
import { isPlayerInGame } from '../../../../../lib/redis-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { playerId: string } }) {
  const playerId = params.playerId;
  const noStoreHeaders = { 'Cache-Control': 'no-store' };
  
  if (!playerId) {
    return NextResponse.json({ error: 'PlayerID requerido' }, { status: 400, headers: noStoreHeaders });
  }

  try {
    const status = await isPlayerInGame(playerId);
    return NextResponse.json(status, { status: 200, headers: noStoreHeaders });
  } catch (error) {
    console.error('Error checking player status:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500, headers: noStoreHeaders });
  }
}
