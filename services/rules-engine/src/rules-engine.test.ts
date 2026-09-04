import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { MatchCommand, MatchState, Unit } from '@helm/shared-types';
import { RulesEngine } from './rules-engine';
import { buildRuleContext, evaluateCondition } from './condition-evaluator';
import { DEFAULT_RULES } from './default-rules';
import type { RuleContext, RuleDefinition } from './rule-definition';

const NOW = '2026-09-04T00:00:00.000Z';

function unit(id: string, playerId: string, overrides: Partial<Unit> = {}): Unit {
  return {
    id,
    profileId: 'profile-1',
    playerId,
    modelCount: 5,
    modelsRemaining: 5,
    woundsPerModel: 2,
    woundsRemaining: 10,
    position: { x: 0, y: 0, tableInches: { x: 0, y: 0 } },
    status: {
      hasMoved: false,
      hasAdvanced: false,
      hasFallenBack: false,
      hasShot: false,
      hasCharged: false,
      isInEngagement: false,
      isBattleShocked: false,
      remainedStationary: true,
    },
    label: 'A',
    enhancements: [],
    isWarlord: false,
    ...overrides,
  };
}

/** Two players; p2 is the active player and has 1 CP, p1 has 3. */
function makeState(overrides: Partial<MatchState> = {}): MatchState {
  const player = (id: string, cp: number, units: Unit[]): MatchState['players'][number] => ({
    id,
    name: id,
    faction: 'placeholder',
    cp,
    vp: 0,
    army: { id: `army-${id}`, playerId: id, faction: 'placeholder', detachment: '', units, enhancements: [], totalPoints: 1000 },
  });
  return {
    id: 'match-1',
    round: 1,
    phase: 'movement',
    activePlayerId: 'p2',
    players: [
      player('p1', 3, [unit('u1', 'p1', { position: { x: 3, y: 4, tableInches: { x: 3, y: 4 } } })]),
      player('p2', 1, [unit('u2', 'p2')]),
    ],
    terrain: [],
    objectives: [],
    turnLog: [],
    createdAt: NOW,
    updatedAt: NOW,
    gameSize: 'strike_force',
    mission: '',
    isActive: true,
    ...overrides,
  };
}

/** A MoveUnit command plus the loose `distance` / `targetUnitId` fields the evaluator reads. */
function moveCommand(extra: Record<string, unknown> = {}): MatchCommand {
  return {
    type: 'MoveUnit',
    id: 'cmd-1',
    matchId: 'match-1',
    playerId: 'p2',
    timestamp: NOW,
    unitId: 'u2',
    destination: { x: 0, y: 5, tableInches: { x: 0, y: 5 } },
    moveType: 'normal',
    ...extra,
  } as unknown as MatchCommand;
}

function rule(overrides: Partial<RuleDefinition>): RuleDefinition {
  return {
    id: 'test_rule',
    name: 'Test rule',
    category: 'movement',
    phase: 'movement',
    conditions: [],
    isLegal: false,
    explanation: 'test',
    suggestedFix: 'test fix',
    source: 'test',
    ...overrides,
  };
}

describe('RulesEngine', () => {
  test('loads the 20 default rules and rejects duplicate ids', () => {
    const engine = new RulesEngine();
    assert.equal(engine.getAllRules().length, 20);
    assert.equal(engine.getAllRules().length, DEFAULT_RULES.length);
    assert.throws(
      () => engine.loadRules([rule({ id: 'dup' }), rule({ id: 'dup' })]),
      /Duplicate rule ID: dup/
    );
  });

  test('getApplicableRules keeps phase-specific and phase-agnostic rules only', () => {
    const engine = new RulesEngine();
    const movement = engine.getApplicableRules('movement');
    assert.ok(movement.length > 0);
    assert.ok(movement.every((r) => r.phase === 'movement' || r.phase === 'any'));
    assert.ok(movement.some((r) => r.id === 'stratagem_requires_cp'), 'phase: any rules apply everywhere');
    assert.ok(!movement.some((r) => r.id === 'shooting_range_check'));
  });

  test('a matching blocking rule produces an audited, explained illegal result', () => {
    const engine = new RulesEngine();
    engine.loadRules([
      rule({
        id: 'test_block_long_move',
        conditions: [{ field: 'distance', operator: 'gt', value: 6 }],
        suggestedFix: 'Move 6" or less',
        explanation: 'Moved too far',
      }),
    ]);

    const blocked = engine.checkLegality(makeState(), moveCommand({ distance: 7 }));
    assert.equal(blocked.isLegal, false);
    assert.equal(blocked.ruleId, 'test_block_long_move');
    assert.equal(blocked.suggestedFix, 'Move 6" or less');
    assert.deepEqual(blocked.blockedByRuleIds, ['test_block_long_move']);
    assert.equal(blocked.violations?.length, 1);
    assert.match(blocked.explanation, /blocked by 1 rule/);
    assert.match(blocked.id ?? '', /^[0-9a-f-]{36}$/, 'audit id for overrides');
    assert.equal(blocked.matchId, 'match-1');
    assert.equal(blocked.commandId, 'cmd-1');

    const allowed = engine.checkLegality(makeState(), moveCommand({ distance: 5 }));
    assert.equal(allowed.isLegal, true);
    assert.equal(allowed.ruleId, null);
    assert.equal(allowed.suggestedFix, null);
  });

  test('a matching permissive rule is recorded in appliedRules without blocking', () => {
    const engine = new RulesEngine();
    engine.loadRules([
      rule({ id: 'test_allow', isLegal: true, conditions: [{ field: 'distance', operator: 'gte', value: 1 }] }),
    ]);
    const result = engine.checkLegality(makeState(), moveCommand({ distance: 3 }));
    assert.equal(result.isLegal, true);
    assert.deepEqual(result.appliedRules, ['test_allow']);
  });

  test('rules for another phase are ignored', () => {
    const engine = new RulesEngine();
    engine.loadRules([rule({ id: 'shooting_only', phase: 'shooting', conditions: [] })]);
    assert.equal(engine.checkLegality(makeState({ phase: 'movement' }), moveCommand()).isLegal, true);
    assert.equal(engine.checkLegality(makeState({ phase: 'shooting' }), moveCommand()).isLegal, false);
  });

  test('explainRule returns null for unknown ids and a description otherwise', () => {
    const engine = new RulesEngine();
    assert.equal(engine.explainRule('nope').rule, null);
    const { rule: found, explanation } = engine.explainRule('movement_distance_limit');
    assert.equal(found?.id, 'movement_distance_limit');
    assert.match(explanation, /RULE: Movement Distance Limit/);
  });
});

describe('buildRuleContext (shared MatchState shape)', () => {
  test('reads phase, the active player CP, and units from players[].army', () => {
    const ctx = buildRuleContext(makeState(), moveCommand({ targetUnitId: 'u1' }));
    assert.equal(ctx.activePhase, 'movement');
    assert.equal(ctx.playerCP, 1, 'CP of the active player (p2), not players[0]');
    assert.equal(ctx.enemyCP, 3);
    assert.equal(ctx.actingUnit?.id, 'u2', "found inside the active player's army");
    assert.equal(ctx.targetUnit?.id, 'u1', "found inside the other player's army");
  });

  test('derives distance from positions when the command does not carry one', () => {
    const ctx = buildRuleContext(makeState(), moveCommand({ targetUnitId: 'u1' }));
    assert.equal(ctx.distance, 5, '(0,0) -> (3,4)');
  });

  test('an explicit distance on the command wins', () => {
    const ctx = buildRuleContext(makeState(), moveCommand({ targetUnitId: 'u1', distance: 9 }));
    assert.equal(ctx.distance, 9);
  });
});

describe('evaluateCondition operators', () => {
  const ctx: RuleContext = {
    state: {},
    command: {},
    activePhase: 'shooting',
    distance: 12,
    playerCP: 2,
    actingUnit: { keywords: ['INFANTRY', 'CORE'], status: { hasMoved: true } },
    additionalFields: { list: [1, 2, 3] },
  };
  const cases: Array<[string, RuleCondition['operator'], unknown, boolean]> = [
    ['distance', 'eq', 12, true],
    ['distance', 'neq', 12, false],
    ['distance', 'gt', 11, true],
    ['distance', 'gte', 12, true],
    ['distance', 'lt', 12, false],
    ['distance', 'lte', 12, true],
    ['phase', 'in', ['shooting', 'fight'], true],
    ['phase', 'notIn', ['shooting'], false],
    ['unit.keywords', 'hasKeyword', ['CORE'], true],
    ['unit.keywords', 'hasKeyword', ['VEHICLE'], false],
    ['unit.status.hasMoved', 'eq', true, true],
    ['list', 'includes', 2, true],
    ['unit.status.missing', 'eq', undefined, true],
  ];
  for (const [field, operator, value, expected] of cases) {
    test(`${field} ${operator} ${JSON.stringify(value)} -> ${expected}`, () => {
      assert.equal(evaluateCondition({ field, operator, value }, ctx), expected);
    });
  }
});

type RuleCondition = RuleDefinition['conditions'][number];

describe('default rules vs the shared schema (characterization)', () => {
  // A condition `field neq undefined` is true exactly when the field resolves to a value.
  // Against a fully-populated shared MatchState, only these paths resolve today. Every
  // other path in default-rules.ts names a field the shared Unit/MatchState does not have
  // (e.g. `unit.status.inEngagement` vs schema `isInEngagement`, `unit.lastActionType`,
  // `army.totalPoints` at the state root), so those rules can never fire. If you fix a
  // rule to use a real path, move it out of UNRESOLVED here.
  const RESOLVED = ['distance', 'playerCP', 'unit.status.hasMoved'];
  const UNRESOLVED = [
    'army.totalPoints',
    'stratagem.usedThisTurn',
    'targetUnit.owner',
    'unit.lastActionType',
    'unit.selectedWeapon.type',
    'unit.status.advanced',
    'unit.status.fellBack',
    'unit.status.hasCasualties',
    'unit.status.hasLOS',
    'unit.status.inEngagement',
    'unit.status.wasCharged',
    'unit.type',
  ];

  test('records which default-rule condition fields resolve against a real MatchState', () => {
    const ctx = buildRuleContext(makeState(), moveCommand({ targetUnitId: 'u1', distance: 4 }));
    const fields = Array.from(new Set(DEFAULT_RULES.flatMap((r) => r.conditions.map((c) => c.field)))).sort();
    const resolved = fields.filter((field) => evaluateCondition({ field, operator: 'neq', value: undefined }, ctx));
    const unresolved = fields.filter((f) => !resolved.includes(f));
    assert.deepEqual(resolved, RESOLVED);
    assert.deepEqual(unresolved, UNRESOLVED);
  });
});
