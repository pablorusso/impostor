import { endRound } from '../../../../../lib/store';

export async function POST(_: Request, { params }: { params: { code: string } }) {
  const ok = endRound(params.code);
  return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 400 });
}
