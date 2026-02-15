# Helm Usage Examples

## Quick Start

### 1. Start the State Engine

```bash
cd services/state-engine

# Install dependencies
npm install

# Set up environment
cat > .env << EOF
PORT=8080
DB_HOST=localhost
DB_PORT=5432
DB_NAME=helm
DB_USER=postgres
DB_PASSWORD=postgres
EOF

# Start the server
npm run dev
# Server listening on ws://localhost:8080
```

### 2. Client Connection (Browser or Node.js)

```typescript
import { MatchCommand, MatchEvent } from '@helm/shared-types';

const ws = new WebSocket('ws://localhost:8080');

// Subscribe to a match
ws.send(JSON.stringify({
  type: 'Subscribe',
  matchId: '550e8400-e29b-41d4-a716-446655440000'
}));

// Listen for state updates
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'StateUpdate') {
    console.log('Current match state:', message.state);
  }

  if (message.type === 'CommandResult') {
    console.log('Command result:', message.result);
  }
});
```

---

## Common Commands

### Moving a Unit

```typescript
const moveCommand = {
  type: 'MoveUnit',
  id: '550e8400-e29b-41d4-a716-446655440001',
  matchId: '550e8400-e29b-41d4-a716-446655440000',
  playerId: 'player-1',
  timestamp: new Date().toISOString(),
  unitId: '550e8400-e29b-41d4-a716-446655440002',
  destination: {
    x: 25,
    y: 30,
    tableInches: { x: 12, y: 15 }
  },
  moveType: 'normal' // or 'advance' or 'fallback'
};

ws.send(JSON.stringify({
  type: 'Command',
  command: moveCommand
}));
```

### Declaring an Attack

```typescript
const attackCommand = {
  type: 'DeclareAttack',
  id: uuidv4(),
  matchId: matchId,
  playerId: 'player-1',
  timestamp: new Date().toISOString(),
  attackerUnitId: 'unit-1',
  defenderUnitId: 'enemy-unit-1',
  weaponIds: ['weapon-1', 'weapon-2'] // Select specific weapons
};

ws.send(JSON.stringify({
  type: 'Command',
  command: attackCommand
}));
```

### Rolling Dice

```typescript
const diceCommand = {
  type: 'RollDice',
  id: uuidv4(),
  matchId: matchId,
  playerId: 'player-1',
  timestamp: new Date().toISOString(),
  purpose: 'hit', // 'hit', 'wound', 'save', 'charge', 'battleshock'
  diceCount: 10,
  targetValue: 3, // Need 3+ to succeed (rolls >= 3 count as success)
  modifiers: 0 // Additional modifiers
};

ws.send(JSON.stringify({
  type: 'Command',
  command: diceCommand
}));

// Response example:
// {
//   "status": "accepted",
//   "commandId": "...",
//   "events": [{
//     "type": "DiceRolled",
//     "diceCount": 10,
//     "dice": [1, 2, 4, 5, 6, 2, 3, 5, 6, 4],
//     "results": [0, 0, 1, 1, 1, 0, 1, 1, 1, 1], // 1 = success
//     "purpose": "hit"
//   }]
// }
```

### Advancing Phase

```typescript
const phaseCommand = {
  type: 'AdvancePhase',
  id: uuidv4(),
  matchId: matchId,
  playerId: 'player-1',
  timestamp: new Date().toISOString()
};

ws.send(JSON.stringify({
  type: 'Command',
  command: phaseCommand
}));

// Automatically progresses: command → movement → shooting → charge → fight → morale → command (next round)
```

### Using a Stratagem

```typescript
const stratagemCommand = {
  type: 'UseStratagem',
  id: uuidv4(),
  matchId: matchId,
  playerId: 'player-1',
  timestamp: new Date().toISOString(),
  stratagemId: 'stratagem-counter-offensive',
  targetUnitIds: ['unit-1', 'unit-2'],
  cpSpent: 1 // Command Point cost
};

ws.send(JSON.stringify({
  type: 'Command',
  command: stratagemCommand
}));
```

### Scoring Objectives

```typescript
const scoreCommand = {
  type: 'ScoreObjective',
  id: uuidv4(),
  matchId: matchId,
  playerId: 'player-1',
  timestamp: new Date().toISOString(),
  objectiveId: 'objective-1',
  points: 3 // Victory points
};

ws.send(JSON.stringify({
  type: 'Command',
  command: scoreCommand
}));
```

---

## Event Log Example

After executing commands, the event log might look like:

```json
[
  {
    "type": "MatchCreated",
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "matchId": "550e8400-e29b-41d4-a716-446655440000",
    "sequence": 1,
    "timestamp": "2024-01-15T10:00:00Z",
    "playerId": "admin",
    "players": [
      { "id": "player-1", "name": "Alice", "faction": "Necrons" },
      { "id": "player-2", "name": "Bob", "faction": "Space Marines" }
    ],
    "gameSize": "strike_force",
    "mission": "Incursion"
  },
  {
    "type": "ArmySubmitted",
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "matchId": "550e8400-e29b-41d4-a716-446655440000",
    "sequence": 2,
    "timestamp": "2024-01-15T10:05:00Z",
    "playerId": "player-1",
    "army": {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "faction": "Necrons",
      "detachment": "Szarekhan Dynasty",
      "totalPoints": 2000,
      "unitCount": 5
    }
  },
  {
    "type": "MatchStarted",
    "id": "550e8400-e29b-41d4-a716-446655440004",
    "matchId": "550e8400-e29b-41d4-a716-446655440000",
    "sequence": 3,
    "timestamp": "2024-01-15T10:10:00Z",
    "playerId": "admin"
  },
  {
    "type": "UnitMoved",
    "id": "550e8400-e29b-41d4-a716-446655440005",
    "matchId": "550e8400-e29b-41d4-a716-446655440000",
    "sequence": 4,
    "timestamp": "2024-01-15T10:15:00Z",
    "playerId": "player-1",
    "unitId": "unit-1",
    "from": { "x": 0, "y": 0, "tableInches": { "x": 0, "y": 0 } },
    "to": { "x": 6, "y": 4, "tableInches": { "x": 12, "y": 8 } },
    "moveType": "normal",
    "distanceMoved": 13.4
  },
  {
    "type": "AttackDeclared",
    "id": "550e8400-e29b-41d4-a716-446655440006",
    "matchId": "550e8400-e29b-41d4-a716-446655440000",
    "sequence": 5,
    "timestamp": "2024-01-15T10:16:00Z",
    "playerId": "player-1",
    "attackerUnitId": "unit-1",
    "defenderUnitId": "enemy-unit-1",
    "weaponIds": ["gauss-flayer", "gauss-flayer"]
  },
  {
    "type": "DiceRolled",
    "id": "550e8400-e29b-41d4-a716-446655440007",
    "matchId": "550e8400-e29b-41d4-a716-446655440000",
    "sequence": 6,
    "timestamp": "2024-01-15T10:17:00Z",
    "playerId": "player-1",
    "rollId": "550e8400-e29b-41d4-a716-446655440008",
    "purpose": "hit",
    "diceCount": 6,
    "dice": [2, 4, 6, 3, 5, 1],
    "results": [0, 1, 1, 1, 1, 0],
    "seed": "1705318620000-0.456"
  },
  {
    "type": "AttackResolved",
    "id": "550e8400-e29b-41d4-a716-446655440009",
    "matchId": "550e8400-e29b-41d4-a716-446655440000",
    "sequence": 7,
    "timestamp": "2024-01-15T10:18:00Z",
    "playerId": "player-1",
    "attackerUnitId": "unit-1",
    "defenderUnitId": "enemy-unit-1",
    "hits": 4,
    "wounds": 2,
    "unsavedWounds": 1,
    "modelsDestroyed": 1,
    "damageDealt": 1
  },
  {
    "type": "PhaseAdvanced",
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "matchId": "550e8400-e29b-41d4-a716-446655440000",
    "sequence": 8,
    "timestamp": "2024-01-15T10:20:00Z",
    "playerId": "admin",
    "from": "shooting",
    "to": "charge",
    "round": 1
  }
]
```

---

## State Reconstruction Example

Given the event log above, the match state would be:

```typescript
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "round": 1,
  "phase": "charge",
  "activePlayerId": "player-1",
  "gameSize": "strike_force",
  "mission": "Incursion",
  "isActive": true,
  "players": [
    {
      "id": "player-1",
      "name": "Alice",
      "faction": "Necrons",
      "cp": 7, // 8 starting CP (strike force) - 1 spent
      "vp": 0,
      "army": {
        "id": "550e8400-e29b-41d4-a716-446655440003",
        "faction": "Necrons",
        "detachment": "Szarekhan Dynasty",
        "totalPoints": 2000,
        "units": [
          {
            "id": "unit-1",
            "profileId": "immortals",
            "playerId": "player-1",
            "modelCount": 5,
            "modelsRemaining": 4, // Lost 1 model
            "woundsPerModel": 1,
            "woundsRemaining": 4,
            "position": {
              "x": 6,
              "y": 4,
              "tableInches": { "x": 12, "y": 8 }
            },
            "status": {
              "hasMoved": true,
              "hasAdvanced": false,
              "hasFallenBack": false,
              "hasShot": true, // Already attacked
              "hasCharged": false,
              "isInEngagement": false,
              "isBattleShocked": false,
              "remainedStationary": false
            },
            "label": "A",
            "enhancements": [],
            "isWarlord": false
          }
          // ... other units
        ]
      }
    },
    // ... player 2
  ],
  "terrain": [],
  "objectives": [],
  "turnLog": [
    "Match started at 2024-01-15T10:10:00Z",
    "Round 1 - command -> movement",
    "Round 1 - movement -> shooting",
    "Attack resolved: 4 hits, 2 wounds, 1 models destroyed",
    "Round 1 - shooting -> charge"
  ],
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:20:00Z"
}
```

---

## Blocked Command Example

If a player tries an illegal move:

```typescript
const illegalMoveCommand = {
  type: 'MoveUnit',
  id: uuidv4(),
  matchId: matchId,
  playerId: 'player-1',
  timestamp: new Date().toISOString(),
  unitId: 'unit-already-moved',
  destination: { x: 50, y: 50, tableInches: { x: 25, y: 25 } },
  moveType: 'normal'
};

ws.send(JSON.stringify({
  type: 'Command',
  command: illegalMoveCommand
}));

// Response:
// {
//   "status": "blocked",
//   "commandId": "...",
//   "ruleId": "UNIT_ALREADY_MOVED",
//   "explanation": "This unit has already moved this phase",
//   "suggestedFix": "Choose a different unit or advance phase",
//   "timestamp": "..."
// }
```

---

## Time Travel / Replay Example

```typescript
// Get all events for a match
const events = await eventStore.getEvents(matchId);

// Replay state at specific event
let state = createInitialState(events[0]);
for (let i = 0; i < 5; i++) { // Only replay first 5 events
  state = reduceEvent(state, events[i]);
}

// Now `state` represents match after the 5th event
console.log('State after 5th event:', state);
```

---

## Database Queries

### Get all events for a match, ordered

```sql
SELECT type, sequence, timestamp, payload FROM events
WHERE match_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY sequence ASC;
```

### Get latest events only

```sql
SELECT * FROM events
WHERE match_id = '550e8400-e29b-41d4-a716-446655440000'
AND sequence > (SELECT COALESCE(MAX(sequence), 0) - 10 FROM events)
ORDER BY sequence DESC;
```

### Count events by type

```sql
SELECT type, COUNT(*) FROM events
WHERE match_id = '550e8400-e29b-41d4-a716-446655440000'
GROUP BY type;
```

---

## Integration with AI Rules Engine

The legality check function can be extended with AI/ML for advanced validation:

```typescript
function legalityCheck(state: MatchState, command: MatchCommand): LegalityResult {
  // Basic checks
  if (command.type === 'MoveUnit') {
    const unit = findUnit(state, command.unitId);
    if (unit?.status.hasMoved) {
      return {
        isLegal: false,
        ruleId: 'UNIT_ALREADY_MOVED',
        explanation: 'Unit has already moved',
        suggestedFix: 'Choose another unit'
      };
    }
  }

  // TODO: Call AI rules engine for complex interactions
  // const aiRulesCheck = await aiRulesService.validate(state, command);

  return {
    isLegal: true,
    ruleId: null,
    explanation: 'Action is legal',
    suggestedFix: null
  };
}
```

---

## Production Deployment

### Docker Compose Example

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: helm
      POSTGRES_USER: helm_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"

  state-engine:
    build: ./services/state-engine
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: helm
      DB_USER: helm_user
      DB_PASSWORD: ${DB_PASSWORD}
      PORT: 8080
    ports:
      - "8080:8080"
    depends_on:
      - postgres
```

```bash
DB_PASSWORD=securepass docker-compose up
```

---

## Monitoring

### Check Database State

```bash
psql -h localhost -U helm_user -d helm

# View event counts
SELECT match_id, COUNT(*) FROM events GROUP BY match_id;

# View recent events
SELECT * FROM events ORDER BY created_at DESC LIMIT 20;
```

### Monitor WebSocket Connections

```typescript
// Add to index.ts
wss.on('connection', (ws) => {
  console.log(`Clients connected: ${wss.clients.size}`);
});
```

---

## Testing

### Unit Test Example

```typescript
import { reduceEvent } from '@helm/state-engine/reducer';
import { UnitMoved } from '@helm/shared-types';

test('UnitMoved updates unit position', () => {
  const initialState = createTestState();
  const moveEvent: UnitMoved = {
    type: 'UnitMoved',
    id: uuidv4(),
    matchId: 'test-match',
    timestamp: new Date().toISOString(),
    sequence: 1,
    playerId: 'player-1',
    unitId: 'unit-1',
    from: { x: 0, y: 0, tableInches: { x: 0, y: 0 } },
    to: { x: 6, y: 4, tableInches: { x: 12, y: 8 } },
    moveType: 'normal',
    distanceMoved: 13.4
  };

  const newState = reduceEvent(initialState, moveEvent);

  const movedUnit = newState.players[0].army.units[0];
  expect(movedUnit.position?.x).toBe(6);
  expect(movedUnit.status.hasMoved).toBe(true);
});
```
