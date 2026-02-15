import { z } from 'zod';
import { PositionSchema, Phase, PhaseEnum } from './events';

// ============================================================================
// CORE GAME ENTITIES
// ============================================================================

export const GameSizeEnum = z.enum([
  'combat_patrol',
  'incursion',
  'strike_force',
  'onslaught',
]);

export type GameSize = z.infer<typeof GameSizeEnum>;

// ============================================================================
// UNIT RELATED SCHEMAS
// ============================================================================

export const UnitStatusSchema = z.object({
  hasMoved: z.boolean().default(false),
  hasAdvanced: z.boolean().default(false),
  hasFallenBack: z.boolean().default(false),
  hasShot: z.boolean().default(false),
  hasCharged: z.boolean().default(false),
  isInEngagement: z.boolean().default(false),
  isBattleShocked: z.boolean().default(false),
  remainedStationary: z.boolean().default(true),
});

export type UnitStatus = z.infer<typeof UnitStatusSchema>;

export const WeaponSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(['ranged', 'melee']),
  range: z.number().nullable(), // null for melee
  attacks: z.string(), // e.g., "3" or "2d6"
  skill: z.number().int(), // 3, 4, 5, 6
  strength: z.number().int(),
  ap: z.number().int(),
  damage: z.string(), // e.g., "1" or "2d3"
  keywords: z.array(z.string()),
});

export type Weapon = z.infer<typeof WeaponSchema>;

export const AbilitySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  phase: PhaseEnum.nullable(),
  type: z.enum(['core', 'faction', 'unit', 'enhancement']),
});

export type Ability = z.infer<typeof AbilitySchema>;

export const UnitProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  faction: z.string(),
  keywords: z.array(z.string()),
  movement: z.number(),
  toughness: z.number().int(),
  save: z.number().int(),
  wounds: z.number().int(),
  leadership: z.number().int(),
  oc: z.number().int(), // Objective Control
  weapons: z.array(WeaponSchema),
  abilities: z.array(AbilitySchema),
  isBattleline: z.boolean(),
  isCharacter: z.boolean(),
  isEpicHero: z.boolean(),
  pointsCosts: z.record(z.string(), z.number().int()), // e.g., { "single": 50, "unit_of_2": 95 }
});

export type UnitProfile = z.infer<typeof UnitProfileSchema>;

export const UnitSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  playerId: z.string(),
  modelCount: z.number().int().positive(),
  modelsRemaining: z.number().int().nonnegative(),
  woundsPerModel: z.number().int().positive(),
  woundsRemaining: z.number().int().nonnegative(),
  position: PositionSchema.nullable(),
  status: UnitStatusSchema,
  label: z.string(), // e.g., "A", "B", "C"
  enhancements: z.array(z.string().uuid()),
  isWarlord: z.boolean().default(false),
});

export type Unit = z.infer<typeof UnitSchema>;

// ============================================================================
// ARMY & ENHANCEMENT SCHEMAS
// ============================================================================

export const EnhancementSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  points: z.number().int().nonnegative(),
  assignedToUnitId: z.string().uuid().nullable(),
  description: z.string(),
});

export type Enhancement = z.infer<typeof EnhancementSchema>;

export const ArmySchema = z.object({
  id: z.string().uuid(),
  playerId: z.string(),
  faction: z.string(),
  detachment: z.string(),
  units: z.array(UnitSchema),
  enhancements: z.array(EnhancementSchema),
  totalPoints: z.number().int().positive(),
});

export type Army = z.infer<typeof ArmySchema>;

// ============================================================================
// TERRAIN & OBJECTIVES
// ============================================================================

export const TerrainPieceSchema = z.object({
  id: z.string().uuid(),
  type: z.string(), // e.g., "ruin", "hill", "forest"
  footprint: z.array(PositionSchema),
  blocksLos: z.boolean(),
  providesCover: z.boolean(),
  height: z.number(),
});

export type TerrainPiece = z.infer<typeof TerrainPieceSchema>;

export const ObjectiveSchema = z.object({
  id: z.string().uuid(),
  position: PositionSchema,
  controlledBy: z.string().nullable(), // player ID or null
  points: z.number().int().nonnegative().default(0),
});

export type Objective = z.infer<typeof ObjectiveSchema>;

// ============================================================================
// PLAYER & MATCH STATE
// ============================================================================

export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  faction: z.string(),
  cp: z.number().int().nonnegative(),
  vp: z.number().int().nonnegative(),
  army: ArmySchema,
});

export type Player = z.infer<typeof PlayerSchema>;

export const MatchStateSchema = z.object({
  id: z.string().uuid(),
  round: z.number().int().positive(),
  phase: PhaseEnum,
  activePlayerId: z.string(),
  players: z.array(PlayerSchema),
  terrain: z.array(TerrainPieceSchema),
  objectives: z.array(ObjectiveSchema),
  turnLog: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  gameSize: GameSizeEnum,
  mission: z.string(),
  isActive: z.boolean(),
});

export type MatchState = z.infer<typeof MatchStateSchema>;
