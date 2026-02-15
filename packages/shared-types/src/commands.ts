import { z } from 'zod';
import { PositionSchema, PhaseEnum } from './events';
import { ArmySchema } from './entities';

// ============================================================================
// COMMAND SCHEMAS
// ============================================================================

export const BasCommandSchema = z.object({
  id: z.string().uuid(),
  matchId: z.string().uuid(),
  playerId: z.string(),
  timestamp: z.string().datetime(),
});

// ============================================================================
// MOVEMENT COMMANDS
// ============================================================================

export const MoveUnitCommandSchema = BasCommandSchema.extend({
  type: z.literal('MoveUnit'),
  unitId: z.string().uuid(),
  destination: PositionSchema,
  moveType: z.enum(['normal', 'advance', 'fallback']),
});

export type MoveUnitCommand = z.infer<typeof MoveUnitCommandSchema>;

// ============================================================================
// COMBAT COMMANDS
// ============================================================================

export const DeclareAttackCommandSchema = BasCommandSchema.extend({
  type: z.literal('DeclareAttack'),
  attackerUnitId: z.string().uuid(),
  defenderUnitId: z.string().uuid(),
  weaponIds: z.array(z.string().uuid()),
});

export type DeclareAttackCommand = z.infer<typeof DeclareAttackCommandSchema>;

export const RollDiceCommandSchema = BasCommandSchema.extend({
  type: z.literal('RollDice'),
  purpose: z.enum(['hit', 'wound', 'save', 'charge', 'battleshock']),
  diceCount: z.number().int().positive(),
  targetValue: z.number().int().min(2).max(6), // e.g., 3 for 3+
  modifiers: z.number().int().default(0),
});

export type RollDiceCommand = z.infer<typeof RollDiceCommandSchema>;

// ============================================================================
// STRATAGEM & ABILITY COMMANDS
// ============================================================================

export const UseStratagemCommandSchema = BasCommandSchema.extend({
  type: z.literal('UseStratagem'),
  stratagemId: z.string(),
  targetUnitIds: z.array(z.string().uuid()),
  cpSpent: z.number().int().positive(),
});

export type UseStratagemCommand = z.infer<typeof UseStratagemCommandSchema>;

// ============================================================================
// PHASE & TURN COMMANDS
// ============================================================================

export const AdvancePhaseCommandSchema = BasCommandSchema.extend({
  type: z.literal('AdvancePhase'),
});

export type AdvancePhaseCommand = z.infer<typeof AdvancePhaseCommandSchema>;

// ============================================================================
// OBJECTIVE & SCORING COMMANDS
// ============================================================================

export const ScoreObjectiveCommandSchema = BasCommandSchema.extend({
  type: z.literal('ScoreObjective'),
  objectiveId: z.string().uuid(),
  points: z.number().int().positive(),
});

export type ScoreObjectiveCommand = z.infer<typeof ScoreObjectiveCommandSchema>;

// ============================================================================
// ADMIN & OVERRIDE COMMANDS
// ============================================================================

export const ApplyOverrideCommandSchema = BasCommandSchema.extend({
  type: z.literal('ApplyOverride'),
  blockedEventId: z.string().uuid(),
  reason: z.string(),
});

export type ApplyOverrideCommand = z.infer<typeof ApplyOverrideCommandSchema>;

export const QueryRuleCommandSchema = BasCommandSchema.extend({
  type: z.literal('QueryRule'),
  query: z.string(),
});

export type QueryRuleCommand = z.infer<typeof QueryRuleCommandSchema>;

// ============================================================================
// SETUP COMMANDS
// ============================================================================

export const SubmitArmyCommandSchema = BasCommandSchema.extend({
  type: z.literal('SubmitArmy'),
  army: ArmySchema,
});

export type SubmitArmyCommand = z.infer<typeof SubmitArmyCommandSchema>;

// ============================================================================
// DISCRIMINATED UNION
// ============================================================================

export const MatchCommandSchema = z.discriminatedUnion('type', [
  MoveUnitCommandSchema,
  DeclareAttackCommandSchema,
  RollDiceCommandSchema,
  UseStratagemCommandSchema,
  AdvancePhaseCommandSchema,
  ScoreObjectiveCommandSchema,
  ApplyOverrideCommandSchema,
  QueryRuleCommandSchema,
  SubmitArmyCommandSchema,
]);

export type MatchCommand = z.infer<typeof MatchCommandSchema>;
