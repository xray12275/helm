import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ArmySchema, LegalityResultSchema, MatchCommandSchema, PhaseEnum } from './index';

const NOW = '2026-09-04T00:00:00.000Z';
const UUID = '00000000-0000-4000-8000-000000000001';

describe('shared schemas', () => {
  test('PhaseEnum is the 10th-edition sequence with no psychic phase', () => {
    assert.deepEqual(PhaseEnum.options, ['pre_game', 'command', 'movement', 'shooting', 'charge', 'fight', 'morale']);
  });

  test('MatchCommandSchema discriminates on `type`', () => {
    const move = MatchCommandSchema.parse({
      type: 'MoveUnit',
      id: UUID,
      matchId: UUID,
      playerId: 'p1',
      timestamp: NOW,
      unitId: UUID,
      destination: { x: 1, y: 2, tableInches: { x: 1, y: 2 } },
      moveType: 'advance',
    });
    assert.equal(move.type, 'MoveUnit');
    assert.equal(MatchCommandSchema.safeParse({ type: 'Teleport', id: UUID, matchId: UUID, playerId: 'p1', timestamp: NOW }).success, false);
    assert.equal(MatchCommandSchema.safeParse({ type: 'MoveUnit', id: UUID, matchId: UUID, playerId: 'p1', timestamp: NOW }).success, false, 'MoveUnit needs unitId/destination/moveType');
  });

  test('LegalityResultSchema accepts the minimal shape and the audited shape', () => {
    assert.ok(LegalityResultSchema.safeParse({ isLegal: true, ruleId: null, explanation: 'ok', suggestedFix: null }).success);
    const audited = LegalityResultSchema.parse({
      isLegal: false,
      ruleId: 'movement_distance_limit',
      explanation: 'too far',
      suggestedFix: 'move less',
      id: UUID,
      matchId: UUID,
      commandId: UUID,
      timestamp: NOW,
      appliedRules: ['movement_distance_limit'],
      violations: ['too far'],
      blockedByRuleIds: ['movement_distance_limit'],
    });
    assert.equal(audited.id, UUID);
    assert.equal(LegalityResultSchema.safeParse({ isLegal: true }).success, false, 'ruleId/explanation/suggestedFix are required');
  });

  test('an army may have 0 points before submission but never negative', () => {
    const army = { id: UUID, playerId: 'p1', faction: 'x', detachment: '', units: [], enhancements: [] };
    assert.ok(ArmySchema.safeParse({ ...army, totalPoints: 0 }).success);
    assert.equal(ArmySchema.safeParse({ ...army, totalPoints: -1 }).success, false);
  });
});
