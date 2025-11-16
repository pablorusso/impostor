# Impostor (Juego social)

Aplicación web simple para repartir palabras en rondas entre jugadores, excepto el impostor que no recibe la palabra. El juego ocurre presencialmente; la web sólo gestiona rondas y asignaciones.
## 🔄 Arquitectura Redis + Polling Ultra-Robusta (Nov 2024)

**🚨 MIGRACIÓN COMPLETA - Persistencia Redis Implementada**:

**Problemas Resueltos**:
- ✅ **Safari session loss**: Eliminado con Redis persistente
- ✅ **Pérdida de sincronización**: Resuelto con store híbrido
- ✅ **Escalabilidad serverless**: Redis distribuido funcional

**✅ Arquitectura Final Redis + Polling**:
- ✅ **Store Híbrido**: Redis (`REDIS_URL`) + fallback memoria para desarrollo
- ✅ **Polling Robusto**: Mecanismo principal (cada 1.5s) con detección de cambios
- ✅ **Persistencia Completa**: Redis con TTL de 6 horas, auto-cleanup
- ✅ **Reconexión Proactiva**: Backoff exponencial con hasta 10 reintentos  
- ✅ **Indicador Visual**: Estado de conexión en tiempo real (🟢🟡🔴)
- ✅ **Logs Informativos**: `[REDIS]` producción, `[DEV]` desarrollo
- ✅ **Auto-detección**: Usa Redis si está disponible, memoria si no

## 🚀 Deploy en Vercel

**Estado**: ✅ **Ultra-Robusto y Listo para Deploy**

1. **Build exitoso**: `npm run build` ✅
2. **Polling robusto**: Reemplaza SSE inestable ✅
3. **Persistencia múltiple**: Store + backup automático ✅
4. **Indicadores visuales**: Estado de conexión en tiempo real ✅
5. **Reconexión proactiva**: Hasta 10 reintentos automáticos ✅

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

## ⚙️ Configuración Redis

**Estado Actual**: ✅ **Redis configurado y funcionando** con RedisLabs

```env
# Tu configuración actual (.env.development.local)
REDIS_URL="redis://default:V4EHzoOHJ7qVu6823nGrZ8EqYOWB6sIN@redis-11973.c8.us-east-1-3.ec2.cloud.redislabs.com:11973"
```

**Funcionalidades**:
- ✅ **Persistencia completa**: Los juegos sobreviven reiniciar serverless
- ✅ **Auto-cleanup**: TTL de 6 horas, limpieza automática
- ✅ **Desarrollo local**: Funciona con memoria si no hay Redis configurado
- ✅ **Logs claros**: `[REDIS] Using Redis via REDIS_URL`

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
