import { NextRequest, NextResponse } from 'next/server';
import { getPublicGames, getGame } from '../../../../lib/redis-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req: NextRequest) {
  const noStoreHeaders = { 'Cache-Control': 'no-store' };

  try {
    const codes = await getPublicGames();
    const result: { code: string; host: string }[] = [];

    for (const code of codes) {
      const game = await getGame(code.toUpperCase());
      if (game && !game.currentRound) {
        const hostPlayer = game.players.find(p => p.id === game.hostId);
        result.push({ code: game.code, host: hostPlayer?.name || 'Host' });
      }
      if (result.length >= 5) break;
    }

    return NextResponse.json({ games: result }, { headers: noStoreHeaders });
  } catch (error) {
    console.error('Error fetching public games:', error);
    return NextResponse.json({ games: [] }, { headers: noStoreHeaders });
  }
}
