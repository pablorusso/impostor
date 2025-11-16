// SSE deshabilitado en favor de polling robusto para máxima estabilidad
// Este endpoint ahora solo retorna un mensaje indicando que se use polling

export async function GET(request: Request, { params }: { params: { code: string } }) {
  console.log('[Events] SSE endpoint disabled - using robust polling instead');
  
  return new Response(
    JSON.stringify({ 
      message: 'SSE disabled in favor of robust polling', 
      usePolling: true,
      timestamp: Date.now()
    }), 
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      }
    }
  );
}
