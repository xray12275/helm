import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MatchStateSchema, type Unit } from '@helm/shared-types';
import { StateEngine } from './state-engine';

const UA = '00000000-0000-4000-8000-0000000000aa';
const UB = '00000000-0000-4000-8000-0000000000bb';
const UC = '00000000-0000-4000-8000-0000000000cc';

function unit(id: string, playerId: string): Unit {
  return {
    id,
    profileId: '11111111-1111-4111-8111-111111111111',
    playerId,
    modelCount: 5,
    modelsRemaining: 5,
    woundsPerModel: 2,
    woundsRemaining: 10,
    position: null,
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
  };
}

describe('StateEngine (in-memory MVP)', () => {
  test('createMatch produces a state the shared MatchStateSchema accepts', () => {
    const match = new StateEngine().createMatch('p1', 'p2', { gameSize: 'incursion', mission: 'Take and Hold' });
    const parsed = MatchStateSchema.safeParse(match);
    assert.ok(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues));
    assert.equal(match.phase, 'pre_game');
    assert.equal(match.round, 1);
    assert.equal(match.activePlayerId, 'p1');
    assert.equal(match.gameSize, 'incursion');
    assert.equal(match.mission, 'Take and Hold');
    assert.deepEqual(match.players.map((p) => p.id), ['p1', 'p2']);
    assert.ok(match.players.every((p) => p.army.units.length === 0 && p.army.totalPoints === 0));
  });

  test('unknown gameSize falls back to strike_force', () => {
    assert.equal(new StateEngine().createMatch('p1', 'p2', { gameSize: 'apocalypse' }).gameSize, 'strike_force');
    assert.equal(new StateEngine().createMatch('p1', 'p2').gameSize, 'strike_force');
  });

  test('getMatch returns undefined for unknown ids', () => {
    assert.equal(new StateEngine().getMatch('nope'), undefined);
  });

  test('advancePhase walks command..morale, then bumps the round and swaps the active player', () => {
    const engine = new StateEngine();
    const { id } = engine.createMatch('p1', 'p2');
    const seen: string[] = [];
    for (let i = 0; i < 7; i++) {
      const s = engine.advancePhase(id)!;
      seen.push(s.phase);
    }
    assert.deepEqual(seen, ['command', 'movement', 'shooting', 'charge', 'fight', 'morale', 'command']);
    const state = engine.getMatch(id)!;
    assert.equal(state.round, 2);
    assert.equal(state.activePlayerId, 'p2');
    assert.ok(!seen.includes('psychic'), 'psychic is not a phase in the shared enum');
    assert.equal(engine.advancePhase('missing'), null);
  });

  test('submitArmy adds units to that player only, without duplicates, and records points', () => {
    const engine = new StateEngine();
    const { id } = engine.createMatch('p1', 'p2');
    const a = unit(UA, 'p1');
    engine.submitArmy(id, 'p1', [a, unit(UB, 'p1')], 400);
    engine.submitArmy(id, 'p1', [a], 500);
    const state = engine.getMatch(id)!;
    const p1 = state.players.find((p) => p.id === 'p1')!;
    const p2 = state.players.find((p) => p.id === 'p2')!;
    assert.deepEqual(p1.army.units.map((u) => u.id), [UA, UB]);
    assert.equal(p1.army.totalPoints, 500);
    assert.equal(p2.army.units.length, 0);
    assert.equal(engine.submitArmy(id, 'nobody', [a]), null);
    assert.ok(MatchStateSchema.safeParse(state).success, 'still schema-valid after army submission');
  });

  test('events get a monotonically increasing sequence and applyOverride is logged', () => {
    const engine = new StateEngine();
    const { id } = engine.createMatch('p1', 'p2');
    engine.advancePhase(id);
    engine.submitArmy(id, 'p2', [unit(UC, 'p2')]);
    assert.deepEqual(engine.applyOverride(id, 'legality-1'), { success: true, message: 'Override applied and logged' });
    const events = engine.getEvents(id) as Array<{ type: string; sequence: number; matchId: string }>;
    assert.deepEqual(events.map((e) => e.type), ['phase_advanced', 'army_submitted', 'override_applied']);
    assert.deepEqual(events.map((e) => e.sequence), [1, 2, 3]);
    assert.ok(events.every((e) => e.matchId === id));
    assert.equal(engine.applyOverride('missing', 'x').success, false);
  });
});
