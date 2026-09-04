# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Helm

Voice-first AI referee for Warhammer 40,000 tabletop play: an npm-workspaces monorepo of five services plus a React web console, with event sourcing and hard-stop rules enforcement as the design center. **Public repo. Zero copyrighted Games Workshop content** — every unit, rule, and terrain file under `devdata/` is a generic placeholder, and real rules are meant to arrive as user-uploaded JSON with provenance. Keep it that way in code, fixtures, and tests.

## Working Agreement

Written for Opus 5 / Fable 5.1 defaults. Thinking is on by default — don't ask for it, and never ask for internal reasoning to be repeated back as response text.

- **Lead with the outcome.** First sentence answers "what happened" or "what did you find." Supporting detail after.
- **Be brief.** Short caveats, most of the response on the answer. Match document length to the task — no filler sections or redundant summaries.
- **Act when you have enough information.** Don't re-derive settled facts or narrate options you won't pursue.
- **Report only what you can point to.** Before calling a step done, check it against a tool result from this session. If tests fail, say so with the output. If a step was skipped, say that.
- **Stay in scope.** When I'm describing a problem or thinking out loud, the deliverable is your assessment — report and stop. Don't apply a fix until I ask.
- **Don't over-engineer.** No speculative abstraction, no cleanup surrounding a bug fix, no designing for hypothetical future requirements.
- **Pause only when it matters:** destructive or irreversible actions, a real scope change, or input only I can provide.
- **Delegate only when it pays.** Independent, parallelizable work — never to double-check your own output.

## Read this first: the docs describe intent, not status

`INDEX.md`, `SERVICES_SUMMARY.md`, `IMPLEMENTATION_CHECKLIST.md` and `ARCHITECTURE.md` were generated in a cloud session (one still cites a `/sessions/.../mnt/...` path) and say "COMPLETE — production-ready". Verified on 2026-09-04:

- **No workspace passes `tsc --noEmit`.** See *Known type errors* below. The services only run because `tsx` strips types without checking them.
- **There are zero test files.** Every service's `npm test` runs the Node test runner over nothing and reports `fail 0`.
- **20 default rules load, not "30+".** `GET /api/rules` returns `count: 20`.
- `docs/` (10 files, ~6,000 lines) is the product spec and a 22-week, 8-engineer MVP plan. Useful for domain vocabulary and the intended event/command model; not a description of what exists.

The repo has **one commit**. Uncommitted local edits (as of 2026-09-04) are what make it install and run at all: `workspace:*` deps changed to `*` (npm does not understand the `workspace:` protocol), each package's `main` pointed at `src/index.ts` so `tsx` resolves cross-workspace imports from source, `dotenv` re-pinned to a real version, and the vision service switched to relative imports with an `__init__.py`. Don't revert those; commit them.

## Environments — read before running anything

This project is worked on from two places, and they are **not interchangeable**:

| | Primary | Secondary |
|---|---|---|
| Host | Claude Code in VS Code, inside a **Linux container** | Claude Code on **native Windows** |
| Shell | bash | PowerShell (a Bash tool is also available) |
| Repo path | `/mnt/c/Users/xray1/Claude projects/helm` | `C:\Users\xray1\Claude projects\helm` |

- **Never hardcode one path form** in scripts, configs, or docs. Use repo-relative paths, or give both.
- **`node_modules` is not portable between the two** (esbuild binaries for tsx and Vite). Switching sides → `rm -rf node_modules && npm install`. There is one hoisted `node_modules` at the root; the workspaces share it.
- **The vision service's Python deps are pinned for Python 3.11** (`python:3.11-slim` in its Dockerfile; `numpy==1.26.3` has no wheels for 3.13+). The Windows host has Python 3.14 — run vision through Docker, not a local venv, unless you install 3.11.

## Commands

```bash
npm install                 # Root install — workspaces are hoisted. Do NOT use `npm run install:all` (pre-workspaces leftover).
cp .env.example .env        # Ports, DATABASE_URL, AUTH_MODE=dev

npm run dev                 # api-gateway :3000, dice :3001, voice :3002, web console :5173 — all via tsx/vite, no DB needed
npm run dev:api             # …or one at a time: dev:dice, dev:voice, dev:web
npm run dev:vision          # uvicorn on :3003 — needs Python 3.11 + `pip install -r services/vision-service/requirements.txt`

npm run docker:up           # Everything incl. Postgres + vision; docker:down / docker:reset (drops the pg volume)
npm run db:init             # psql the schema in scripts/init-db.sql into the local Postgres (docker-compose does this on first boot)

npm run typecheck           # shared-types + state-engine + rules-engine only — currently FAILS (see below)
cd services/<name> && npx tsc --noEmit     # per-service check; api-gateway also fails on rootDir because it type-checks rules-engine source
cd apps/web-console && npm run type-check  # fails on a tsconfig project-reference error, not on code
```

Smoke test after starting `npm run dev`:

```bash
curl http://localhost:3000/api/health          # {"status":"ok",...}
curl http://localhost:3000/api/rules           # count: 20
curl -X POST http://localhost:3001/api/roll -H "Content-Type: application/json" -d '{"count":2,"sides":6}'
```

Node 24 works (README says 20+; Dockerfiles use `node:20-alpine`).

## Architecture

**Everything a client touches goes through `services/api-gateway`** (Express + `ws`, port 3000). It embeds, in-process, an instance of `@helm/rules-engine` (`services/rules-engine`) and its **own in-memory `StateEngine`** (`services/api-gateway/src/state-engine.ts`: two `Map`s, matches and event logs, lost on restart). REST routes are in `routes.ts` (create match, submit army, execute command with legality check, event log, override, advance phase, rules list/explain); `websocket.ts` handles `subscribe` / `command` / `ping` and broadcasts `state_update` / `command_result` / `event`. This is the whole MVP loop today.

**`services/state-engine` is the intended replacement and nothing runs it.** It is the event-sourced version: `EventStore` appends to the Postgres `events` table (`UNIQUE(match_id, sequence)`), `reducer.ts` rebuilds `MatchState` by replay, `command-to-events.ts` turns validated commands into events, and `index.ts` serves its own WebSocket on port 8080. It is not in `npm run dev`, not in `docker-compose.yml`, and the gateway's `state-engine.ts` carries the `TODO: Replace with @helm/state-engine` note. Postgres in docker-compose exists for this future path; the gateway ignores `DATABASE_URL`.

**`packages/shared-types` is the contract** — Zod schemas for events (`events.ts`), entities (`entities.ts`: `MatchState`, `Unit`, `Weapon`, `Phase` enum), commands (`commands.ts`, one discriminated union `MatchCommandSchema`) and results (`results.ts`). Both state engines and the rules engine import from it, and the known type errors are mostly places where a service drifted from these schemas. Change the schema first, then the consumers.

**Rules are data.** `rules-engine/src/default-rules.ts` is a list of `RuleDefinition`s whose conditions are dot-path field checks (`unit.status.hasMoved`) against a context built by `condition-evaluator.ts`; `RulesEngine.checkLegality(state, command)` returns a `LegalityResult` with `ruleId`, `explanation`, `suggestedFix`. An illegal command is blocked before any state mutation and the web console offers an audited override. Adding a rule means adding a definition, not code — unless it needs a new operator.

**Dice are auditable by construction.** `dice-service/src/dice-engine.ts` seeds a PRNG from `crypto.randomBytes`, returns `{ seed, results, hash }`, and `verify()` recomputes the SHA-256. Never call `Math.random()` for a game roll anywhere else.

**Voice is text-in, intent-out.** Speech-to-text happens client-side (Web Speech API); `voice-service/src/intent-parser.ts` pattern-matches transcripts into intents and `disambiguation.ts` resolves unit names against the roster. No model, no API key.

**Vision (`services/vision-service`, FastAPI)** exposes `/api/detect`, `/api/fingerprint`, `/api/identify`, `/api/calibrate`, `/api/terrain`, `/api/health`. `pipeline.py` holds the five components as classes with placeholder logic — there is no trained model in the repo (`VISION_MODEL_PATH` in `.env.example` points at a file that does not exist).

**Web console (`apps/web-console`, Vite + React + Zustand)** renders the battlefield on a canvas (`lib/canvas-renderer.ts`) from `store/match-store.ts`, fed by `hooks/useWebSocket.ts`. **The WebSocket URL is hardcoded** to `ws://localhost:3000/ws` in that hook; the `VITE_WS_URL` / `VITE_API_URL` variables in `docker-compose.yml` are not read.

## Known type errors (2026-09-04)

Fix these before trusting any typecheck as a regression signal:

- `uuid` has no bundled types and `@types/uuid` is installed in no workspace — every service that imports it fails with TS7016.
- `rules-engine/src/rules-engine.ts:48` reads `state.currentPhase`; `MatchStateSchema` calls it `phase` (`entities.ts:53`). The gateway's in-memory `StateEngine` also uses `currentPhase`, so gateway and rules engine agree with each other and disagree with the shared schema.
- `rules-engine.ts:79` builds a `LegalityResult` with an `id` field the schema does not have.
- `voice-service/src/index.ts:78` uses `requiresConfirmation` / `confirmationPrompt` as shorthand properties that are never declared.
- `state-engine/src/index.ts:80-87` passes `string | null` env values where `string` is required.
- `api-gateway`'s `tsc` fails with `rootDir` errors because `main: src/index.ts` makes it compile `rules-engine` source; a project reference or `rootDir: ..` is the fix, not reverting `main`.
- `apps/web-console/tsconfig.json` references `tsconfig.app.json`, which sets `noEmit` — TS6310. `vite build` still succeeds (verified: 57 modules, ~6s) because Vite does not use project references.

## Gotchas

- Match state lives in gateway memory. Restarting `dev:api` deletes every match; the web console will show a stale match id until you create a new one.
- `docker-compose.yml` mounts each service's `src/` into its container, so edits hot-reload under Docker too — but the Dockerfiles `npm install` only the workspaces they name; adding a new `@helm/*` dependency to a service means updating its Dockerfile's `--workspace` list.
- `npm run typecheck` at the root only covers three workspaces; the gateway, dice, voice and console each have to be checked in their own directory.
- `apps/web-console/QUICKSTART.md` says `cd web-console && npm install` — that path is pre-monorepo; install from the root.
