import { v4 as uuidv4 } from 'uuid';
import { MatchState, MatchCommand, LegalityResult, Phase } from '@helm/shared-types';
import { RuleDefinition, RuleContext } from './rule-definition';
import {
  evaluateCondition,
  buildRuleContext,
} from './condition-evaluator';
import { getDefaultRules } from './default-rules';

/**
 * Main rules engine for Warhammer 40K referee app.
 * Validates actions against a loaded rule set and provides explanations for violations.
 */
export class RulesEngine {
  private rules: RuleDefinition[] = [];

  constructor() {
    // Load default rules on initialization
    this.loadRules(getDefaultRules());
  }

  /**
   * Load a new set of rules, replacing any previously loaded rules.
   */
  loadRules(rules: RuleDefinition[]): void {
    // Validate rule IDs are unique
    const ids = new Set<string>();
    for (const rule of rules) {
      if (ids.has(rule.id)) {
        throw new Error(`Duplicate rule ID: ${rule.id}`);
      }
      ids.add(rule.id);
    }

    this.rules = [...rules];
    console.log(`Loaded ${this.rules.length} rules into RulesEngine`);
  }

  /**
   * Check whether a command is legal given the current match state.
   * Returns a LegalityResult indicating if the action is allowed and explaining any violations.
   */
  checkLegality(state: MatchState, command: MatchCommand): LegalityResult {
    // Build context for rule evaluation
    const context = buildRuleContext(state, command);

    // Get applicable rules for the current phase
    const applicableRules = this.getApplicableRules(state.phase);

    // Track violations
    const violations: string[] = [];
    const blockedByRules: string[] = [];
    const allowedByRules: string[] = [];
    const blockingRules: RuleDefinition[] = [];

    // Check each applicable rule
    for (const rule of applicableRules) {
      const ruleApplies = this.checkRuleConditions(rule.conditions, context);

      if (!ruleApplies) {
        continue; // Rule doesn't apply to this context
      }

      // Rule applies; check if it allows or blocks
      if (rule.isLegal) {
        allowedByRules.push(rule.id);
      } else {
        // This rule blocks the action
        blockedByRules.push(rule.id);
        blockingRules.push(rule);
        violations.push(
          `${rule.name}: ${rule.explanation} (${rule.suggestedFix})`
        );
      }
    }

    // Determine overall legality
    const isLegal = blockedByRules.length === 0;

    const firstBlock = blockingRules[0];
    const result: LegalityResult = {
      id: uuidv4(),
      isLegal,
      ruleId: firstBlock?.id ?? null,
      suggestedFix: firstBlock?.suggestedFix ?? null,
      matchId: state.id,
      commandId: (command as any).id || uuidv4(),
      timestamp: new Date().toISOString(),
      appliedRules: [...allowedByRules, ...blockedByRules],
      violations,
      blockedByRuleIds: blockedByRules,
      explanation: isLegal
        ? 'Action is legal.'
        : `Action blocked by ${blockedByRules.length} rule(s): ${violations.join(' | ')}`,
    };

    return result;
  }

  /**
   * Get all rules applicable to a given phase.
   */
  getApplicableRules(phase: Phase): RuleDefinition[] {
    return this.rules.filter(
      (rule) => rule.phase === 'any' || rule.phase === phase
    );
  }

  /**
   * Get detailed information about a specific rule.
   */
  explainRule(ruleId: string): { rule: RuleDefinition | null; explanation: string } {
    const rule = this.rules.find((r) => r.id === ruleId);

    if (!rule) {
      return {
        rule: null,
        explanation: `Rule not found: ${ruleId}`,
      };
    }

    const conditionsText = rule.conditions
      .map(
        (c) => `- Field "${c.field}" ${c.operator} ${JSON.stringify(c.value)}`
      )
      .join('\n');

    const explanation = `
RULE: ${rule.name} (${rule.id})
Category: ${rule.category}
Phase: ${rule.phase}
Source: ${rule.source}

DESCRIPTION:
${rule.explanation}

CONDITIONS (all must be true):
${conditionsText}

EFFECT: ${rule.isLegal ? 'ALLOWS' : 'BLOCKS'} the action

FIX:
${rule.suggestedFix}
    `.trim();

    return { rule, explanation };
  }

  /**
   * Get all loaded rules (for debugging/inspection).
   */
  getAllRules(): RuleDefinition[] {
    return [...this.rules];
  }

  /**
   * Get rules by category.
   */
  getRulesByCategory(
    category: RuleDefinition['category']
  ): RuleDefinition[] {
    return this.rules.filter((rule) => rule.category === category);
  }

  /**
   * Check if all conditions in a rule are satisfied.
   */
  private checkRuleConditions(
    conditions: RuleDefinition['conditions'],
    context: RuleContext
  ): boolean {
    // All conditions must be true for the rule to apply
    return conditions.every((condition) =>
      evaluateCondition(condition, context)
    );
  }
}
