import { startRound } from '../../../../../lib/store';

export async function POST(_: Request, { params }: { params: { code: string } }) {
  const ok = startRound(params.code);
  return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 400 });
}
