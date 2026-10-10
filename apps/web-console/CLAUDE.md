# web-console

**Web console (Vite + React + Zustand)** renders the battlefield on a canvas (`lib/canvas-renderer.ts`) from `store/match-store.ts`, fed by `hooks/useWebSocket.ts`. **The WebSocket URL is hardcoded** to `ws://localhost:3000/ws` in that hook; the `VITE_WS_URL` / `VITE_API_URL` variables in `docker-compose.yml` are not read.

- `QUICKSTART.md` says `cd web-console && npm install` — that path is pre-monorepo; install from the repo root.
