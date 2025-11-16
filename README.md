# Impostor (Juego social)

Aplicación web simple para repartir palabras en rondas entre jugadores, excepto el impostor que no recibe la palabra. El juego ocurre presencialmente; la web sólo gestiona rondas y asignaciones.
Y
## 🔄 Estado de las Conexiones SSE (Nov 2024)

**✅ Problemas Solucionados**:
- ❌ ResponseAborted errors eliminados mediante mejor manejo de desconexiones
- ✅ Detección automática de desconexión del cliente usando `request.signal`
- ✅ Cleanup robusto de conexiones SSE con timeouts apropiados
- ✅ Reconexión automática mejorada con backoff exponential
- ✅ Timeouts conservadores para Edge Runtime (20s heartbeat, 5min max conexión)
- ✅ Manejo de estados `isClosed` para evitar escrituras a streams cerrados
- ✅ **Configuración Vercel corregida**: `vercel.json` fix para Edge Runtime

## 🚀 Deploy en Vercel

**Estado**: ✅ **Listo para Deploy**

1. **Build exitoso**: `npm run build` ✅
2. **Edge Runtime configurado**: SSE optimizado para Vercel ✅  
3. **vercel.json corregido**: Runtime configuration fix ✅

**Para deployar**:
```bash
# 1. Login en Vercel (si es necesario)
vercel login

# 2. Deploy
vercel --prod
```

## Características
- Crear partida y compartir código
- Jugadores se unen con su nombre
- Host inicia/finaliza rondas
- Palabra aleatoria para cada ronda (excepto impostor)
- In-memory store (NO persistente). Reinicios del servidor limpian partidas.

## Limitaciones
Para producción se recomienda añadir almacenamiento persistente (Vercel KV, Postgres, Supabase, etc.). El in-memory store puede perderse al escalar a múltiples lambdas o tras inactividad.

## Scripts
```bash
npm install
npm run dev
npm run build
npm start
```

## Tiempo real (SSE)
Se reemplazó el polling periódico por Server-Sent Events.

Ruta: `GET /api/game/{CODE}/events` mantiene una conexión abierta que emite:
- `init`, `player-join`, `round-start`, `round-next`, `round-end`, `game-close` y heartbeats `ping`.

El cliente escucha y sólo llama a `/api/game/{CODE}/state?pid=...` cuando un evento relevante ocurre, reduciendo tráfico.

Extender: tras cualquier mutación en un handler importar `emit` de `lib/events` y llamar `emit(code, 'tipo')`. Luego añadir el nuevo `tipo` al array de tipos que disparan `refresh()` en `app/game/[code]/page.tsx`.

Limitación: en despliegue serverless el in-memory + SSE puede fragmentarse entre instancias; para producción migrar a almacenamiento + canales realtime (Supabase, Pusher, Ably) o WebSockets gestionados.

## Deploy en Vercel
1. Crear proyecto en Vercel apuntando a este repo.
2. Framework: Next.js – sin configuración adicional.
3. Deploy; la app usa store en memoria dentro de cada lambda (funcionará para sesiones cortas de pocos usuarios).
4. Para persistencia: agregar Vercel KV y reemplazar `lib/store.ts` por un adaptador Redis.

## Mejoras futuras (opcionales)
- Persistencia real
- Roles adicionales / múltiples impostores
- Historial de rondas
- Internacionalización
- WebSocket (Pusher / Supabase Realtime) para evitar polling

## Aviso
Este proyecto está diseñado para la capa gratuita de Vercel y simplicidad educativa.
