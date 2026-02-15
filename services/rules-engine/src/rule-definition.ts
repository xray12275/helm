import { Phase } from '@helm/shared-types';

/**
 * Represents a single condition that must be evaluated against the current match state.
 * All conditions within a rule must evaluate to true for the rule to apply.
 */
export interface RuleCondition {
  /**
   * Dot-path to the field being checked (e.g., "unit.status.hasMoved", "distance", "player.cp")
   */
  field: string;

  /**
   * Comparison operator
   */
  operator:
    | 'eq'          // Equal
    | 'neq'         // Not equal
    | 'gt'          // Greater than
    | 'gte'         // Greater than or equal
    | 'lt'          // Less than
    | 'lte'         // Less than or equal
    | 'in'          // Value in array
    | 'notIn'       // Value not in array
    | 'hasKeyword'  // Unit has keyword (for hasKeyword, value is string[])
    | 'includes';   // Array includes value

  /**
   * The value to compare against. Type depends on operator:
   * - For comparisons: number, string, boolean
   * - For 'in'/'notIn': any[]
   * - For 'hasKeyword': string[]
   * - For 'includes': any
   */
  value: any;
}

/**
 * A rule definition encodes a specific rule from the Warhammer 40K ruleset.
 * Rules can allow or block specific actions based on the match state.
 */
export interface RuleDefinition {
  /**
   * Unique identifier (e.g., "movement_distance_limit")
   */
  id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Category for organization and filtering
   */
  category:
    | 'movement'
    | 'shooting'
    | 'charge'
    | 'fight'
    | 'morale'
    | 'stratagem'
    | 'army_construction';

  /**
   * Phase in which this rule applies. Use 'any' if the rule is not phase-specific.
   */
  phase: Phase | 'any';

  /**
   * Array of conditions. ALL conditions must be true for the rule to apply.
   */
  conditions: RuleCondition[];

  /**
   * If true, the rule allows the action when all conditions match.
   * If false, the rule blocks the action when all conditions match.
   */
  isLegal: boolean;

  /**
   * Human-readable explanation of what the rule does
   */
  explanation: string;

  /**
   * Suggestion for how to fix a violation
   */
  suggestedFix: string;

  /**
   * Provenance of the rule (e.g., "user_upload_v1.2", "core_rules_2024")
   */
  source: string;
}

/**
 * Context data extracted from match state for rule evaluation.
 * Provides convenient access to commonly needed fields.
 */
export interface RuleContext {
  state: any;                           // Full match state
  command: any;                         // Full command being evaluated
  activePhase: Phase;                   // Current game phase
  actingUnit?: any;                     // Unit executing the action (if applicable)
  targetUnit?: any;                     // Target unit (if applicable)
  distance?: number;                    // Distance in inches (if applicable)
  playerCP?: number;                    // Acting player's command points
  enemyCP?: number;                     // Enemy player's command points
  actingUnitKeywords?: string[];        // Keywords of acting unit
  targetUnitKeywords?: string[];        // Keywords of target unit
  additionalFields?: Record<string, any>; // Any other extracted fields
}

/**
 * Validation schema for RuleDefinition using Zod
 */
export const RuleConditionSchema = {
  field: 'string',
  operator: 'eq | neq | gt | gte | lt | lte | in | notIn | hasKeyword | includes',
  value: 'any',
};

export const RuleDefinitionSchema = {
  id: 'string (unique)',
  name: 'string',
  category: 'movement | shooting | charge | fight | morale | stratagem | army_construction',
  phase: 'Phase | "any"',
  conditions: 'RuleCondition[]',
  isLegal: 'boolean',
  explanation: 'string',
  suggestedFix: 'string',
  source: 'string',
};
