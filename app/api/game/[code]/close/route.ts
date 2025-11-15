import { closeGame } from '../../../../../lib/store';

export async function POST(_: Request, { params }: { params: { code: string } }) {
  const ok = closeGame(params.code);
  return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 404 });
}
