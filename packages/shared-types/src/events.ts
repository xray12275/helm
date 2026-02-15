import { z } from 'zod';

// Base event schema that all events extend
export const BaseEventSchema = z.object({
  id: z.string().uuid(),
  matchId: z.string().uuid(),
  timestamp: z.string().datetime(),
  sequence: z.number().int().positive(),
  playerId: z.string(),
});

export type BaseEvent = z.infer<typeof BaseEventSchema>;

// ============================================================================
// MATCH LIFECYCLE EVENTS
// ============================================================================

export const MatchCreatedSchema = BaseEventSchema.extend({
  type: z.literal('MatchCreated'),
  players: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      faction: z.string(),
    })
  ),
  gameSize: z.enum([
    'combat_patrol',
    'incursion',
    'strike_force',
    'onslaught',
  ]),
  mission: z.string(),
  tableSize: z.object({
    width: z.number(),
    height: z.number(),
  }),
});

export type MatchCreated = z.infer<typeof MatchCreatedSchema>;

export const ArmySubmittedSchema = BaseEventSchema.extend({
  type: z.literal('ArmySubmitted'),
  army: z.object({
    id: z.string().uuid(),
    faction: z.string(),
    detachment: z.string(),
    totalPoints: z.number().int(),
    unitCount: z.number().int(),
  }),
});

export type ArmySubmitted = z.infer<typeof ArmySubmittedSchema>;

export const MatchStartedSchema = BaseEventSchema.extend({
  type: z.literal('MatchStarted'),
});

export type MatchStarted = z.infer<typeof MatchStartedSchema>;

export const MatchEndedSchema = BaseEventSchema.extend({
  type: z.literal('MatchEnded'),
  winnerId: z.string().nullable(),
  finalScores: z.record(z.string(), z.number().int()),
  reason: z.enum(['victory_points', 'resignation', 'draw']),
});

export type MatchEnded = z.infer<typeof MatchEndedSchema>;

// ============================================================================
// TURN/PHASE EVENTS
// ============================================================================

export const PhaseEnum = z.enum([
  'pre_game',
  'command',
  'movement',
  'shooting',
  'charge',
  'fight',
  'morale',
]);

export type Phase = z.infer<typeof PhaseEnum>;

export const PhaseAdvancedSchema = BaseEventSchema.extend({
  type: z.literal('PhaseAdvanced'),
  from: PhaseEnum,
  to: PhaseEnum,
  round: z.number().int().positive(),
});

export type PhaseAdvanced = z.infer<typeof PhaseAdvancedSchema>;

// ============================================================================
// UNIT ACTION EVENTS
// ============================================================================

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  tableInches: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

export type Position = z.infer<typeof PositionSchema>;

export const UnitMovedSchema = BaseEventSchema.extend({
  type: z.literal('UnitMoved'),
  unitId: z.string().uuid(),
  from: PositionSchema,
  to: PositionSchema,
  moveType: z.enum(['normal', 'advance', 'fallback']),
  distanceMoved: z.number(),
});

export type UnitMoved = z.infer<typeof UnitMovedSchema>;

export const AttackDeclaredSchema = BaseEventSchema.extend({
  type: z.literal('AttackDeclared'),
  attackerUnitId: z.string().uuid(),
  defenderUnitId: z.string().uuid(),
  weaponIds: z.array(z.string()),
});

export type AttackDeclared = z.infer<typeof AttackDeclaredSchema>;

// ============================================================================
// DICE & RESOLUTION EVENTS
// ============================================================================

export const DiceRolledSchema = BaseEventSchema.extend({
  type: z.literal('DiceRolled'),
  rollId: z.string().uuid(),
  purpose: z.enum(['hit', 'wound', 'save', 'charge', 'battleshock']),
  diceCount: z.number().int().positive(),
  dice: z.array(z.number().int().min(1).max(6)),
  results: z.array(z.number().int()),
  seed: z.string(),
});

export type DiceRolled = z.infer<typeof DiceRolledSchema>;

export const AttackResolvedSchema = BaseEventSchema.extend({
  type: z.literal('AttackResolved'),
  attackerUnitId: z.string().uuid(),
  defenderUnitId: z.string().uuid(),
  hits: z.number().int().nonnegative(),
  wounds: z.number().int().nonnegative(),
  unsavedWounds: z.number().int().nonnegative(),
  modelsDestroyed: z.number().int().nonnegative(),
  damageDealt: z.number().int().nonnegative(),
});

export type AttackResolved = z.infer<typeof AttackResolvedSchema>;

export const UnitDestroyedSchema = BaseEventSchema.extend({
  type: z.literal('UnitDestroyed'),
  unitId: z.string().uuid(),
  destroyedBy: z.string().uuid().nullable(),
});

export type UnitDestroyed = z.infer<typeof UnitDestroyedSchema>;

// ============================================================================
// STRATAGEM & MORALE EVENTS
// ============================================================================

export const StratagemUsedSchema = BaseEventSchema.extend({
  type: z.literal('StratagemUsed'),
  stratagemId: z.string(),
  targetUnitIds: z.array(z.string().uuid()),
  cpSpent: z.number().int().positive(),
});

export type StratagemUsed = z.infer<typeof StratagemUsedSchema>;

export const BattleShockTestedSchema = BaseEventSchema.extend({
  type: z.literal('BattleShockTested'),
  unitId: z.string().uuid(),
  roll: z.number().int().min(1).max(6),
  passed: z.boolean(),
});

export type BattleShockTested = z.infer<typeof BattleShockTestedSchema>;

// ============================================================================
// OVERRIDE & RULE EVENTS
// ============================================================================

export const IllegalActionBlockedSchema = BaseEventSchema.extend({
  type: z.literal('IllegalActionBlocked'),
  attemptedCommandType: z.string(),
  ruleId: z.string(),
  explanation: z.string(),
  suggestedFix: z.string().nullable(),
});

export type IllegalActionBlocked = z.infer<typeof IllegalActionBlockedSchema>;

export const OverrideAppliedSchema = BaseEventSchema.extend({
  type: z.literal('OverrideApplied'),
  originalBlockedEventId: z.string().uuid(),
  reason: z.string(),
  approvedBy: z.string(),
});

export type OverrideApplied = z.infer<typeof OverrideAppliedSchema>;

// ============================================================================
// OBJECTIVE & SCORING EVENTS
// ============================================================================

export const ObjectiveScoredSchema = BaseEventSchema.extend({
  type: z.literal('ObjectiveScored'),
  objectiveId: z.string().uuid(),
  scoringPlayerId: z.string(),
  points: z.number().int().positive(),
  round: z.number().int().positive(),
});

export type ObjectiveScored = z.infer<typeof ObjectiveScoredSchema>;

// ============================================================================
// DISCRIMINATED UNION
// ============================================================================

export const MatchEventSchema = z.discriminatedUnion('type', [
  MatchCreatedSchema,
  ArmySubmittedSchema,
  MatchStartedSchema,
  PhaseAdvancedSchema,
  UnitMovedSchema,
  AttackDeclaredSchema,
  DiceRolledSchema,
  AttackResolvedSchema,
  UnitDestroyedSchema,
  StratagemUsedSchema,
  BattleShockTestedSchema,
  IllegalActionBlockedSchema,
  OverrideAppliedSchema,
  ObjectiveScoredSchema,
  MatchEndedSchema,
]);

export type MatchEvent = z.infer<typeof MatchEventSchema>;
