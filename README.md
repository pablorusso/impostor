# Impostor (Juego social)

Aplicación web simple para repartir palabras en rondas entre jugadores, excepto el impostor que no recibe la palabra. El juego ocurre presencialmente; la web sólo gestiona rondas y asignaciones.

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
