import { RuleDefinition } from './rule-definition';

/**
 * Default set of Warhammer 40K-style rules (generic, non-copyrighted descriptions).
 * These serve as placeholders and can be extended or replaced with user-defined rules.
 */
export const DEFAULT_RULES: RuleDefinition[] = [
  // ==================== MOVEMENT RULES ====================

  {
    id: 'movement_distance_limit',
    name: 'Movement Distance Limit',
    category: 'movement',
    phase: 'movement',
    conditions: [
      {
        field: 'unit.status.hasMoved',
        operator: 'eq',
        value: false,
      },
      {
        field: 'distance',
        operator: 'gte',
        value: 1,
      },
    ],
    isLegal: true,
    explanation:
      'A unit may move up to its Movement (M) value in inches during the movement phase. This check validates that the distance is at least 1 inch (unit moved at all).',
    suggestedFix: 'Ensure the target position is between 0 and M inches away.',
    source: 'core_rules_2024',
  },

  {
    id: 'movement_engagement_range_block',
    name: 'Cannot Move from Engagement Range',
    category: 'movement',
    phase: 'movement',
    conditions: [
      {
        field: 'unit.status.inEngagement',
        operator: 'eq',
        value: true,
      },
      {
        field: 'unit.lastActionType',
        operator: 'eq',
        value: 'normal_move',
      },
    ],
    isLegal: false,
    explanation:
      'A unit locked in engagement range cannot make normal moves. Units in engagement must either stay in place or attempt to fall back.',
    suggestedFix:
      'Choose a different unit to move, or attempt a Fall Back action instead.',
    source: 'core_rules_2024',
  },

  {
    id: 'movement_coherency_maintenance',
    name: 'Maintain Unit Coherency',
    category: 'movement',
    phase: 'movement',
    conditions: [
      {
        field: 'unit.type',
        operator: 'eq',
        value: 'squad',
      },
      {
        field: 'distance',
        operator: 'lte',
        value: 2,
      },
    ],
    isLegal: true,
    explanation:
      'After moving, squad members must maintain coherency (be within 2 inches of at least one other squad member). This rule checks that the move maintains coherency.',
    suggestedFix:
      'Reposition models to ensure all are within 2 inches of the unit.',
    source: 'core_rules_2024',
  },

  {
    id: 'movement_fall_back_distance',
    name: 'Fall Back Movement Distance',
    category: 'movement',
    phase: 'movement',
    conditions: [
      {
        field: 'unit.lastActionType',
        operator: 'eq',
        value: 'fall_back',
      },
      {
        field: 'distance',
        operator: 'lte',
        value: 6,
      },
    ],
    isLegal: true,
    explanation:
      'A unit that falls back moves up to 6 inches away from enemy units.',
    suggestedFix: 'Ensure the fall back move is not more than 6 inches.',
    source: 'core_rules_2024',
  },

  {
    id: 'movement_advance_distance',
    name: 'Advance Movement Distance',
    category: 'movement',
    phase: 'movement',
    conditions: [
      {
        field: 'unit.lastActionType',
        operator: 'eq',
        value: 'advance',
      },
      {
        field: 'distance',
        operator: 'lte',
        value: 10,
      },
    ],
    isLegal: true,
    explanation: 'A unit that advances moves up to 10 inches but cannot charge this turn.',
    suggestedFix: 'Ensure the advance move does not exceed 10 inches.',
    source: 'core_rules_2024',
  },

  // ==================== SHOOTING RULES ====================

  {
    id: 'shooting_range_check',
    name: 'Target Within Weapon Range',
    category: 'shooting',
    phase: 'shooting',
    conditions: [
      {
        field: 'distance',
        operator: 'gte',
        value: 0,
      },
    ],
    isLegal: true,
    explanation:
      'A unit can only shoot at a target if the target is within the weapon range.',
    suggestedFix:
      'Choose a target within range of your weapons, or move closer.',
    source: 'core_rules_2024',
  },

  {
    id: 'shooting_cannot_shoot_after_fallback',
    name: 'Cannot Shoot After Falling Back',
    category: 'shooting',
    phase: 'shooting',
    conditions: [
      {
        field: 'unit.status.fellBack',
        operator: 'eq',
        value: true,
      },
    ],
    isLegal: false,
    explanation:
      'A unit that fell back this turn cannot make ranged attacks during the shooting phase.',
    suggestedFix: 'Choose a different unit to shoot with.',
    source: 'core_rules_2024',
  },

  {
    id: 'shooting_advanced_assault_weapons_only',
    name: 'Advanced Units Fire Assault Weapons Only',
    category: 'shooting',
    phase: 'shooting',
    conditions: [
      {
        field: 'unit.status.advanced',
        operator: 'eq',
        value: true,
      },
      {
        field: 'unit.selectedWeapon.type',
        operator: 'eq',
        value: 'assault',
      },
    ],
    isLegal: true,
    explanation:
      'A unit that advanced this turn can only shoot Assault weapons (max 12" range).',
    suggestedFix:
      'Select an Assault weapon, or move the unit normally instead of advancing.',
    source: 'core_rules_2024',
  },

  {
    id: 'shooting_los_blocked',
    name: 'Line of Sight Required',
    category: 'shooting',
    phase: 'shooting',
    conditions: [
      {
        field: 'unit.status.hasLOS',
        operator: 'eq',
        value: true,
      },
    ],
    isLegal: true,
    explanation:
      'The shooter must have a clear line of sight to the target. Terrain may block LoS.',
    suggestedFix: 'Choose a target in line of sight, or move the unit to gain LoS.',
    source: 'core_rules_2024',
  },

  // ==================== CHARGE RULES ====================

  {
    id: 'charge_distance_roll',
    name: 'Charge Requires 2D6 Roll',
    category: 'charge',
    phase: 'charge',
    conditions: [
      {
        field: 'distance',
        operator: 'gte',
        value: 0,
      },
    ],
    isLegal: true,
    explanation:
      'To declare a charge, roll 2D6. The unit must move at least 1 inch and can move up to the result, reaching engagement range (within 0.5 inches).',
    suggestedFix: 'Roll 2D6 and move up to that result toward the target.',
    source: 'core_rules_2024',
  },

  {
    id: 'charge_cannot_charge_if_fell_back',
    name: 'Cannot Charge After Falling Back',
    category: 'charge',
    phase: 'charge',
    conditions: [
      {
        field: 'unit.status.fellBack',
        operator: 'eq',
        value: true,
      },
    ],
    isLegal: false,
    explanation:
      'A unit that fell back this turn cannot declare a charge.',
    suggestedFix: 'Choose a different unit to charge with.',
    source: 'core_rules_2024',
  },

  {
    id: 'charge_cannot_charge_if_advanced',
    name: 'Cannot Charge After Advancing',
    category: 'charge',
    phase: 'charge',
    conditions: [
      {
        field: 'unit.status.advanced',
        operator: 'eq',
        value: true,
      },
    ],
    isLegal: false,
    explanation:
      'A unit that advanced this turn cannot declare a charge.',
    suggestedFix:
      'Choose a different unit to charge with, or move the unit normally instead.',
    source: 'core_rules_2024',
  },

  {
    id: 'charge_must_target_enemy',
    name: 'Charge Must Target Enemy Unit',
    category: 'charge',
    phase: 'charge',
    conditions: [
      {
        field: 'targetUnit.owner',
        operator: 'neq',
        value: 'self',
      },
    ],
    isLegal: true,
    explanation:
      'A charge must be declared against an enemy unit, not an allied unit.',
    suggestedFix: 'Select an enemy unit as the charge target.',
    source: 'core_rules_2024',
  },

  // ==================== FIGHT RULES ====================

  {
    id: 'fight_in_engagement_range',
    name: 'Unit Must Be in Engagement Range to Fight',
    category: 'fight',
    phase: 'fight',
    conditions: [
      {
        field: 'unit.status.inEngagement',
        operator: 'eq',
        value: true,
      },
    ],
    isLegal: true,
    explanation:
      'A unit can only make melee attacks (fight) if it is in engagement range (within 0.5 inches) of an enemy.',
    suggestedFix: 'Declare a charge to reach engagement range, or select a different unit.',
    source: 'core_rules_2024',
  },

  {
    id: 'fight_charged_units_first',
    name: 'Units That Were Charged Fight First',
    category: 'fight',
    phase: 'fight',
    conditions: [
      {
        field: 'unit.status.wasCharged',
        operator: 'eq',
        value: true,
      },
    ],
    isLegal: true,
    explanation:
      'Units that were charged this phase fight first in the fight phase, before units that declared charges.',
    suggestedFix: 'This is automatic based on the charge declarations.',
    source: 'core_rules_2024',
  },

  // ==================== MORALE RULES ====================

  {
    id: 'morale_test_required',
    name: 'Morale Test Required After Casualties',
    category: 'morale',
    phase: 'morale',
    conditions: [
      {
        field: 'unit.status.hasCasualties',
        operator: 'eq',
        value: true,
      },
    ],
    isLegal: true,
    explanation:
      "After suffering casualties, a unit must take a morale test. Roll 1D6 and add the number of casualties. If the result exceeds the unit's Leadership, models flee.",
    suggestedFix: 'Roll the morale test; if failed, remove additional models.',
    source: 'core_rules_2024',
  },

  // ==================== STRATAGEM RULES ====================

  {
    id: 'stratagem_requires_cp',
    name: 'Stratagem Requires Command Points',
    category: 'stratagem',
    phase: 'any',
    conditions: [
      {
        field: 'playerCP',
        operator: 'gte',
        value: 1,
      },
    ],
    isLegal: true,
    explanation:
      'Using a stratagem costs Command Points (CP). You must have at least the required CP to activate it.',
    suggestedFix:
      'Use a stratagem that costs fewer CP, or wait until you generate more CP.',
    source: 'core_rules_2024',
  },

  {
    id: 'stratagem_once_per_turn',
    name: 'Stratagem Once Per Turn Limit',
    category: 'stratagem',
    phase: 'any',
    conditions: [
      {
        field: 'stratagem.usedThisTurn',
        operator: 'eq',
        value: false,
      },
    ],
    isLegal: true,
    explanation:
      'Most stratagems can only be used once per battle round.',
    suggestedFix:
      'Choose a different stratagem, or wait until the next turn.',
    source: 'core_rules_2024',
  },

  // ==================== ARMY CONSTRUCTION ====================

  {
    id: 'army_construction_min_points',
    name: 'Minimum Army Points',
    category: 'army_construction',
    phase: 'any',
    conditions: [
      {
        field: 'army.totalPoints',
        operator: 'gte',
        value: 500,
      },
    ],
    isLegal: true,
    explanation:
      'A valid army must have at least 500 points of units.',
    suggestedFix:
      'Add more units to reach the minimum army size.',
    source: 'core_rules_2024',
  },

  {
    id: 'army_construction_max_points',
    name: 'Maximum Army Points',
    category: 'army_construction',
    phase: 'any',
    conditions: [
      {
        field: 'army.totalPoints',
        operator: 'lte',
        value: 2000,
      },
    ],
    isLegal: true,
    explanation:
      'A standard competitive army cannot exceed 2000 points.',
    suggestedFix:
      'Remove units or choose smaller units to stay within the point limit.',
    source: 'core_rules_2024',
  },
];

/**
 * Get the default rules set.
 * In production, this could be replaced with rules loaded from a database or config file.
 */
export function getDefaultRules(): RuleDefinition[] {
  return [...DEFAULT_RULES];
}
