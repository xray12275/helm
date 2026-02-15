# Helm — AI Voice-First Warhammer 40K Referee

Helm is a real-time AI game guide and referee for Warhammer 40,000 tabletop play. It combines markerless model recognition, voice-first interaction, and hard-stop rules enforcement into a multi-device experience: iPhone for scanning and AR overlays, desktop/web for full battlefield view and logging.

## Quick Start

### Option A: Docker (Recommended)

```bash
cd helm
docker-compose up --build

# Services start at:
#   API Gateway:    http://localhost:3000
#   Dice Service:   http://localhost:3001
#   Voice Service:  http://localhost:3002
#   Vision Service: http://localhost:3003
#   Web Console:    http://localhost:5173
```

### Option B: Local Development

**Prerequisites:** Node 20+, Python 3.11+, PostgreSQL 16+

```bash
# 1. Install all dependencies
npm run install:all
cd services/vision-service && pip install -r requirements.txt && cd ../..

# 2. Start PostgreSQL (or use Docker for just the DB)
docker-compose up postgres -d

# 3. Initialize the database
npm run db:init

# 4. Copy environment config
cp .env.example .env

# 5. Start all TS services (in parallel)
npm run dev

# 6. Start vision service separately (Python)
npm run dev:vision
```

### Verify It Works

```bash
# Create a match
curl -X POST http://localhost:3000/api/matches \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Match", "gameSize": "strike_force"}'
# Returns: { "matchId": "abc-123", ... }

# Get match state
curl http://localhost:3000/api/matches/abc-123

# Roll dice (auditable)
curl -X POST http://localhost:3001/api/roll \
  -H "Content-Type: application/json" \
  -d '{"count": 10, "sides": 6}'

# Parse a voice command
curl -X POST http://localhost:3002/api/transcribe \
  -H "Content-Type: application/json" \
  -d '{"transcript": "move Intercessors to objective 2", "matchContext": {"phase": "movement"}}'

# Open web console
open http://localhost:5173
```

---

## Architecture

```
┌──────────────┐     WebSocket      ┌──────────────────────┐
│  iPhone App  │◄──────────────────►│    API Gateway       │
│  (Swift/AR)  │                    │    :3000             │
└──────────────┘                    │  ┌────────────────┐  │
                                    │  │ State Engine    │  │
┌──────────────┐     WebSocket      │  │ (event-sourced) │  │
│ Web Console  │◄──────────────────►│  └────────────────┘  │
│ (React/TS)   │                    │  ┌────────────────┐  │
│  :5173       │                    │  │ Rules Engine    │  │
└──────────────┘                    │  │ (hard-stop)    │  │
                                    │  └────────────────┘  │
                                    └──────────┬───────────┘
                                               │
                    ┌──────────────┬────────────┼────────────┐
                    │              │            │            │
              ┌─────▼─────┐ ┌─────▼─────┐ ┌───▼──────┐ ┌───▼──────┐
              │  Dice Svc  │ │ Voice Svc │ │Vision Svc│ │PostgreSQL│
              │   :3001    │ │   :3002   │ │  :3003   │ │  :5432   │
              │ (audit RNG)│ │ (intents) │ │(CV/embed)│ │(events)  │
              └────────────┘ └───────────┘ └──────────┘ └──────────┘
```

### Command Pipeline

```
Client Command → Parse (Zod) → Get State (replay events) → Legality Check
    ├─ LEGAL    → Generate Events → Append to Store → Broadcast to clients
    └─ ILLEGAL  → IllegalActionBlocked event → Return {ruleId, explanation, fix}
                  → Client shows Override modal (referee can bypass with audit)
```

---

## Repository Structure

```
helm/
├── docs/                           # 9 technical documents
│   ├── PRODUCT_OVERVIEW.md         # Vision, personas, core loops
│   ├── ARCHITECTURE.md             # System design, data flow
│   ├── DATA_MODEL.md               # Zod schemas, event types
│   ├── API_CONTRACTS.md            # WebSocket + REST specs
│   ├── VOICE_GRAMMAR.md            # Commands, disambiguation
│   ├── VISION_PIPELINE.md          # Markerless CV pipeline
│   ├── RULES_ENGINE.md             # Legality, hard stops
│   ├── SECURITY_PRIVACY.md         # Encryption, privacy
│   └── MVP_PLAN.md                 # M0–M6 milestones
│
├── packages/shared-types/          # Zod schemas (events, entities, commands)
├── services/
│   ├── api-gateway/                # Express + WebSocket (REST + WS)
│   ├── state-engine/               # Event store + reducer + state manager
│   ├── rules-engine/               # Legality checks + hard-stop enforcement
│   ├── dice-service/               # Auditable RNG (seed + SHA-256)
│   ├── voice-service/              # Intent parsing + disambiguation
│   └── vision-service/             # Python CV pipeline (FastAPI)
├── apps/web-console/               # React + TS + Vite + Tailwind
├── devdata/                        # Mock data (NO copyrighted content)
├── scripts/init-db.sql             # PostgreSQL schema
└── docker-compose.yml              # Full dev stack
```

---

## Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| State | Event-sourced (Postgres) | Deterministic replay, undo, audit |
| Rules | Hard-stop in pipeline | Blocks before mutation; no illegal state |
| Recognition | Markerless CV + fingerprint | No tags on minis; ≤5s scan/unit |
| Duplicates | Auto-label A/B/C | Roster-constrained embedding match |
| Voice | PTT + Web Speech API + server intent parse | Offline STT; server just parses text |
| Sync | WebSocket pub/sub | iPhone scans, desktop views; real-time |
| Rules data | Pluggable JSON (user-uploaded) | No IP embedded; provenance tracked |
| Dice | Seed + SHA-256 | Auditable, verifiable, fair |

---

## IP Posture

**Zero copyrighted GW content in this repo.** All mock data uses generic placeholders. The system supports user-provided data ingestion with provenance tracking. Architecture is designed for eventual official licensing.

---

## Next 10 Tickets

| # | Title | P | Pts | Milestone |
|---|-------|---|-----|-----------|
| 1 | **Vertical Slice: Phase Advance E2E** — "Next Phase" button → WS → state engine → broadcast → all clients update | P0 | 5 | M1 |
| 2 | **Unit Movement + Legality** — Click unit → click destination → distance check → hard-stop if over M" → OverrideModal | P0 | 8 | M2 |
| 3 | **Attack Declaration + Dice Resolution** — Show eligible targets → roll hit/wound/save → AttackResolved event → wounds applied | P0 | 8 | M3 |
| 4 | **BattleScribe / WH App Import** — Parse .ros/.rosz XML and WH+ text → extract units, wargear, enhancements → validate | P1 | 5 | M6 |
| 5 | **Pre-Game Fingerprint Scan** — ≤5s/unit, 4 angles, MobileNet embedding, A/B/C auto-label for duplicates | P1 | 13 | M4 |
| 6 | **Terrain Scanning + AR Overlay** — Edge detection → footprints → user confirms type → stored in match → cover/LOS in shooting | P1 | 8 | M5 |
| 7 | **Voice: Movement Commands** — "Move Intercessors A six inches forward" → intent → command → legality → execute → confirm | P1 | 5 | M5 |
| 8 | **Battle-Shock Automation** — Command phase: ID half-strength units → prompt test → roll → mark shocked → block stratagems | P2 | 3 | M2 |
| 9 | **Stratagem Timing Enforcement** — Phase/trigger validation, CP check, once-per-phase, Battle-shock blocking | P2 | 8 | M3 |
| 10 | **Match Replay + Undo** — Timeline scrubber, click event to see past state, undo last event, "Live" button | P2 | 5 | M3 |
