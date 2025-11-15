import { nextRound } from '../../../../../lib/store';

export async function POST(_: Request, { params }: { params: { code: string } }) {
  const ok = nextRound(params.code);
  return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 400 });
}
