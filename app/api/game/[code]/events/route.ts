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
        // Heartbeat optimizado para Vercel según limitaciones documentadas
        heart = setInterval(() => {
          try {
            // Flush inmediatamente para Vercel
            send({ type: 'ping', timestamp: Date.now() });
          } catch (error) {
            console.log('[SSE] Heartbeat failed, closing connection:', error);
            clearInterval(heart);
            unsubscribe();
            try {
              controller.close();
            } catch {}
          }
        }, 10000); // 10s para evitar timeout de Vercel
      },
      cancel() {
        clearInterval(heart);
        unsubscribe();
      }
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Content-Encoding': 'none', // Importante para Vercel según documentación
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        'X-Accel-Buffering': 'no', // nginx
        'X-Vercel-Cache': 'BYPASS', // Forzar bypass de cache Vercel
      },
    }
  );
}
