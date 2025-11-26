# Repository Guidelines

## Project Structure & Module Organization
- `app/` hosts the Next.js App Router: `page.tsx` landing, `new/` for creating games, `game/[code]/` for gameplay, and `api/game|player` route handlers for mutations and event streaming. `app/components/HeaderNav.tsx` and `app/contexts` hold shared UI/state pieces; `app/globals.css` sets base styles.
- `lib/` contains domain logic: `store.ts` + `redis-store.ts` (hybrid Redis/memory store), `events.ts` (server-sent events), `player-session.ts` (session helpers), `types.ts`, and `words.ts` (word list).
- `public/` stores PWA assets (`manifest.json`, icons, `sw.js`); adjust here for branding. Root configs: `next.config.mjs`, `tsconfig.json`, `vercel.json`.

## Build, Test, and Development Commands
- `npm install` to set up (Node >=18.17).
- `npm run dev` starts the local dev server; optionally `REDIS_URL=... npm run dev` to test Redis-backed flows.
- `npm run build` produces the production bundle; `npm start` serves the built app. Use `npx next lint` before shipping to catch common issues.

## Coding Style & Naming Conventions
- TypeScript + functional React components; add `"use client"` only when a component needs hooks or browser APIs.
- Prefer 2-space indentation, single quotes, and lightweight inline styling with MUI `sx`/Emotion (follow existing palette and Spanish copy tone).
- Components and files: PascalCase for React components, camelCase for helpers, UPPER_SNAKE_CASE for env vars. Keep API route handlers in `route.ts` per folder.

## Testing Guidelines
- There is no automated test suite yet; add targeted coverage when changing behavior. Use a Next.js-friendly stack (e.g., Vitest/Jest + React Testing Library) and place specs alongside code or under `__tests__/` with `*.test.ts(x)` naming.
- For store/Redis logic, include scenarios for memory fallback and TTL/cleanup expectations. For UI, cover join/create flows and event-driven refresh logic.

## Commit & Pull Request Guidelines
- Follow the existing short, imperative commits (`Fix service worker`, `Update README.md`); keep the subject under ~72 characters and describe the user-facing impact in the body if needed.
- PRs should state the problem, the solution, and how to verify it (commands or steps). Attach screenshots/GIFs for UI changes, list new env vars (e.g., `REDIS_URL`), and note migration or cache implications. Keep PRs small and scoped.

## Environment & Security Tips
- Use `.env.local` for secrets; never commit credentials. `REDIS_URL` enables persistent storage—without it the app falls back to in-memory dev mode.
- When updating `public/manifest.json` or `sw.js`, ensure icons remain consistent and cache behavior is verified in a fresh build (`npm run build && npm start`).
