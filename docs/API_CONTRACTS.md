# Helm: API Contracts

## Overview

Helm exposes a hybrid API: real-time WebSocket for match gameplay and REST for administrative tasks (match creation, army imports, rules uploads). All communication is JSON-formatted with strong type contracts defined in DATA_MODEL.md.

---

## WebSocket API

### Connection

**Endpoint:** `wss://api.helm.local/match/:matchId`

**Headers:**
```http
Authorization: Bearer <JWT_TOKEN>
X-Device-Id: <DEVICE_UUID>
X-Client-Version: 1.0.0
```

**Connection Flow:**
1. Client connects with JWT token (from `POST /auth/login`)
2. Server validates token and device pairing
3. Server sends `ConnectionEstablished` with current match state
4. Client can now send commands and receive broadcasts

**Error Handling:**
- 401 Unauthorized: Invalid or expired token
- 403 Forbidden: Device not paired to user
- 404 Not Found: Match does not exist
- 429 Too Many Requests: Rate limit exceeded (100 commands/sec per match)

---

### Command → Legality Check → Event → Broadcast

**Command Flow Diagram:**

```
Client Command               Server Processing             Broadcast
─────────────────          ────────────────────           ─────────

{                          API Gateway                    {
  type: "MoveUnit"         - Auth check ✓                  type: "StateUpdate",
  unitId: "u456"      →    - Rate limit ✓         →       data: {
  targetPos: {x, y}        │                              unit: {
}                          STATE-ENGINE                     id: "u456",
                           - Extract current state         position: {x, y},
                             from Redis                    statusFlags: {...}
                           - Call RULES-ENGINE             }
                           │                            }
                           RULES-ENGINE
                           - Check legality
                           - Return {isLegal, ruleId,
                             explanation}
                           │
                        [isLegal?]
                        /          \
                       YES         NO
                       │           └─→ CommandBlocked
                       │               {
                       STATE-ENGINE      type: "CommandBlocked",
                       - Create event    ruleId: "...",
                       - Commit to       explanation: "...",
                         Event Store     suggestedFix: "..."
                       - Update Redis    }
                       - Broadcast to
                         all WebSocket
                         clients
```

---

### WebSocket Message Types (Client → Server)

#### Command Messages

```typescript
interface WebSocketCommand {
  type: 'Command';
  matchId: string;
  clientId: string;
  sequence: number; // For deduplication
  command: CommandPayload;
  timestamp: ISO8601;
}

type CommandPayload =
  | MoveUnitCommand
  | AttackCommand
  | RollDiceCommand
  | UseStratagemCommand
  | AdvancePhaseCommand
  | EndTurnCommand
  | QueryRuleCommand;
```

#### MoveUnitCommand
```typescript
interface MoveUnitCommand {
  type: 'MoveUnit';
  unitId: string;
  targetPosition: { x: number; y: number };
  moveType: 'normal' | 'advance' | 'fallback';
  phase: string;
}

// Example
{
  "type": "Command",
  "matchId": "m123",
  "clientId": "iphone-player1",
  "sequence": 42,
  "command": {
    "type": "MoveUnit",
    "unitId": "u456_intercessors_a",
    "targetPosition": { "x": 24, "y": 18 },
    "moveType": "normal",
    "phase": "movement"
  },
  "timestamp": "2025-02-15T14:32:01Z"
}
```

#### AttackCommand
```typescript
interface AttackCommand {
  type: 'Attack';
  attackingUnitId: string;
  targetUnitId: string;
  weaponId: string;
  numberOfAttacks: number;
}

// Example
{
  "type": "Command",
  "matchId": "m123",
  "command": {
    "type": "Attack",
    "attackingUnitId": "u456_intercessors_a",
    "targetUnitId": "u789_guardsmen_b",
    "weaponId": "w_bolter",
    "numberOfAttacks": 8
  }
}
```

#### RollDiceCommand
```typescript
interface RollDiceCommand {
  type: 'RollDice';
  unitId: string;
  rollType: 'hit' | 'wound' | 'save' | 'charge' | 'morale' | 'psychic';
  diceCount: number;
  results: number[]; // [1-6 per die]
  detectionMethod: 'voice' | 'camera' | 'manual';
}

// Example (voice input)
{
  "type": "Command",
  "matchId": "m123",
  "command": {
    "type": "RollDice",
    "unitId": "u456_intercessors_a",
    "rollType": "hit",
    "diceCount": 4,
    "results": [3, 5, 2, 4],
    "detectionMethod": "voice"
  }
}
```

#### UseStratagemCommand
```typescript
interface UseStratagemCommand {
  type: 'UseStratagem';
  stratagemId: string;
  targetUnitId?: string;
  targetObjectiveId?: string;
}
```

#### AdvancePhaseCommand
```typescript
interface AdvancePhaseCommand {
  type: 'AdvancePhase';
  fromPhase: string;
  toPhase: string;
}

// Example
{
  "type": "Command",
  "matchId": "m123",
  "command": {
    "type": "AdvancePhase",
    "fromPhase": "movement",
    "toPhase": "psychic"
  }
}
```

#### QueryRuleCommand
```typescript
interface QueryRuleCommand {
  type: 'QueryRule';
  query: string; // e.g., "coherency", "engagement range"
}
```

---

### WebSocket Message Types (Server → Client)

#### ConnectionEstablished
```typescript
interface ConnectionEstablished {
  type: 'ConnectionEstablished';
  matchId: string;
  currentState: {
    currentPhase: string;
    currentPlayer: {
      id: string;
      name: string;
    };
    units: Unit[];
    objectives: Objective[];
    terrain: Terrain[];
    round: number;
    turn: number;
  };
  serverTime: ISO8601;
}
```

#### CommandAccepted
```typescript
interface CommandAccepted {
  type: 'CommandAccepted';
  matchId: string;
  commandSequence: number;
  event: GameEvent;
}

// Example
{
  "type": "CommandAccepted",
  "matchId": "m123",
  "commandSequence": 42,
  "event": {
    "id": "evt_001",
    "type": "unit_moved",
    "matchId": "m123",
    "playerId": "p1",
    "timestamp": "2025-02-15T14:32:01Z",
    "payload": {
      "unitId": "u456_intercessors_a",
      "fromPosition": { "x": 20, "y": 16 },
      "toPosition": { "x": 24, "y": 18 },
      "distance": 4.5,
      "moveType": "normal",
      "phase": "movement"
    }
  }
}
```

#### CommandBlocked
```typescript
interface CommandBlocked {
  type: 'CommandBlocked';
  matchId: string;
  commandSequence: number;
  reason: string;
  ruleId: string;
  explanation: string;
  suggestedFix: string;
  detailedReason?: {
    rule: string;
    condition: string;
    actualValue: any;
    limit: any;
  };
  fallbackOptions?: string[]; // Alternative commands user can try
}

// Example: Illegal move distance
{
  "type": "CommandBlocked",
  "matchId": "m123",
  "commandSequence": 43,
  "reason": "Movement distance exceeds maximum",
  "ruleId": "CORE.MOVEMENT.DISTANCE_LIMIT",
  "explanation": "In the movement phase, units can move up to 6 inches.",
  "suggestedFix": "Move the unit 6 inches or less.",
  "detailedReason": {
    "rule": "Core Rules, Movement Phase, page 34",
    "condition": "moveDistance > 6",
    "actualValue": 8,
    "limit": 6
  },
  "fallbackOptions": [
    "Try moving 6 inches",
    "Use Fall Back (6 inches, can't shoot this turn)"
  ]
}
```

#### StateUpdate (Broadcast to all clients)
```typescript
interface StateUpdate {
  type: 'StateUpdate';
  matchId: string;
  changes: {
    units?: Unit[];
    objectives?: Objective[];
    terrain?: Terrain[];
    currentPhase?: string;
    currentPlayer?: { id: string; name: string };
    round?: number;
    turn?: number;
  };
}

// Example
{
  "type": "StateUpdate",
  "matchId": "m123",
  "changes": {
    "units": [
      {
        "id": "u456_intercessors_a",
        "position": { "x": 24, "y": 18 },
        "statusFlags": {
          "hasMoved": true,
          "isInEngagement": false
        }
      }
    ]
  }
}
```

#### PhaseAdvanced
```typescript
interface PhaseAdvanced {
  type: 'PhaseAdvanced';
  matchId: string;
  fromPhase: string;
  toPhase: string;
  round: number;
  turn: number;
  currentPlayer: { id: string; name: string };
}
```

#### IllegalActionBlocked (Alternative broadcast format for some rule violations)
```typescript
interface IllegalActionBlockedBroadcast {
  type: 'IllegalActionBlocked';
  matchId: string;
  playerId: string;
  attemptedAction: string;
  ruleId: string;
  explanation: string;
  count: number; // How many times this player has tried illegal actions
}
```

#### RuleQueryResponse
```typescript
interface RuleQueryResponse {
  type: 'RuleQueryResponse';
  matchId: string;
  query: string;
  results: Array<{
    ruleId: string;
    title: string;
    description: string;
    source: {
      ruleBook: string;
      uploadedBy: string;
      uploadedAt: ISO8601;
    };
  }>;
}

// Example
{
  "type": "RuleQueryResponse",
  "matchId": "m123",
  "query": "coherency",
  "results": [
    {
      "ruleId": "CORE.UNIT_COHERENCY",
      "title": "Unit Coherency",
      "description": "Models in a unit must be within 2 inches of at least one other model in the same unit.",
      "source": {
        "ruleBook": "Warhammer 40,000 Core Rules 10th Edition",
        "uploadedBy": "admin@helm.local",
        "uploadedAt": "2025-01-15T10:00:00Z"
      }
    }
  ]
}
```

---

## REST API Endpoints

### Authentication

#### POST /auth/login
```
Request:
{
  "deviceId": "iphone-12-abc123",
  "userId": "user@example.com",
  "password": "***"
}

Response: 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600,
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

Error: 401 Unauthorized
{
  "error": "Invalid credentials"
}
```

#### POST /auth/device-pair
```
Request (from new iPhone):
{
  "deviceId": "iphone-13-def456",
  "userId": "user@example.com",
  "pairingCode": "ABC123"  // Sent via email/SMS
}

Response: 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "pairedAt": "2025-02-15T14:30:00Z"
}
```

---

### Match Management

#### POST /match
```
Request:
{
  "matchType": "matched_play",
  "pointLimit": 2000,
  "players": [
    { "name": "Alice", "armyId": "army-001" },
    { "name": "Bob", "armyId": "army-002" }
  ],
  "objectives": [
    { "name": "Objective 1", "position": { "x": 24, "y": 24 }, "points": 3 }
  ]
}

Response: 201 Created
{
  "id": "m123",
  "matchType": "matched_play",
  "status": "setup",
  "createdAt": "2025-02-15T14:00:00Z"
}
```

#### GET /match/:matchId
```
Response: 200 OK
{
  "id": "m123",
  "matchType": "matched_play",
  "status": "active",
  "currentPhase": "movement",
  "currentRound": 1,
  "currentTurn": 2,
  "players": [...],
  "units": [...],
  "objectives": [...]
}
```

#### GET /match/:matchId/events
```
Query Parameters:
  ?skip=0&limit=50&filter=unit_moved,attack_resolved

Response: 200 OK
{
  "total": 127,
  "skip": 0,
  "limit": 50,
  "events": [
    {
      "id": "evt_001",
      "type": "unit_moved",
      "timestamp": "2025-02-15T14:32:01Z",
      "payload": { ... }
    },
    ...
  ]
}
```

#### POST /match/:matchId/manual-override
```
Request (Tournament Referee only):
{
  "ruleId": "ENGAGEMENT_DISPUTE",
  "targetUnitId": "u456",
  "originalCommand": { "type": "MoveUnit", ... },
  "decision": "allowed",
  "reason": "Referee confirmed engagement range is actually 1.2 inches, allowing move.",
  "auditNote": "Photo evidence attached"
}

Response: 200 OK
{
  "id": "override_001",
  "appliedAt": "2025-02-15T14:35:00Z",
  "event": {
    "id": "evt_045",
    "type": "override_applied",
    "payload": { ... }
  }
}
```

---

### Army Management

#### POST /army/import
```
Request:
{
  "format": "battlescribe",  // or "wh_plus_app", "manual"
  "data": { ... },  // JSON from tool
  "name": "Space Marines 2000pts"
}

Response: 201 Created
{
  "id": "army-001",
  "name": "Space Marines 2000pts",
  "faction": "Ultramarines",
  "units": [
    {
      "id": "u456",
      "datasheet": "Intercessors",
      "models": 5,
      "weapons": [...]
    },
    ...
  ],
  "totalPoints": 2000,
  "source": "battlescribe",
  "importedAt": "2025-02-15T14:00:00Z"
}
```

#### GET /army/:armyId
```
Response: 200 OK
{
  "id": "army-001",
  "name": "Space Marines 2000pts",
  "units": [...],
  "strategems": [...],
  "enhancements": [...]
}
```

---

### Rules Library Management

#### POST /rules-library/upload
```
Request (multipart form-data):
  file: <JSON or YAML with rule definitions>
  name: "Warhammer 40K 10th Edition Core"
  edition: "10th"
  source: "official" | "community" | "homebrew"

Response: 201 Created
{
  "id": "rules-lib-001",
  "name": "Warhammer 40K 10th Edition Core",
  "ruleCount": 234,
  "uploadedBy": "admin@helm.local",
  "uploadedAt": "2025-02-15T14:00:00Z",
  "version": "1.0.0",
  "status": "active"
}
```

#### GET /rules-library
```
Query Parameters:
  ?edition=10th&source=official

Response: 200 OK
{
  "libraries": [
    {
      "id": "rules-lib-001",
      "name": "Warhammer 40K 10th Edition Core",
      "ruleCount": 234,
      "version": "1.0.0",
      "status": "active",
      "uploadedAt": "2025-02-15T14:00:00Z"
    }
  ]
}
```

#### GET /rules-library/:ruleId
```
Response: 200 OK
{
  "id": "CORE.MOVEMENT.DISTANCE_LIMIT",
  "title": "Movement Distance",
  "description": "In the movement phase, units can move up to 6 inches.",
  "category": "movement",
  "phase": ["movement"],
  "effect": "block",
  "source": {
    "ruleBook": "Warhammer 40,000 Core Rules",
    "edition": "10th",
    "uploadedBy": "admin@helm.local",
    "uploadedAt": "2025-01-15T10:00:00Z"
  }
}
```

---

### Vision & Calibration

#### POST /vision/calibrate
```
Request:
{
  "matchId": "m123",
  "calibrationImages": [
    { "url": "s3://bucket/calib_001.jpg", "description": "12-inch ruler" },
    { "url": "s3://bucket/calib_002.jpg", "description": "Center crosshairs" }
  ],
  "tableWidth": 48,
  "tableHeight": 30,
  "units": "inches"
}

Response: 200 OK
{
  "homography": [[...], [...], [...]],  // 3x3 transformation matrix
  "calibrationError": 0.12,  // RMSE in inches
  "confidence": 0.94,
  "calibratedAt": "2025-02-15T14:00:00Z"
}
```

#### POST /vision/fingerprint-scan
```
Request:
{
  "matchId": "m123",
  "unitId": "u456",
  "frames": [
    { "base64": "iVBORw0KGgo...", "angle": 0 },
    { "base64": "iVBORw0KGgo...", "angle": 90 },
    { "base64": "iVBORw0KGgo...", "angle": 180 },
    { "base64": "iVBORw0KGgo...", "angle": 270 }
  ],
  "captureTimeSeconds": 4.2
}

Response: 200 OK
{
  "unitId": "u456",
  "embedding": [0.123, 0.456, ...],  // 128-D vector
  "confidence": 0.92,
  "suggestedLabel": "Intercessors A",
  "duplicateWarning": true,
  "scannedAt": "2025-02-15T14:00:00Z"
}
```

---

### Debug & Logging

#### POST /debug/video-clip
```
Request (only if debug mode enabled):
{
  "matchId": "m123",
  "startTime": "2025-02-15T14:32:00Z",
  "endTime": "2025-02-15T14:32:15Z",
  "reason": "Disputed LoS check"
}

Response: 202 Accepted
{
  "clipId": "clip_001",
  "expiresAt": "2025-02-15T15:32:00Z",
  "downloadUrl": "s3://bucket/debug-clips/clip_001.mp4"
}
```

---

### Rate Limiting

All endpoints respect these limits:

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| WebSocket commands | 100/sec | per match |
| REST POST (match/army) | 10/min | per user |
| Rules library upload | 10/day | per user |
| Vision fingerprint | 60/match | (≤5s per scan × 12 units) |
| Debug video clips | 5/day | per user |

**Headers on 429 Too Many Requests:**
```http
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1613396400
```

---

## Error Response Format

```typescript
interface ErrorResponse {
  error: string;
  code: string;
  message: string;
  details?: {
    field?: string;
    reason?: string;
    suggestion?: string;
  };
  timestamp: ISO8601;
  requestId: string;
}

// Example
{
  "error": "CommandBlocked",
  "code": "MOVE_DISTANCE_EXCEEDED",
  "message": "Movement distance exceeds 6 inches",
  "details": {
    "field": "distance",
    "reason": "Intercessors moved 8 inches in movement phase",
    "suggestion": "Try 6 inches or use Fall Back instead"
  },
  "timestamp": "2025-02-15T14:32:01Z",
  "requestId": "req_12345"
}
```

---

## Request Deduplication

For WebSocket commands, use `sequence` numbers:
- Client increments sequence for each command (e.g., 1, 2, 3, ...)
- Server acknowledges with matching sequence number
- If duplicate received (same sequence), server returns cached response
- Client retries with new sequence number if no response after 5 seconds

**Deduplication Window:** 30 seconds per client

---

## References

- [DATA_MODEL.md](DATA_MODEL.md) — Event and entity types
- [ARCHITECTURE.md](ARCHITECTURE.md) — API Gateway, service endpoints
- [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md) — Authentication, TLS, rate limiting
