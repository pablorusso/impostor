import { subscribe, emit } from '../../../../../lib/events';
import { getState } from '../../../../../lib/store';

// Edge Runtime es necesario para SSE en Vercel
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { code: string } }) {
  const { code } = params;
  let heart: any;
  let maxConnectionTime: any;
  let unsubscribe: () => void = () => {};
  let isClosed = false;
  
  console.log('[SSE] New connection for game:', code);
  
  // Usar TransformStream para Edge Runtime
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  
  const send = async (obj: any) => {
    if (isClosed) return false;
    
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      return true;
    } catch (error) {
      console.log('[SSE] Write error:', error);
      isClosed = true;
      return false;
    }
  };
  
  // Cleanup function
  const cleanup = () => {
    if (isClosed) return;
    isClosed = true;
    
    console.log('[SSE] Cleaning up connection for game:', code);
    
    if (heart) {
      clearInterval(heart);
      heart = null;
    }
    
    if (maxConnectionTime) {
      clearTimeout(maxConnectionTime);
    }
    
    unsubscribe();
    
    try {
      writer.close();
    } catch (error) {
      console.log('[SSE] Writer close error:', error);
    }
  };
  
  // Suscribirse a eventos del juego
  unsubscribe = subscribe(code, async (ev) => {
    const success = await send(ev);
    if (!success) {
      cleanup();
    }
  });
  
  // Enviar estado inicial
  const initial = getState(code);
  if (initial) {
    const success = await send({ type: 'init', code: code.toUpperCase(), timestamp: Date.now() });
    if (!success) {
      cleanup();
      return new Response('Connection failed', { status: 500 });
    }
  }
  
  // Heartbeat con mejor manejo de errores
  heart = setInterval(async () => {
    if (isClosed) {
      clearInterval(heart);
      return;
    }
    
    const success = await send({ type: 'ping', timestamp: Date.now() });
    if (!success) {
      cleanup();
    }
  }, 20000); // 20s - más conservador para Edge Runtime
  
  // Detectar desconexión del cliente usando abort signal
  if (request.signal) {
    request.signal.addEventListener('abort', () => {
      console.log('[SSE] Client disconnected (abort signal)');
      cleanup();
    });
  }
  
  // Edge Functions tienen límite de tiempo (consultar plan Vercel)
  // Para conexiones long-lived considerar WebSockets externos
  // Cleanup conservador para evitar timeouts
  maxConnectionTime = setTimeout(cleanup, 5 * 60 * 1000); // 5 minutos
  
  return new Response(stream.readable, {
    headers: {
      // Headers críticos para SSE según mejores prácticas
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      
      // Headers adicionales para compatibilidad
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no', // Para proxies/nginx
    },
  }
  );
}
