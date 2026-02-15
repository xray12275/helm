# Helm: Data Model

## Overview

Helm uses a rich event-sourced data model with immutable event history and mutable current state (materialized views). All core entities are defined with TypeScript Zod schemas for type safety and runtime validation.

---

## Core Entities

### 1. Match

**Purpose:** Top-level container for a single game, holds all state and events.

```typescript
import { z } from 'zod';

export const MatchStatusEnum = z.enum(['setup', 'active', 'ended', 'disputed']);
export const MatchTypeEnum = z.enum(['matched_play', 'narrative', 'campaign']);

export const MatchSchema = z.object({
  id: z.string().uuid().describe('Unique match identifier'),
  matchType: MatchTypeEnum.describe('Matched Play, Narrative, or Campaign'),
  status: MatchStatusEnum.describe('Current match state'),

  // Players and armies
  players: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(64),
    armyId: z.string().uuid(),
    isCurrentPlayer: z.boolean(),
  })),

  // Game progression
  currentRound: z.number().int().min(1).max(5),
  currentTurn: z.number().int().min(1).max(10), // 2 turns per round
  currentPhase: z.enum([
    'command', 'movement', 'psychic', 'shooting', 'charge', 'fight'
  ]),

  // Terrain and objectives
  objectives: z.array(ObjectiveSchema),
  terrain: z.array(TerrainSchema),

  // Match rules
  pointLimit: z.number().int().min(500).max(5000),

  // Timestamps
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),

  // Audit
  createdBy: z.string().email(),
});

export type Match = z.infer<typeof MatchSchema>;
```

---

### 2. Player

**Purpose:** Represents one participant in a match.

```typescript
export const PlayerSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().describe('Reference to user account'),
  matchId: z.string().uuid(),
  name: z.string().min(1).max(64),
  armyId: z.string().uuid(),

  // Statistics
  pointsScored: z.number().int().min(0).default(0),
  pointsAllowed: z.number().int().min(0).default(0),
  unitsDestroyed: z.number().int().min(0).default(0),
  unitsKilled: z.number().int().min(0).default(0),

  // Refs/coaching
  overridesUsed: z.number().int().min(0).default(0),
  illegalActionsAttempted: z.number().int().min(0).default(0),

  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Player = z.infer<typeof PlayerSchema>;
```

---

### 3. Army

**Purpose:** Collection of units and their roster state.

```typescript
export const ArmySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),

  // Identity
  name: z.string().min(1).max(128).describe('Army name, e.g., "Space Marines 1500pts"'),
  faction: z.string().min(1).max(64).describe('Faction, e.g., "Ultramarines"'),

  // Composition
  units: z.array(UnitSchema),
  strategems: z.array(StratagemSchema),

  // Rules and enhancements
  enhancements: z.array(z.object({
    id: z.string(),
    name: z.string(),
    targetUnitId: z.string().uuid().optional(),
  })),

  // Points and validation
  totalPoints: z.number().int().min(0),
  detachmentRules: z.array(z.object({
    id: z.string(),
    name: z.string(),
    bonuses: z.array(z.object({
      targetRole: z.enum(['hq', 'troops', 'elites', 'fast_attack', 'heavy_support', 'flyer']),
      bonus: z.string(),
    })),
  })),

  // Metadata
  source: z.string().describe('BattleScribe, WH+ app, manual, etc.'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Army = z.infer<typeof ArmySchema>;
```

---

### 4. Unit

**Purpose:** Individual unit with identity, position, and status flags.

```typescript
export const UnitStatusFlagsSchema = z.object({
  hasMoved: z.boolean().default(false).describe('This turn'),
  hasAdvanced: z.boolean().default(false),
  hasFallenBack: z.boolean().default(false),
  hasAttacked: z.boolean().default(false),
  hasCharged: z.boolean().default(false),
  isBattleShocked: z.boolean().default(false),
  isInEngagement: z.boolean().default(false).describe('Within 1" of enemy'),
  isInCover: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  hasAssaultWeapon: z.boolean().default(false),
});

export const UnitSchema = z.object({
  id: z.string().uuid().describe('Unique unit instance in match'),
  armyId: z.string().uuid(),
  matchId: z.string().uuid(),

  // Identity and roster reference
  datasheet: z.string().min(1).max(128).describe('Unit type, e.g., "Intercessors"'),
  label: z.string().describe('A/B/C for duplicates, or custom label'),
  roleCategory: z.enum(['hq', 'troops', 'elites', 'fast_attack', 'heavy_support', 'flyer']),

  // Position (table coordinates in inches)
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  facing: z.number().min(0).max(360).default(0).describe('Degrees'),

  // Composition
  models: z.number().int().min(1).max(200).describe('Number of models in unit'),
  wounds: z.number().int().min(0),
  maxWounds: z.number().int().min(1),

  // Stats
  morale: z.enum(['steady', 'pinned', 'shaken']).default('steady'),
  points: z.number().int().min(0),

  // Status flags per phase
  statusFlags: UnitStatusFlagsSchema,

  // Weapons and abilities (references to roster data)
  weapons: z.array(WeaponSchema),
  abilities: z.array(AbilitySchema),

  // Vision data
  visionFingerprint: z.object({
    embedding: z.array(z.number()).length(128).describe('MobileNet-v3 embedding'),
    confidence: z.number().min(0).max(1),
    lastSeen: z.string().datetime(),
  }).optional(),

  // Metadata
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Unit = z.infer<typeof UnitSchema>;
export type UnitStatusFlags = z.infer<typeof UnitStatusFlagsSchema>;
```

---

### 5. Weapon

**Purpose:** Weapon profile with attack characteristics.

```typescript
export const WeaponSchema = z.object({
  id: z.string().uuid(),
  unitId: z.string().uuid(),

  // Identity
  name: z.string().min(1).max(128),
  range: z.number().int().min(0).max(240).describe('Inches'),
  attacks: z.number().int().min(0),
  ballisticSkill: z.number().min(2).max(6).describe('BS value'),

  // Damage
  strength: z.number().min(1).max(10),
  armor_penetration: z.number().min(-4).max(0).describe('AP value'),
  damagePerHit: z.union([
    z.number().int().min(1),
    z.string().regex(/^\d+d\d+/), // e.g., "1d6"
  ]),

  // Restrictions
  restrictions: z.array(z.string()).describe('e.g., "can_only_target_infantry"'),

  // Ability flags
  isAssaultWeapon: z.boolean().default(false),
  isArtillery: z.boolean().default(false),
  isHeavy: z.boolean().default(false),
  hasInvulnerableSave: z.boolean().default(false),
  invulnerableSaveValue: z.number().min(2).max(6).optional(),
});

export type Weapon = z.infer<typeof WeaponSchema>;
```

---

### 6. Ability

**Purpose:** Special rules or traits (auras, psychic powers, stratagems, etc.).

```typescript
export const AbilitySchema = z.object({
  id: z.string().uuid(),
  unitId: z.string().uuid().optional().describe('If unit-specific'),

  // Identity
  name: z.string().min(1).max(128),
  type: z.enum(['aura', 'psychic', 'invulnerable', 'trait', 'stratagem']),

  // Rules reference
  ruleReference: z.object({
    ruleId: z.string().describe('Foreign key to rules library'),
    description: z.string().describe('Non-copyrighted summary'),
  }),

  // Tactical info
  range: z.number().int().min(0).optional().describe('For auras, inches'),
  phases: z.array(z.enum([
    'command', 'movement', 'psychic', 'shooting', 'charge', 'fight'
  ])).describe('When ability is active'),

  // Cost (if stratagem or enhancement)
  cost: z.number().int().min(0).optional().describe('Command points'),
  timingRestriction: z.string().optional().describe('e.g., "only in opponent turn"'),
});

export type Ability = z.infer<typeof AbilitySchema>;
```

---

### 7. Terrain

**Purpose:** Terrain feature on the table (ruin, hill, woods, etc.).

```typescript
export const TerrainSchema = z.object({
  id: z.string().uuid(),
  matchId: z.string().uuid(),

  // Identity
  name: z.string().min(1).max(128).describe('e.g., "Ruin A", "Hill B"'),
  type: z.enum(['ruin', 'hill', 'woods', 'water', 'barricade', 'building', 'other']),

  // Position and footprint
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  footprint: z.union([
    z.object({
      shape: z.literal('circle'),
      radius: z.number(),
    }),
    z.object({
      shape: z.literal('rectangle'),
      width: z.number(),
      height: z.number(),
    }),
    z.object({
      shape: z.literal('polygon'),
      vertices: z.array(z.object({ x: z.number(), y: z.number() })),
    }),
  ]).describe('For LoS and cover calculations'),

  // Tactical properties
  coverType: z.enum(['light', 'heavy']).optional(),
  blocksLineOfSight: z.boolean().default(true),

  // Vision confidence
  source: z.enum(['lidar', 'edge_detection', 'manual']).describe('How was footprint derived?'),
  confidence: z.number().min(0).max(1),

  // Metadata
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Terrain = z.infer<typeof TerrainSchema>;
```

---

### 8. Objective

**Purpose:** Victory condition or mission objective.

```typescript
export const ObjectiveSchema = z.object({
  id: z.string().uuid(),
  matchId: z.string().uuid(),

  // Identity
  name: z.string().min(1).max(128).describe('e.g., "Objective 1"'),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),

  // Victory condition
  points: z.number().int().min(0).max(10),
  controlledBy: z.string().uuid().optional().describe('Current holder, if any'),

  // Rules
  type: z.enum(['primary', 'secondary', 'tertiary']).default('primary'),
  scopeOfVictory: z.enum(['linebreaker', 'progressive', 'endgame']).optional(),

  // Status
  scoredInRound: z.number().int().min(0).optional().describe('First round controlled'),

  // Metadata
  createdAt: z.string().datetime(),
});

export type Objective = z.infer<typeof ObjectiveSchema>;
```

---

### 9. Stratagem

**Purpose:** Card-like rules that can be activated for a cost.

```typescript
export const StratagemSchema = z.object({
  id: z.string().uuid(),
  armyId: z.string().uuid(),

  // Identity
  name: z.string().min(1).max(128),
  cost: z.number().int().min(1).max(10).describe('Command points'),

  // Legality
  phase: z.enum([
    'command', 'movement', 'psychic', 'shooting', 'charge', 'fight'
  ]),
  timingRestriction: z.string().optional().describe('e.g., "your turn", "opponent turn"'),
  detachmentRequired: z.string().optional().describe('Only usable in this detachment'),

  // Reference
  ruleReference: z.object({
    ruleId: z.string(),
    description: z.string().describe('Non-copyrighted summary'),
  }),

  // State during match
  used: z.boolean().default(false),
  usedInRound: z.number().int().optional(),

  // Metadata
  createdAt: z.string().datetime(),
});

export type Stratagem = z.infer<typeof StratagemSchema>;
```

---

## Event Types

All events are immutable once committed to the event store. Each event includes metadata and a payload.

### Event Base Schema

```typescript
export const EventBaseSchema = z.object({
  id: z.string().uuid(),
  matchId: z.string().uuid(),
  aggregateId: z.string().uuid().describe('Unit ID or match ID'),
  sequence: z.number().int().min(0),
  timestamp: z.string().datetime(),
  playerId: z.string().uuid().optional(),
});

export type EventBase = z.infer<typeof EventBaseSchema>;
```

### Event Union Type

```typescript
export type GameEvent =
  | MatchStartedEvent
  | PhaseAdvancedEvent
  | UnitMovedEvent
  | AttackDeclaredEvent
  | DiceRolledEvent
  | AttackResolvedEvent
  | UnitDestroyedEvent
  | StratagemUsedEvent
  | IllegalActionBlockedEvent
  | OverrideAppliedEvent
  | ObjectiveScoredEvent
  | BattleShockTestEvent
  | UnitAdvancedEvent
  | UnitFallenBackEvent
  | CoverStatusChangedEvent;
```

---

### Core Events

#### MatchStartedEvent
```typescript
export const MatchStartedEventSchema = EventBaseSchema.extend({
  type: z.literal('match_started'),
  payload: z.object({
    pointsPerSide: z.array(z.number()),
    terrain: z.array(TerrainSchema),
  }),
});
```

#### PhaseAdvancedEvent
```typescript
export const PhaseAdvancedEventSchema = EventBaseSchema.extend({
  type: z.literal('phase_advanced'),
  payload: z.object({
    fromPhase: z.string(),
    toPhase: z.string(),
    currentRound: z.number(),
    currentTurn: z.number(),
  }),
});
```

#### UnitMovedEvent
```typescript
export const UnitMovedEventSchema = EventBaseSchema.extend({
  type: z.literal('unit_moved'),
  payload: z.object({
    unitId: z.string().uuid(),
    fromPosition: z.object({ x: z.number(), y: z.number() }),
    toPosition: z.object({ x: z.number(), y: z.number() }),
    distance: z.number().describe('Inches moved'),
    moveType: z.enum(['normal', 'advance', 'fallback']),
    phase: z.string(),
  }),
});
```

#### AttackDeclaredEvent
```typescript
export const AttackDeclaredEventSchema = EventBaseSchema.extend({
  type: z.literal('attack_declared'),
  payload: z.object({
    attackingUnitId: z.string().uuid(),
    targetUnitId: z.string().uuid(),
    weaponId: z.string().uuid(),
    numberOfAttacks: z.number().int().min(1),
  }),
});
```

#### DiceRolledEvent
```typescript
export const DiceRolledEventSchema = EventBaseSchema.extend({
  type: z.literal('dice_rolled'),
  payload: z.object({
    unitId: z.string().uuid(),
    rollType: z.enum(['hit', 'wound', 'save', 'charge', 'morale', 'psychic']),
    diceCount: z.number().int().min(1),
    results: z.array(z.number().int().min(1).max(6)).describe('Individual die results'),
    total: z.number().int(),
    detectionMethod: z.enum(['voice', 'camera', 'manual']),
  }),
});
```

#### AttackResolvedEvent
```typescript
export const AttackResolvedEventSchema = EventBaseSchema.extend({
  type: z.literal('attack_resolved'),
  payload: z.object({
    attackingUnitId: z.string().uuid(),
    targetUnitId: z.string().uuid(),
    hitsGenerated: z.number().int().min(0),
    woundsGenerated: z.number().int().min(0),
    savesMade: z.number().int().min(0),
    invulnerableSavesMade: z.number().int().min(0),
    casualties: z.number().int().min(0),
    armorSave: z.number().describe('e.g., 3 for 3+ save'),
  }),
});
```

#### UnitDestroyedEvent
```typescript
export const UnitDestroyedEventSchema = EventBaseSchema.extend({
  type: z.literal('unit_destroyed'),
  payload: z.object({
    unitId: z.string().uuid(),
    killedBy: z.string().uuid().describe('Attacking unit ID'),
    round: z.number(),
    turn: z.number(),
  }),
});
```

#### StratagemUsedEvent
```typescript
export const StratagemUsedEventSchema = EventBaseSchema.extend({
  type: z.literal('stratagem_used'),
  payload: z.object({
    stratagemId: z.string().uuid(),
    cost: z.number().int(),
    targetUnitId: z.string().uuid().optional(),
    round: z.number(),
    phase: z.string(),
  }),
});
```

#### IllegalActionBlockedEvent
```typescript
export const IllegalActionBlockedEventSchema = EventBaseSchema.extend({
  type: z.literal('illegal_action_blocked'),
  payload: z.object({
    attemptedCommand: z.record(z.any()),
    ruleId: z.string().describe('Which rule was violated?'),
    explanation: z.string(),
    suggestedFix: z.string(),
    playerId: z.string().uuid(),
  }),
});
```

#### OverrideAppliedEvent
```typescript
export const OverrideAppliedEventSchema = EventBaseSchema.extend({
  type: z.literal('override_applied'),
  payload: z.object({
    ruleId: z.string(),
    playerRequest: z.string(),
    permission: z.enum(['allowed', 'denied']),
    reason: z.string().describe('Why did referee allow/deny?'),
    overriddenBy: z.string().describe('Referee name or user ID'),
    affectedUnitId: z.string().uuid().optional(),
  }),
});
```

#### ObjectiveScoredEvent
```typescript
export const ObjectiveScoredEventSchema = EventBaseSchema.extend({
  type: z.literal('objective_scored'),
  payload: z.object({
    objectiveId: z.string().uuid(),
    playerId: z.string().uuid(),
    points: z.number().int().min(0),
    round: z.number(),
  }),
});
```

#### BattleShockTestEvent
```typescript
export const BattleShockTestEventSchema = EventBaseSchema.extend({
  type: z.literal('battle_shock_test'),
  payload: z.object({
    unitId: z.string().uuid(),
    casualties: z.number().int(),
    testValue: z.number().int(),
    diceRoll: z.number().int().min(1).max(6),
    passed: z.boolean(),
    resultingMorale: z.enum(['steady', 'pinned', 'shaken']),
  }),
});
```

#### UnitAdvancedEvent
```typescript
export const UnitAdvancedEventSchema = EventBaseSchema.extend({
  type: z.literal('unit_advanced'),
  payload: z.object({
    unitId: z.string().uuid(),
    distance: z.number(),
    phase: z.string(),
  }),
});
```

#### UnitFallenBackEvent
```typescript
export const UnitFallenBackEventSchema = EventBaseSchema.extend({
  type: z.literal('unit_fallen_back'),
  payload: z.object({
    unitId: z.string().uuid(),
    distance: z.number(),
    reason: z.enum(['engaged', 'pinned']),
  }),
});
```

---

## State Mutation Rules

### Phase Advancement
```typescript
const PHASE_ORDER = [
  'command',
  'movement',
  'psychic',
  'shooting',
  'charge',
  'fight'
];

// After fight phase, reset unit flags for next turn
function advancePhase(currentPhase: string): {
  nextPhase: string;
  resetUnitFlags: boolean;
  nextTurn: boolean;
} {
  const idx = PHASE_ORDER.indexOf(currentPhase);
  const nextIdx = (idx + 1) % PHASE_ORDER.length;
  const nextPhase = PHASE_ORDER[nextIdx];

  return {
    nextPhase,
    resetUnitFlags: nextPhase === 'command',
    nextTurn: nextPhase === 'command',
  };
}
```

### Unit State Reset (Command Phase)
```typescript
function resetUnitFlags(unit: Unit): Unit {
  return {
    ...unit,
    statusFlags: {
      hasMoved: false,
      hasAdvanced: false,
      hasFallenBack: false,
      hasAttacked: false,
      hasCharged: false,
      isBattleShocked: unit.statusFlags.isBattleShocked, // Persists
      isInEngagement: false, // Recalculated each phase
      isInCover: false, // Recalculated
      isPinned: false,
      hasAssaultWeapon: unit.statusFlags.hasAssaultWeapon, // Intrinsic
    },
  };
}
```

---

## References

- [ARCHITECTURE.md](ARCHITECTURE.md) — Event store schema, materialized views
- [API_CONTRACTS.md](API_CONTRACTS.md) — WebSocket serialization of events
- [RULES_ENGINE.md](RULES_ENGINE.md) — Event types related to rule enforcement
