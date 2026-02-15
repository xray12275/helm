import { RuleCondition, RuleContext } from './rule-definition';
import { MatchState, MatchCommand, Phase } from '@helm/shared-types';

/**
 * Evaluates a single condition against the rule context.
 * Returns true if the condition is satisfied, false otherwise.
 */
export function evaluateCondition(
  condition: RuleCondition,
  context: RuleContext
): boolean {
  const fieldValue = extractFieldValue(condition.field, context);

  switch (condition.operator) {
    case 'eq':
      return fieldValue === condition.value;

    case 'neq':
      return fieldValue !== condition.value;

    case 'gt':
      return typeof fieldValue === 'number' &&
        typeof condition.value === 'number' &&
        fieldValue > condition.value;

    case 'gte':
      return typeof fieldValue === 'number' &&
        typeof condition.value === 'number' &&
        fieldValue >= condition.value;

    case 'lt':
      return typeof fieldValue === 'number' &&
        typeof condition.value === 'number' &&
        fieldValue < condition.value;

    case 'lte':
      return typeof fieldValue === 'number' &&
        typeof condition.value === 'number' &&
        fieldValue <= condition.value;

    case 'in':
      return Array.isArray(condition.value) &&
        condition.value.includes(fieldValue);

    case 'notIn':
      return Array.isArray(condition.value) &&
        !condition.value.includes(fieldValue);

    case 'hasKeyword':
      if (!Array.isArray(condition.value)) return false;
      if (!Array.isArray(fieldValue)) return false;
      // Check if unit has ANY of the keywords
      return condition.value.some((keyword: string) =>
        fieldValue.includes(keyword)
      );

    case 'includes':
      if (!Array.isArray(fieldValue)) return false;
      return fieldValue.includes(condition.value);

    default:
      console.warn(`Unknown operator: ${(condition.operator as any)}`);
      return false;
  }
}

/**
 * Extracts a field value from the context using dot-notation.
 * Example: "unit.status.hasMoved" → navigates context.state.units[...].status.hasMoved
 */
function extractFieldValue(fieldPath: string, context: RuleContext): any {
  // Handle special cases for common fields
  if (fieldPath === 'distance') return context.distance;
  if (fieldPath === 'phase') return context.activePhase;
  if (fieldPath === 'playerCP') return context.playerCP;
  if (fieldPath === 'enemyCP') return context.enemyCP;

  // Handle unit-specific fields
  if (fieldPath.startsWith('unit.')) {
    const subPath = fieldPath.slice(5); // Remove "unit." prefix
    return navigateObject(context.actingUnit, subPath);
  }

  if (fieldPath.startsWith('targetUnit.')) {
    const subPath = fieldPath.slice(11); // Remove "targetUnit." prefix
    return navigateObject(context.targetUnit, subPath);
  }

  // Check additional fields
  if (context.additionalFields && fieldPath in context.additionalFields) {
    return context.additionalFields[fieldPath];
  }

  // Default: try to navigate from full state
  return navigateObject(context.state, fieldPath);
}

/**
 * Navigates an object using dot-notation path.
 * Example: "status.hasMoved" on {status: {hasMoved: true}} returns true
 */
function navigateObject(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') return undefined;

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Builds a RuleContext from a MatchState and MatchCommand.
 * Extracts commonly needed fields for efficient rule evaluation.
 */
export function buildRuleContext(
  state: MatchState,
  command: MatchCommand
): RuleContext {
  const context: RuleContext = {
    state,
    command,
    activePhase: state.currentPhase,
    additionalFields: {},
  };

  // Extract acting unit (the unit performing the action)
  if ('unitId' in command && typeof command.unitId === 'string') {
    context.actingUnit = findUnitById(state, command.unitId);
    if (context.actingUnit) {
      context.actingUnitKeywords = context.actingUnit.keywords || [];
    }
  }

  // Extract target unit (if applicable)
  if ('targetUnitId' in command && typeof command.targetUnitId === 'string') {
    context.targetUnit = findUnitById(state, command.targetUnitId);
    if (context.targetUnit) {
      context.targetUnitKeywords = context.targetUnit.keywords || [];
    }
  }

  // Extract distance (if applicable and provided)
  if ('distance' in command && typeof command.distance === 'number') {
    context.distance = command.distance;
  } else if (context.actingUnit && context.targetUnit) {
    // Try to calculate distance from positions
    context.distance = calculateDistance(context.actingUnit, context.targetUnit);
  }

  // Extract player CP
  if (state.players && state.players.length > 0) {
    const actingPlayer = state.players[0]; // Assume first player is acting
    context.playerCP = actingPlayer.commandPoints || 0;
    if (state.players.length > 1) {
      context.enemyCP = state.players[1].commandPoints || 0;
    }
  }

  return context;
}

/**
 * Finds a unit in the state by its ID.
 */
function findUnitById(state: MatchState, unitId: string): any {
  if (!state.units) return undefined;
  return state.units.find((u: any) => u.id === unitId);
}

/**
 * Calculates distance between two units (placeholder implementation).
 * In a real system, this would use the position field.
 */
function calculateDistance(unitA: any, unitB: any): number {
  if (!unitA?.position || !unitB?.position) {
    return 0;
  }

  const dx = unitA.position.x - unitB.position.x;
  const dy = unitA.position.y - unitB.position.y;
  // Return distance in inches (assuming coordinates are in inches)
  return Math.sqrt(dx * dx + dy * dy);
}
