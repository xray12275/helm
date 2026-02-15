# Helm: Rules Engine

## Overview

The Rules Engine is the authoritative arbiter of legality in Helm. It evaluates every command against a pluggable reference library (user-provided rules data) and returns hard-stop enforcement decisions. The engine is **not** a copyrighted text repository; instead, it loads rule definitions from user uploads and applies condition evaluation against the current match state.

**Core Principle:** Every action is legal unless explicitly forbidden by a rule. The engine operates in the command pipeline, **before** state changes are committed.

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│ COMMAND (from State Engine)                      │
│ Example: MoveUnit { unitId, distance: 8 inches } │
└────────────┬─────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────┐
│ RULES ENGINE ENTRY POINT                         │
│ legality = checkLegality(command, state, rules)  │
└────────────┬─────────────────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
      ▼             ▼
┌────────────┐  ┌──────────────┐
│ Load Rules │  │ Extract Unit │
│ by phase & │  │ from state   │
│ category   │  │ Redis        │
└────────────┘  └──────────────┘
      │             │
      └──────┬──────┘
             │
             ▼
┌──────────────────────────────────────────────────┐
│ CONDITION EVALUATION (for each applicable rule)  │
│ 1. Check field (e.g., unit.moveDistance)         │
│ 2. Apply operator (>, ==, in, etc.)              │
│ 3. Compare to threshold (e.g., 6 inches)        │
│ 4. If all conditions met → VIOLATION             │
└────────────┬─────────────────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
      ▼             ▼
  LEGAL        ILLEGAL
    │             │
    │             ▼
    │         ┌────────────────────┐
    │         │ Return LegalityResult│
    │         │ {                   │
    │         │   isLegal: false,   │
    │         │   ruleId,          │
    │         │   explanation,     │
    │         │   suggestedFix     │
    │         │ }                  │
    │         └────────────────────┘
    │             │
    └────────┬────┘
             │
             ▼
┌──────────────────────────────────────────────────┐
│ ACTION: Block command or allow state change      │
│ If illegal: CommandBlocked event (no state edit) │
│ If legal: proceed to state mutation & commit     │
└──────────────────────────────────────────────────┘
```

---

## Rule Definition Format (JSON/YAML)

Rules are loaded from a user-provided Reference Library. Each rule is a declarative definition with conditions and effects.

### Rule Schema

```json
{
  "id": "CORE.MOVEMENT.DISTANCE_LIMIT",
  "version": "1.0",
  "title": "Movement Distance Limit",
  "category": "movement",
  "phase": ["movement"],
  "priority": 10,

  "description": "In the movement phase, units can move up to 6 inches.",

  "conditions": [
    {
      "field": "unit.moveDistance",
      "operator": ">",
      "value": 6,
      "unit": "inches"
    }
  ],

  "effect": "block",
  "explanation": "Units can move a maximum of 6 inches in the movement phase (except Advance, which allows further movement at the cost of not shooting).",

  "suggestedFix": "Move the unit 6 inches or less. Alternatively, declare an Advance move for greater distance.",

  "detailedReason": {
    "ruleBook": "Warhammer 40,000: Core Rules",
    "edition": "10th Edition",
    "page": "34",
    "section": "Movement Phase"
  },

  "source": {
    "libraryId": "rules-lib-001",
    "uploadedBy": "admin@helm.local",
    "uploadedAt": "2025-01-15T10:00:00Z",
    "license": "user-provided"
  },

  "relatedRules": [
    "CORE.MOVEMENT.ADVANCE",
    "CORE.MOVEMENT.FALLBACK"
  ]
}
```

### Rule Conditions (Complex Example)

```json
{
  "id": "CORE.ENGAGEMENT.CANNOT_SHOOT",
  "title": "Engagement: Cannot Shoot",
  "category": "shooting",
  "phase": ["shooting"],

  "conditions": [
    {
      "field": "unit.isInEngagement",
      "operator": "==",
      "value": true
    }
  ],

  "effect": "block",
  "explanation": "Units in engagement cannot shoot unless they have an ability that allows it (e.g., Pistols)."
}
```

### Condition Operators

```typescript
type Operator =
  | ">"           // Greater than
  | "<"           // Less than
  | ">="          // Greater than or equal
  | "<="          // Less than or equal
  | "=="          // Equals
  | "!="          // Not equals
  | "in"          // Value in array
  | "not_in"      // Value not in array
  | "contains"    // String/array contains
  | "startsWith"  // String starts with
  | "endsWith"    // String ends with
  | "any"         // Any element in array matches condition
  | "all"         // All elements in array match condition;
```

---

## Condition Evaluator

```typescript
interface Condition {
  field: string;           // e.g., "unit.moveDistance"
  operator: Operator;
  value: any;
  unit?: string;           // e.g., "inches"
}

function evaluateCondition(
  condition: Condition,
  data: any  // The object being checked (unit, match state, etc.)
): boolean {
  // Navigate nested fields: "unit.moveDistance" → data.unit.moveDistance
  const parts = condition.field.split('.');
  let actualValue = data;

  for (const part of parts) {
    if (actualValue == null) return false;
    actualValue = actualValue[part];
  }

  // Evaluate operator
  switch (condition.operator) {
    case '>':
      return actualValue > condition.value;
    case '<':
      return actualValue < condition.value;
    case '>=':
      return actualValue >= condition.value;
    case '<=':
      return actualValue <= condition.value;
    case '==':
      return actualValue === condition.value;
    case '!=':
      return actualValue !== condition.value;
    case 'in':
      return condition.value.includes(actualValue);
    case 'not_in':
      return !condition.value.includes(actualValue);
    case 'contains':
      return Array.isArray(actualValue)
        ? actualValue.includes(condition.value)
        : String(actualValue).includes(String(condition.value));
    case 'any':
      return Array.isArray(actualValue)
        ? actualValue.some(item =>
            evaluateConditionAgainstValue(condition, item)
          )
        : false;
    case 'all':
      return Array.isArray(actualValue)
        ? actualValue.every(item =>
            evaluateConditionAgainstValue(condition, item)
          )
        : true;
    default:
      return false;
  }
}

function evaluateConditionAgainstValue(condition: Condition, value: any): boolean {
  // Simplified condition evaluation for single value
  switch (condition.operator) {
    case '>':
      return value > condition.value;
    case '<':
      return value < condition.value;
    case '==':
      return value === condition.value;
    case 'in':
      return condition.value.includes(value);
    default:
      return false;
  }
}
```

---

## Legality Check Function

**Core Function:** Evaluate command against all applicable rules.

```typescript
interface LegalityResult {
  isLegal: boolean;
  ruleId?: string;
  explanation?: string;
  suggestedFix?: string;
  detailedReason?: {
    rule: string;
    condition: Condition[];
    actualValue: any;
    limit: any;
  };
  fallbackOptions?: string[];
}

function checkLegality(
  command: Command,
  currentState: MatchState,
  rules: Rule[]
): LegalityResult {
  // Filter rules applicable to this command
  const applicableRules = rules.filter(rule => {
    // Phase must match
    if (!rule.phase.includes(currentState.currentPhase)) {
      return false;
    }

    // Category must match command type
    const commandCategory = getCommandCategory(command);
    if (!rule.category.includes(commandCategory)) {
      return false;
    }

    return true;
  });

  // Sort by priority (higher = checked first)
  applicableRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  // Evaluate each rule
  for (const rule of applicableRules) {
    // Extract context (unit, player, etc.)
    const context = extractContext(command, currentState);

    // Check all conditions
    const conditionsMet = rule.conditions.every(condition =>
      evaluateCondition(condition, context)
    );

    // If all conditions met, rule is violated
    if (conditionsMet) {
      // Hard-stop: return violation immediately
      return {
        isLegal: false,
        ruleId: rule.id,
        explanation: rule.explanation,
        suggestedFix: rule.suggestedFix,
        detailedReason: {
          rule: rule.description,
          condition: rule.conditions,
          actualValue: extractValue(context, rule.conditions[0].field),
          limit: rule.conditions[0].value,
        },
        fallbackOptions: generateFallbackOptions(rule, command),
      };
    }
  }

  // No violations found
  return { isLegal: true };
}

function extractContext(command: Command, state: MatchState): any {
  // Build object with relevant fields from command + state
  const context: any = {
    command,
    state,
    player: state.players.find(p => p.id === command.playerId),
    currentPhase: state.currentPhase,
  };

  // If moving unit, add unit details
  if (command.type === 'MoveUnit' && command.unitId) {
    context.unit = state.units.find(u => u.id === command.unitId);
    // Calculate move distance
    if (context.unit) {
      const dist = calculateDistance(
        context.unit.position,
        command.targetPosition
      );
      context.unit.moveDistance = dist;
    }
  }

  // Similar for other command types...

  return context;
}

function generateFallbackOptions(rule: Rule, command: Command): string[] {
  // Based on the rule, suggest alternatives
  if (rule.id === 'CORE.MOVEMENT.DISTANCE_LIMIT') {
    return [
      'Move the unit 6 inches or less',
      'Declare an Advance move for greater distance (unit cannot shoot)',
      'Declare a Fall Back move (unit cannot shoot)',
    ];
  }

  return [];
}
```

---

## Rule Categories & Examples

### Movement Rules

#### Distance Limit
```json
{
  "id": "CORE.MOVEMENT.DISTANCE_LIMIT",
  "category": "movement",
  "phase": ["movement"],
  "conditions": [
    { "field": "unit.moveDistance", "operator": ">", "value": 6 }
  ],
  "effect": "block",
  "explanation": "Units move up to 6 inches."
}
```

#### Coherency
```json
{
  "id": "CORE.MOVEMENT.COHERENCY",
  "category": "movement",
  "phase": ["movement"],
  "conditions": [
    {
      "field": "unit.statusFlags.coherencyViolation",
      "operator": "==",
      "value": true
    }
  ],
  "effect": "block",
  "explanation": "Models in a unit must be within 2 inches of at least one other model in the unit.",
  "suggestedFix": "Move the unit to maintain coherency (all models within 2 inches of the nearest model)."
}
```

#### Engagement: Cannot Move Normally
```json
{
  "id": "CORE.ENGAGEMENT.CANNOT_MOVE_NORMALLY",
  "category": "movement",
  "phase": ["movement"],
  "conditions": [
    { "field": "unit.isInEngagement", "operator": "==", "value": true },
    { "field": "moveType", "operator": "!=", "value": "fallback" }
  ],
  "effect": "block",
  "explanation": "Units in engagement cannot move in the normal movement phase. They must Fall Back (6 inches, cannot shoot)."
}
```

### Shooting Rules

#### Cannot Shoot While Engaged
```json
{
  "id": "CORE.SHOOTING.ENGAGED_UNITS",
  "category": "shooting",
  "phase": ["shooting"],
  "conditions": [
    { "field": "unit.isInEngagement", "operator": "==", "value": true },
    { "field": "weapon.hasPistol", "operator": "==", "value": false }
  ],
  "effect": "block",
  "explanation": "Units in engagement cannot shoot non-pistol weapons."
}
```

#### Cannot Shoot After Advancing
```json
{
  "id": "CORE.SHOOTING.ADVANCED_UNITS",
  "category": "shooting",
  "phase": ["shooting"],
  "conditions": [
    { "field": "unit.statusFlags.hasAdvanced", "operator": "==", "value": true }
  ],
  "effect": "block",
  "explanation": "Units that advanced this turn cannot shoot."
}
```

#### Range Check
```json
{
  "id": "CORE.SHOOTING.RANGE",
  "category": "shooting",
  "phase": ["shooting"],
  "conditions": [
    { "field": "distance", "operator": ">", "value": "weapon.range" }
  ],
  "effect": "block",
  "explanation": "Target is out of weapon range.",
  "suggestedFix": "Choose a target within range or select a different weapon."
}
```

#### Line of Sight
```json
{
  "id": "CORE.SHOOTING.LINE_OF_SIGHT",
  "category": "shooting",
  "phase": ["shooting"],
  "conditions": [
    { "field": "hasLineOfSight", "operator": "==", "value": false }
  ],
  "effect": "block",
  "explanation": "Target is not visible (blocked by terrain or other units).",
  "suggestedFix": "Choose a target with clear line of sight, or move your shooting unit for a better angle."
}
```

### Charging Rules

#### Out of Range
```json
{
  "id": "CORE.CHARGE.DISTANCE",
  "category": "charge",
  "phase": ["charge"],
  "conditions": [
    { "field": "distance", "operator": ">", "value": 12 }
  ],
  "effect": "block",
  "explanation": "Units must be within 12 inches to declare a charge."
}
```

#### Pinned Units Cannot Charge
```json
{
  "id": "CORE.CHARGE.PINNED",
  "category": "charge",
  "phase": ["charge"],
  "conditions": [
    { "field": "unit.statusFlags.isPinned", "operator": "==", "value": true }
  ],
  "effect": "block",
  "explanation": "Pinned units cannot declare charges."
}
```

### Fighting Rules

#### Units in Melee Can Fight
```json
{
  "id": "CORE.FIGHT.MUST_BE_IN_ENGAGEMENT",
  "category": "fighting",
  "phase": ["fight"],
  "conditions": [
    { "field": "unit.isInEngagement", "operator": "==", "value": false }
  ],
  "effect": "block",
  "explanation": "Units must be in engagement to fight."
}
```

### Battle Shock Rules

#### Morale Check When Taking Casualties
```json
{
  "id": "CORE.MORALE.BATTLE_SHOCK",
  "category": "morale",
  "phase": ["command"],
  "conditions": [
    { "field": "unit.woundsThisTurn", "operator": ">", "value": 0 }
  ],
  "effect": "soft_block",  // Prompts but doesn't prevent; allows user to proceed
  "explanation": "Unit took casualties this turn and must take a Battle Shock test."
}
```

### Stratagem Rules

#### Timing Restriction
```json
{
  "id": "STRAT.CADIAN.SMOKE_SCREEN",
  "category": "stratagem",
  "phase": ["movement", "shooting"],
  "conditions": [
    { "field": "stratagem.timingRestriction", "operator": "!=", "value": null },
    { "field": "currentPhase", "operator": "not_in", "value": "stratagem.validPhases" }
  ],
  "effect": "block",
  "explanation": "Smoke Screen can only be used during Movement or Shooting phase."
}
```

#### Command Point Cost
```json
{
  "id": "CORE.STRATAGEM.COST",
  "category": "stratagem",
  "phase": ["command", "movement", "shooting", "charge", "fight"],
  "conditions": [
    { "field": "player.commandPoints", "operator": "<", "value": "stratagem.cost" }
  ],
  "effect": "block",
  "explanation": "You don't have enough command points to use this stratagem.",
  "suggestedFix": "Save command points or use a cheaper stratagem."
}
```

---

## Override System (Referee Authority)

**Goal:** Allow tournament referees to override rules for edge cases or disputes while maintaining audit trail.

```typescript
interface OverrideRequest {
  ruleId: string;
  originalCommand: Command;
  decision: 'allowed' | 'denied';
  reason: string;
  overriddenBy: string;  // Referee name/ID
  auditNote?: string;    // Photo evidence, witness names, etc.
}

function applyOverride(
  overrideRequest: OverrideRequest,
  command: Command
): {
  isLegal: boolean;
  overrideApplied: boolean;
  auditEvent: OverrideAppliedEvent;
} {
  // Referee decision wins
  const isLegal = overrideRequest.decision === 'allowed';

  const auditEvent: OverrideAppliedEvent = {
    type: 'override_applied',
    ruleId: overrideRequest.ruleId,
    playerRequest: JSON.stringify(command),
    decision: overrideRequest.decision,
    reason: overrideRequest.reason,
    overriddenBy: overrideRequest.overriddenBy,
    auditNote: overrideRequest.auditNote,
    timestamp: new Date().toISOString(),
  };

  return {
    isLegal,
    overrideApplied: true,
    auditEvent,
  };
}
```

**Audit Trail Example:**
```json
{
  "id": "override_001",
  "matchId": "m123",
  "timestamp": "2025-02-15T14:35:00Z",
  "ruleId": "CORE.ENGAGEMENT.CANNOT_MOVE_NORMALLY",
  "playerRequest": { "type": "MoveUnit", "unitId": "u456", ... },
  "decision": "allowed",
  "reason": "Photo evidence shows engagement boundary is actually 1.2 inches, allowing normal move.",
  "overriddenBy": "Jordan (Tournament Referee)",
  "auditNote": "Photo attached; witness: Alice (P1), Bob (P2)",
  "affectedUnitId": "u456"
}
```

**Multi-Table Dashboard (Referee View):**
- Shows overrides per table
- Filters by rule, outcome, timestamp
- Export CSV for tournament record-keeping
- Escalation tracking (how many overrides per player?)

---

## Reference Library Management

### Pluggable Rules Data

Users upload rule definitions; system doesn't embed copyrighted text.

```typescript
interface RulesLibrary {
  id: string;
  name: string;
  version: string;
  edition: string;  // e.g., "10th"
  source: 'official' | 'community' | 'homebrew';
  rules: Rule[];
  uploadedBy: string;
  uploadedAt: ISO8601;
  provenance: {
    baseLibrary?: string;  // e.g., "10th Edition Core (uploaded by admin)"
    modifications: string[];  // List of changes
  };
}
```

### Library Loading & Validation

```typescript
function loadRulesLibrary(libraryId: string): RulesLibrary {
  // Fetch from database
  const library = db.rulesLibraries.findById(libraryId);

  // Validate structure
  for (const rule of library.rules) {
    if (!rule.id || !rule.category || !rule.phase) {
      throw new Error(`Invalid rule: ${rule.id} missing required fields`);
    }

    // Validate conditions
    for (const condition of rule.conditions) {
      if (!condition.field || !condition.operator) {
        throw new Error(`Invalid condition in rule ${rule.id}`);
      }
    }
  }

  return library;
}
```

### Version Control & Updates

```json
{
  "id": "rules-lib-001",
  "name": "Warhammer 40K 10th Edition Core",
  "version": "1.2.3",
  "baseVersion": "1.0.0",
  "changelog": [
    {
      "version": "1.0.0",
      "date": "2025-01-15",
      "changes": "Initial upload"
    },
    {
      "version": "1.1.0",
      "date": "2025-01-20",
      "changes": "Added Stratagem timing rules; fixed Coherency condition"
    },
    {
      "version": "1.2.0",
      "date": "2025-02-01",
      "changes": "Added LoS terrain interaction rules"
    }
  ]
}
```

---

## Effect Types

### Hard-Stop Block
```json
{
  "effect": "block",
  "explanation": "...",
  "behavior": "Immediately reject command, show explanation + suggestion"
}
```

### Soft Block (Confirmation Prompt)
```json
{
  "effect": "soft_block",
  "explanation": "Unit took casualties and may be pinned.",
  "behavior": "Warn user but allow them to proceed if confirmed"
}
```

### Information Only (Coaching)
```json
{
  "effect": "inform",
  "explanation": "You have a Stratagem available that might help here.",
  "behavior": "Display as tooltip/hint; don't block"
}
```

---

## Testing & Validation

### Unit Test Example
```typescript
describe('Rules Engine', () => {
  it('should block move > 6 inches', () => {
    const command = {
      type: 'MoveUnit',
      unitId: 'u456',
      targetPosition: { x: 28, y: 16 }
    };

    const state = {
      currentPhase: 'movement',
      units: [
        {
          id: 'u456',
          position: { x: 20, y: 16 },
          moveDistance: 8,
          isInEngagement: false
        }
      ]
    };

    const result = checkLegality(command, state, rules);

    expect(result.isLegal).toBe(false);
    expect(result.ruleId).toBe('CORE.MOVEMENT.DISTANCE_LIMIT');
    expect(result.explanation).toContain('6 inches');
  });

  it('should allow move ≤ 6 inches', () => {
    // Similar setup with distance: 4.5
    const result = checkLegality(command, state, rules);
    expect(result.isLegal).toBe(true);
  });
});
```

---

## References

- [ARCHITECTURE.md](ARCHITECTURE.md) — Rules Engine service integration
- [DATA_MODEL.md](DATA_MODEL.md) — Command, Unit, Match schemas
- [API_CONTRACTS.md](API_CONTRACTS.md) — Rule upload endpoint
