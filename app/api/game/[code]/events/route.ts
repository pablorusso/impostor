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
        // Heartbeat más frecuente para Vercel/Safari
        heart = setInterval(() => {
          try {
            send({ type: 'ping', timestamp: Date.now() });
          } catch (error) {
            // Si falla el heartbeat, cerrar la conexión
            clearInterval(heart);
            unsubscribe();
            controller.close();
          }
        }, 15000); // Más frecuente para evitar timeouts
      },
      cancel() {
        clearInterval(heart);
        unsubscribe();
      }
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        'X-Accel-Buffering': 'no', // nginx
      },
    }
  );
}
