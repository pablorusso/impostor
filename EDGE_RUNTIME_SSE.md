# Configuración Edge Runtime para SSE en Vercel

Este documento explica cómo se configuró Edge Runtime para soportar Server-Sent Events (SSE) en Vercel, aplicando las mejores prácticas específicas.

## Problema

Vercel's Node.js runtime es serverless y no es compatible con SSE debido a las limitaciones de las funciones serverless. Edge Runtime es necesario para mantener conexiones persistentes.

## ⚠️ Limitaciones importantes de Edge Functions

- **Tiempo de ejecución limitado**: Edge Functions tienen límites de tiempo según tu plan Vercel
- **No son para conexiones permanentes**: Para notificaciones long-lived considera WebSockets externos  
- **Reinicio frecuente**: Las funciones pueden reiniciarse, causando desconexiones

## Solución: Edge Runtime

### 1. Configuración del endpoint SSE

**Archivo: `app/api/game/[code]/events/route.ts`**

```typescript
// Edge Runtime es necesario para SSE en Vercel
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
```

### 2. Uso de TransformStream y formato SSE correcto

**❌ NO usar:** `res.write()` / `res.end()` (no disponible en Edge Runtime)

**✅ Usar:** `new Response()` y `ReadableStream/TransformStream`

```typescript
// Usar TransformStream para Edge Runtime
const stream = new TransformStream();
const writer = stream.writable.getWriter();
const encoder = new TextEncoder();

const send = async (obj: any) => {
  try {
    // ✅ Formato SSE correcto: data + \n\n
    await writer.write(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
  } catch (error) {
    console.log('[SSE] Write error:', error);
  }
};
```

### 3. Headers correctos para SSE

**Mínimos requeridos:**
```typescript
{
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform', // no-transform importante
  'Connection': 'keep-alive'
}
```

### 3. Configuración Vercel.json

```json
{
  "functions": {
    "app/api/game/*/events/route.ts": {
      "runtime": "edge"
    },
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

### 4. Manejo de conexiones conservador

```typescript
// Heartbeat más conservador para Edge Functions
heart = setInterval(async () => {
  try {
    await send({ type: 'ping', timestamp: Date.now() });
  } catch (error) {
    console.log('[SSE] Heartbeat failed, closing connection:', error);
    clearInterval(heart);
    unsubscribe();
    try {
      await writer.close();
    } catch {}
  }
}, 10000); // 10s - más conservador para Edge Functions

// ⚠️ Cleanup conservador - Edge Functions tienen límites de tiempo
setTimeout(() => {
  clearInterval(heart);
  unsubscribe();
  writer.close().catch(() => {});
}, 2 * 60 * 1000); // 2 minutos para ser conservador
```

## Diferencias entre Node.js y Edge Runtime

| Aspecto | Node.js Runtime | Edge Runtime |
|---------|----------------|--------------|
| **SSE Support** | ❌ No (serverless) | ✅ Sí (persistent) |
| **Streaming** | ❌ Limitado | ✅ Completo |
| **Duración máxima** | 10s (Hobby), 60s (Pro) | Sin límite |
| **APIs disponibles** | Node.js completo | Web APIs solamente |
| **Cold starts** | Más lentos | Más rápidos |

## APIs compatibles con Edge Runtime

✅ **Soportadas:**
- `fetch()`
- `Response`, `Request`
- `TransformStream`, `ReadableStream`
- `TextEncoder`, `TextDecoder`
- `setTimeout`, `setInterval`
- `globalThis`

❌ **NO soportadas:**
- `fs` (file system)
- `path`
- Node.js buffers
- `process`
- Most Node.js built-ins

## Migración checklist

- [x] Agregar `export const runtime = 'edge'`
- [x] Cambiar `ReadableStream` por `TransformStream`
- [x] Usar `writer.write()` en lugar de `controller.enqueue()`
- [x] Configurar timeout de cleanup (Edge no maneja request.signal igual)
- [x] Actualizar `vercel.json` con runtime específico
- [x] Verificar que no se usen APIs de Node.js

## Testing

### Local
```bash
npm run dev
```
El Edge Runtime se simula localmente.

### Producción (Vercel)
```bash
vercel deploy
```

### Verificación
1. Abrir Developer Tools → Network
2. Buscar conexiones con "text/event-stream"
3. Verificar que los eventos llegan continuamente
4. Comprobar que no se desconecta después de 10-30 segundos

## Beneficios

1. **SSE funcional**: Conexiones persistentes en Vercel
2. **Mejor rendimiento**: Edge Runtime es más rápido
3. **Sin timeouts**: No hay límite de 10-30 segundos
4. **Latencia reducida**: Ejecutado más cerca del usuario

## Limitaciones

1. **APIs limitadas**: Solo Web APIs, no Node.js APIs
2. **Debugging**: Menos herramientas de debug
3. **Compatibilidad**: Algunas librerías pueden no funcionar

## Monitoreo

Los logs aparecerán en Vercel Dashboard → Functions → Edge Functions.

```typescript
console.log('[SSE] Connection established'); // ✅ Visible en Vercel
console.log('[SSE] Heartbeat failed:', error); // ✅ Para debugging
```