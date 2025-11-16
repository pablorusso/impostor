# Mejoras para Vercel - Solución al problema de sesiones

Este documento describe las mejoras implementadas para resolver el problema de pérdida de sesión en Vercel.

## Problema identificado

En entornos serverless como Vercel, cada request puede ejecutarse en diferentes lambdas/containers, causando que el estado en memoria se pierda entre requests. Esto provocaba que cuando un nuevo jugador se unía, el host perdiera acceso a la partida.

## Soluciones implementadas

### 1. Store mejorado (`lib/store.ts`)

- **Clave de store más específica**: `__IMPOSTOR_GAME_STORE_V2__` 
- **Logging detallado**: Para debugging en producción
- **Cleanup más agresivo**: 1 hora en lugar de 2 horas
- **Tracking de última actividad**: Mejor gestión del lifecycle
- **Instance ID**: Para debug de múltiples containers

```typescript
const storeKey = '__IMPOSTOR_GAME_STORE_V2__';
```

### 2. Headers SSE optimizados (`app/api/game/[code]/events/route.ts`)

Basado en la documentación oficial de Vercel:

- **`Content-Encoding: none`**: Evita problemas con compresión gzip
- **`X-Vercel-Cache: BYPASS`**: Fuerza bypass de cache
- **Heartbeat cada 10s**: Optimizado para limitaciones de Vercel
- **Logging mejorado**: Para debug de conexiones

### 3. Configuración Vercel (`vercel.json`)

```json
{
  "headers": [
    {
      "source": "/api/game/(.*)/events",
      "headers": [
        {
          "key": "Content-Encoding",
          "value": "none"
        },
        {
          "key": "X-Vercel-Cache", 
          "value": "BYPASS"
        }
      ]
    }
  ],
  "regions": ["iad1"]
}
```

### 4. Cliente mejorado (`app/game/[code]/page.tsx`)

- **Reconexión automática**: Con backoff exponencial
- **Logging detallado**: Para debug en producción
- **Validación de datos robusta**: Verificaciones más estrictas
- **Timeouts aumentados**: 20s en lugar de 10s para Vercel
- **Headers anti-cache**: `Cache-Control`, `Pragma`

### 5. Función refresh robusta

```typescript
const refresh = useCallback(async () => {
  // Timeout aumentado para Vercel
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  const res = await fetch(`/api/game/${code}/state?pid=${playerId}`, {
    signal: controller.signal,
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });
  
  // Validación más estricta de datos
  if (data && data.game && data.player && data.player.name) {
    setState(data);
  }
}, [playerId, code]);
```

## Técnicas aplicadas

### Basado en GitHub Issue #48427

1. **`Content-Encoding: none`**: Solución documentada para Vercel
2. **Heartbeat con flush**: Para mantener conexiones vivas  
3. **Fallback a polling**: Cuando SSE falla
4. **GlobalThis mejorado**: Para persistencia entre requests

### Logs para debugging

Todos los componentes ahora incluyen logs detallados:

```typescript
console.log('[Store] Initializing new game store instance');
console.log('[SSE] Connection established');
console.log('[Refresh] Fetching state for player:', playerId);
```

## Testing recomendado

1. **Despliegue en Vercel**: Verificar comportamiento en producción
2. **Múltiples jugadores**: Simular uniones simultáneas
3. **Reconexiones**: Probar pérdida/recuperación de conexión
4. **Logs de producción**: Monitorear comportamiento real

## Referencias

- [Next.js SSE Discussion #48427](https://github.com/vercel/next.js/discussions/48427)
- [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
- [Server-Sent Events Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

## Resultado esperado

- ✅ Sesiones persistentes entre requests
- ✅ Reconexión automática en fallos
- ✅ Mejor debugging en producción  
- ✅ Compatibilidad mejorada con Vercel
- ✅ Fallback robusto a polling