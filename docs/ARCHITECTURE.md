# Helm: Architecture

## System Overview

Helm is a distributed system spanning iPhone client, web console, and cloud backend. The architecture is event-sourced with CQRS (Command Query Responsibility Segregation), ensuring a single authoritative event log and multiple read-optimized projections.

**Core principle:** Every action is a command, every state change is an event. Illegality is detected **before** events are committed; once committed, events are immutable (audit trail).

---

## High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                    │
│ ┌────────────────────┐             ┌────────────────────────────────┐   │
│ │    iPhone (Swift)  │             │   Web Console (React/TypeScript)   │
│ │  ┌──────────────┐  │             │  ┌─────────────────────────────┐  │
│ │  │ Vision Svc   │  │             │  │ Match Dashboard             │  │
│ │  │ (MobileNet)  │  │             │  │ - Table overview            │  │
│ │  │ - Unit ID    │  │             │  │ - Event log                 │  │
│ │  │ - Tracking   │  │             │  │ - Objectives                │  │
│ │  ├──────────────┤  │             │  │ - Ref tools (override,      │  │
│ │  │ Voice I/O    │  │             │  │   manual entry)             │  │
│ │  │ (Whisper API)│  │             │  │ - Export                    │  │
│ │  ├──────────────┤  │             │  └─────────────────────────────┘  │
│ │  │ AR Overlay   │  │             │  ┌─────────────────────────────┐  │
│ │  │ (ARKit)      │  │             │  │ Multi-Table Dashboard (TO)  │  │
│ │  │ - Live feed  │  │             │  │ - 8+ tables heatmap         │  │
│ │  │ - Ranges     │  │             │  │ - Block frequency           │  │
│ │  │ - LoS        │  │             │  │ - Dispute log               │  │
│ │  ├──────────────┤  │             │  └─────────────────────────────┘  │
│ │  │ UI (SwiftUI) │  │             │                                     │
│ │  │ - Tap CMDs   │  │             │                                     │
│ │  │ - Feedback   │  │             │                                     │
│ │  └──────────────┘  │             │                                     │
│ └────────────────────┘             └────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┬──────────────────┘
                       │  WebSocket (real-time)       │  REST (async)
                       │  ws://api.helm.local:8000    │  https://...
                       ▼                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       CLOUD SERVICES (AWS / GCP)                         │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                    API GATEWAY (Kong)                          │   │
│  │  - Auth (JWT tokens, device pairing)                          │   │
│  │  - Rate limiting, abuse prevention                            │   │
│  │  - Request validation                                         │   │
│  │  - CORS, TLS termination                                      │   │
│  └────────────────────────────────────────────────────────────────┘   │
│       │                 │                    │                 │        │
│       ▼                 ▼                    ▼                 ▼        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ STATE-      │  │ RULES-       │  │ VISION-      │  │ VOICE-     │  │
│  │ ENGINE      │  │ ENGINE       │  │ SERVICE      │  │ SERVICE    │  │
│  │             │  │              │  │              │  │            │  │
│  │ - Command   │  │ - Legality   │  │ - Unit ID    │  │ - Speech-  │  │
│  │   pipeline  │  │   check      │  │   (classify, │  │   to-text  │  │
│  │ - Event     │  │ - Effect     │  │   embed)     │  │ - Intent   │  │
│  │   commit    │  │   resolver   │  │ - Tracking   │  │   parsing  │  │
│  │ - State     │  │ - Explainer  │  │ - Confidence │  │ - Grammar  │  │
│  │   reduce    │  │ - Rule JSON  │  │   scoring    │  │   engine   │  │
│  │ - Broadcast │  │   loader     │  │ - LiDAR      │  │ - Cmd      │  │
│  │             │  │ - Condition  │  │   fusion     │  │   resolution│  │
│  │             │  │   evaluator  │  │              │  │            │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
│       │                 │                    │                 │        │
│       └─────────────────┴────────────────────┴─────────────────┘        │
│                              │                                         │
│                              ▼                                         │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                    EVENT STORE (PostgreSQL)                   │   │
│  │  - Immutable append-only log of all events                   │   │
│  │  - Partitioned by matchId                                    │   │
│  │  - Indexed by timestamp, unitId, playerId for quick replay   │   │
│  │  - Retention: permanent (immutable audit trail)             │   │
│  └───────────────────────────────────────────────────────────────┘   │
│       │                                                               │
│       ▼                                                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ MATERIALIZED VIEWS (Redis + PostgreSQL)                     │   │
│  │ - CurrentMatchState (unit positions, wounds, status flags)  │   │
│  │ - PlayerStats (kill counts, points, overrides used)         │   │
│  │ - RuleLibrary (loaded reference data, versioned)            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ SUPPORT SERVICES                                             │   │
│  │ - DICE-SERVICE: Auto-detect physical dice via camera        │   │
│  │ - FILE-SERVICE: Store video debug clips (TTL 1h)            │   │
│  │ - RULES-LOADER: Validate + ingest user rule definitions     │   │
│  │ - AUDIT-LOG: Override trail, compliance records             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ PERSISTENCE LAYER                                            │   │
│  │ ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │ │ PostgreSQL       │  │ Redis (cache)│  │ S3 (videos)  │   │   │
│  │ │ - Events         │  │ - Match state│  │ - Debug      │   │   │
│  │ │ - Matches        │  │ - LoS cache  │  │   clips      │   │   │
│  │ │ - Users/armies   │  │ - LiDAR maps │  │              │   │   │
│  │ │ - Audit trails   │  │              │  │              │   │   │
│  │ └──────────────────┘  └──────────────┘  └──────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: iPhone ↔ Cloud ↔ Desktop

### Scenario: Player moves Intercessors on iPhone

```
IPHONE (Client)                    CLOUD (Services)                DESKTOP (Console)
────────────────                   ─────────────────                ────────────────

User voice: "Move Intercessors"
    │
    ├─→ Voice-Service (on-device intent parse)
    │   Detects intent: MovementCommand
    │   Extracts: unitLabel="Intercessors", action="move"
    │
    ├─→ WebSocket COMMAND:
    │   {
    │     type: "MoveUnit",
    │     matchId: "m123",
    │     unitId: "u456_intercessors_a",
    │     targetPosition: { x: 24, y: 18 }
    │   }
    │
    │                            API-GATEWAY receives
    │                            Auth: JWT token ✓
    │                            Rate limit: 100 req/s ✓
    │                               │
    │                               ├─→ STATE-ENGINE:
    │                               │   Extracts current state from
    │                               │   Materialized View (Redis)
    │                               │   Current: Intercessors_A at (20,16)
    │                               │   Distance: 4.5" → legal
    │                               │
    │                               ├─→ RULES-ENGINE:
    │                               │   Check coherency (units within 2"?)
    │                               │   Check engagement range (in combat?)
    │                               │   Check distance (max 6" in this phase)
    │                               │   Result: isLegal=true
    │                               │
    │                               ├─→ STATE-ENGINE:
    │                               │   Commit event:
    │                               │   {
    │                               │     type: "UnitMoved",
    │                               │     matchId: "m123",
    │                               │     unitId: "u456",
    │                               │     fromPos: {x:20, y:16},
    │                               │     toPos: {x:24, y:18},
    │                               │     distance: 4.5,
    │                               │     distance_unit: "inches",
    │                               │     phase: "movement",
    │                               │     timestamp: "2025-02-15T14:32:01Z",
    │                               │     playerId: "p1"
    │                               │   }
    │                               │   → Append to Event Store (PostgreSQL)
    │                               │   → Update Materialized View
    │                               │   → Broadcast via WebSocket
    │                               │
    │                               ├─→ BROADCAST:
    │                               │   {
    │                               │     type: "StateUpdate",
    │                               │     matchId: "m123",
    │                               │     unit: {
    │                               │       id: "u456",
    │                               │       position: {x:24, y:18},
    │                               │       status: "moved"
    │                               │     }
    │                               │   }
    │
    ├─ WebSocket receives broadcast
    │  Vision service updates tracking (new reference position)
    │  AR overlay moves Intercessors blue label to (24,18)
    │  UI shows "✓ Moved Intercessors 4.5 inches"               ─→ WebSocket receives
                                                                   same broadcast
                                                                   Dashboard updates:
                                                                   - Unit position on map
                                                                   - Event log appends
                                                                   - Logs: "P1 moved
                                                                   - Intercessors A 4.5""
```

### Scenario: Player tries illegal action on iPhone

```
User voice: "Move Intercessors 8 inches"
    │
    ├─→ WebSocket COMMAND:
    │   type: "MoveUnit",
    │   targetPosition: (28, 16)  [8" from (20,16)]
    │
    │                            STATE-ENGINE checks distance ✓
    │                            8" > 6" max
    │
    │                            RULES-ENGINE:
    │                            - Rule: "Movement distance ≤ 6 inches"
    │                            - Condition: isMovementPhase && unit.moveDistance > 6
    │                            - Result: ILLEGAL
    │                            │
    │                            ├─→ NOT committed to Event Store
    │                            ├─→ Generate explanatory response:
    │                            │   {
    │                            │     type: "CommandBlocked",
    │                            │     reason: "Movement distance exceeds 6 inches",
    │                            │     ruleId: "CORE.MOVEMENT.DISTANCE_LIMIT",
    │                            │     explanation: "In the movement phase, units can move up to 6 inches...",
    │                            │     suggestedFix: "Try 6 inches or less",
    │                            │     detailedReason: {
    │                            │       rule: "Core Rules, Movement Phase",
    │                            │       condition: "moveDistance > 6",
    │                            │       actualValue: 8,
    │                            │       limit: 6
    │                            │     }
    │                            │   }
    │
    ├─ WebSocket receives CommandBlocked
    │  iPhone voice feedback: "Intercessors can move 6 inches. You've moved 8. Not allowed."
    │  AR overlay shows: "8" in red, legal range in blue circle (6" radius)
    │  Player can retry with "Move Intercessors 6 inches"
```

---

## Service Architecture

### 1. API Gateway (Kong)
**Responsibility:** HTTP/WebSocket entry point, authentication, rate limiting, request validation

**Endpoints:**
- `POST /auth/login` — JWT token generation (device pairing)
- `WS /match/:matchId` — Real-time command/event channel
- `POST /match/:matchId/manual-override` — Referee manual correction (audit logged)
- `GET /match/:matchId/state` — Fetch current match state snapshot
- `POST /match/:matchId/event-log` — Fetch paginated event history
- `POST /vision/calibrate` — Table homography calibration (iPhone → cm coordinates)
- `POST /rules-library/upload` — User rule definition upload with provenance
- `POST /army/import` — BattleScribe/WH+ JSON import

**Rate Limiting:**
- 100 commands/second per match
- 10 rule library uploads/day per user
- 100 queries/second per device

---

### 2. State Engine (Node.js / Rust)
**Responsibility:** Command validation, event commit, state reduction, broadcast

**Input:** Commands (WebSocket)
```typescript
interface Command {
  type: "MoveUnit" | "Attack" | "UseStratagem" | "RollDice" | ...;
  matchId: string;
  playerId: string;
  timestamp: ISO8601;
  payload: CommandPayload;
}
```

**Processing:**
1. **Legality pre-check** (rules-engine call)
   - Returns `{ isLegal: boolean, ruleId?: string, explanation?: string }`
2. **If illegal:** Return `CommandBlocked` to client, do NOT proceed
3. **If legal:**
   - Create event from command + result metadata
   - Append to event store
   - Update materialized view (Redis)
   - Broadcast via WebSocket to all subscribers

**Output:** Events (PostgreSQL Event Store + Redis Materialized View)
```typescript
interface Event {
  id: string; // UUID
  matchId: string;
  type: EventType; // discriminated union
  aggregateId: string; // unitId or matchId
  timestamp: ISO8601;
  playerId: string;
  payload: EventPayload;
  sequenceNumber: number; // per match
}
```

**Broadcast:** WebSocket `StateUpdate` to all connected clients (iPhone + desktop)

---

### 3. Rules Engine (Rust / Node.js)
**Responsibility:** Rule evaluation, legality decisions, hard-stop enforcement

**Rule Structure** (JSON/YAML from user-provided library):
```json
{
  "id": "CORE.MOVEMENT.DISTANCE_LIMIT",
  "category": "movement",
  "phase": ["movement"],
  "title": "Movement Distance",
  "description": "In the movement phase, a unit can move up to 6 inches.",
  "conditions": [
    {
      "field": "unit.moveDistance",
      "operator": ">",
      "value": 6
    }
  ],
  "effect": "block",
  "explanation": "Units can move a maximum of 6 inches in the movement phase.",
  "suggestedFix": "Move the unit 6 inches or less.",
  "source": {
    "ruleBook": "Warhammer 40,000 Core Rules",
    "edition": "10th",
    "uploadedBy": "user@example.com",
    "uploadedAt": "2025-01-15T10:00:00Z"
  }
}
```

**Legality Check Function:**
```typescript
function checkLegality(command: Command, currentState: MatchState, rules: Rule[]): LegalityResult {
  const applicableRules = rules.filter(r =>
    r.phase.includes(currentState.currentPhase) &&
    r.category.includes(command.category)
  );

  for (const rule of applicableRules) {
    const conditionsMet = evaluateConditions(rule.conditions, command, currentState);
    if (conditionsMet && rule.effect === "block") {
      return {
        isLegal: false,
        ruleId: rule.id,
        explanation: rule.explanation,
        suggestedFix: rule.suggestedFix,
        detailedReason: {
          rule: rule.description,
          condition: rule.conditions,
          actualValue: extractValue(command, rule.conditions[0].field),
          limit: rule.conditions[0].value
        }
      };
    }
  }

  return { isLegal: true };
}
```

**Hard-Stop Enforcement:**
- Every command flows through `checkLegality()` before commit
- Illegal commands **never** update state
- Overrides require explicit audit entry: `{ ruleId, reason, overriddenBy, timestamp }`

---

### 4. Vision Service (Python / Rust)
**Responsibility:** Unit detection, embedding extraction, tracking, confidence scoring

**On-Device Processing (iPhone, TensorFlow Lite):**
- MobileNet-v3 backbone (224×224 input)
- Embedding layer: 128-dimensional vector
- Inference latency: ~50ms per frame

**Server Processing (cloud, inference acceleration):**
- Fingerprint storage: embeddings + metadata
- Real-time matching: incoming frame embedding → cosine similarity to fingerprint database
- Tracking: DeepSORT or ByteTrack (temporal coherence)
- Confidence: if similarity > 0.85 → 95% confidence; if 0.70–0.85 → 70% confidence; < 0.70 → prompt manual confirm

**Pipeline:**
```
Frame → Base Detection (Hough/YOLO) → Unit Crop → MobileNet Embedding
  → Compare to Fingerprints (cosine sim) → Top-K (k=3) matches
  → Roster Constraints (must match roster composition) → A/B/C Label
  → Track Temporal (DeepSORT) → Confidence Score
```

---

### 5. Voice Service (Python / Rust)
**Responsibility:** Speech-to-text, intent parsing, command generation

**Components:**
- **Speech Recognition:** Whisper API (OpenAI) or local Vosk for offline
- **Intent Parser:** Rule-based grammar + fuzzy matching
- **Command Generator:** Intent → Command object (ready for State Engine)

**Voice Grammar Example:**
- Input: "Move Intercessors to objective 2"
- Parse: `MovementIntent { unitLabel: "Intercessors", targetObjective: 2 }`
- Generate: `Command { type: "MoveUnit", unitId: "...", targetPosition: ... }`
- Ambiguity: If 2× Intercessor squads, prompt: "Intercessors A or B?"
- Fallback: If confidence < 60%, suggest tap alternative

---

### 6. Dice Service (Python)
**Responsibility:** Auto-detect physical dice rolls via camera feed

**On-device:**
- Camera captures die faces during roll
- CV2 template matching identifies die value (1–6)
- Tracks multiple dice in field → extracts count and sum
- Optional: Voice confirm "You rolled 8 hits?" → Yes/No

---

## Event Store Schema (PostgreSQL)

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL,
  aggregate_id UUID NOT NULL, -- unit_id or match_id
  event_type VARCHAR(64) NOT NULL,
  sequence_number BIGINT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  player_id UUID NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexing for fast replay/query
  UNIQUE(match_id, sequence_number),
  INDEX(match_id, timestamp),
  INDEX(aggregate_id),
  INDEX(event_type, timestamp)
);

-- Event types:
-- MatchStarted, PhaseAdvanced, UnitMoved, AttackDeclared,
-- DiceRolled, AttackResolved, UnitDestroyed, StratagemUsed,
-- IllegalActionBlocked, OverrideApplied, ObjectiveScored
```

## Materialized View: Current Match State (Redis)

```json
{
  "matchId": "m123",
  "currentPhase": "movement",
  "currentPlayer": "p1",
  "units": [
    {
      "id": "u456_intercessors_a",
      "playerId": "p1",
      "label": "Intercessors A",
      "datasheet": "Intercessors",
      "position": { "x": 24, "y": 18 },
      "hasMovedThisTurn": true,
      "hasAdvanced": false,
      "hasAttacked": false,
      "isBattleShocked": false,
      "isInEngagement": false,
      "hasFallenBack": false,
      "wounds": 5,
      "maxWounds": 10,
      "morale": "steady"
    }
  ],
  "objectives": [
    { "id": "obj1", "position": { "x": 24, "y": 24 }, "holder": null, "points": 3 }
  ],
  "terrain": [
    { "id": "t1", "name": "Ruin A", "footprint": "polygon", "coordinates": [...] }
  ]
}
```

## WebSocket Protocol

### Client → Server (Commands)
```json
{
  "type": "Command",
  "matchId": "m123",
  "command": {
    "type": "MoveUnit",
    "unitId": "u456",
    "targetPosition": { "x": 24, "y": 18 },
    "phase": "movement"
  }
}
```

### Server → Client (Broadcasts)
```json
{
  "type": "CommandAccepted" | "CommandBlocked" | "StateUpdate" | "PhaseAdvanced",
  "matchId": "m123",
  "data": { ... }
}
```

---

## Offline Mode

iPhone queues commands locally if WebSocket disconnected. On reconnection:
1. Sync event log from server (ask for events since last ACK)
2. Re-apply local queue if server state matches
3. Conflict resolution: Server state wins; local queue discarded with user notification

---

## Deployment Architecture

**iPhone:** Bundled MobileNet model (4 MB), real-time TF Lite inference, WebSocket client

**Cloud (Kubernetes):**
- API Gateway: 3 replicas (Kong)
- State Engine: 5 replicas (CPU-bound)
- Rules Engine: 3 replicas (rules evaluation)
- Vision Service: 2 replicas (GPU for batch inference)
- Voice Service: 2 replicas (speech API clients)
- Dice Service: 1 replica (on-demand)

**Data Store:**
- PostgreSQL (primary): Events, matches, users, audit logs (read replicas for queries)
- Redis: Materialized views, session cache, LoS pre-compute cache
- S3: Debug video clips (lifecycle policy: delete after 24h)

---

## References

- [DATA_MODEL.md](DATA_MODEL.md) — Event and entity schemas
- [API_CONTRACTS.md](API_CONTRACTS.md) — WebSocket and REST details
- [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md) — Data encryption, auth flow
