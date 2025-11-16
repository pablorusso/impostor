import { subscribe, emit } from '../../../../../lib/events';
import { getState } from '../../../../../lib/store';

export const dynamic = 'force-dynamic'; // asegurar que no se cachea

export async function GET(_: Request, { params }: { params: { code: string } }) {
  const { code } = params;
  let heart: any;
  let unsubscribe: () => void = () => {};
  return new Response(
    new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        const send = (obj: any) => {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };
        // Suscribirse
        unsubscribe = subscribe(code, (ev) => {
          send(ev);
        });
        // Enviar estado inicial
        const initial = getState(code);
        if (initial) {
          send({ type: 'init', code: code.toUpperCase(), timestamp: Date.now() });
        }
        // Heartbeat
        heart = setInterval(() => {
          send({ type: 'ping', timestamp: Date.now() });
        }, 25000);
      },
      cancel() {
        clearInterval(heart);
        unsubscribe();
      }
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // nginx (por si acaso)
      },
    }
  );
}
