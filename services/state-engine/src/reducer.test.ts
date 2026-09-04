import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { MatchEvent, MatchState, Unit } from '@helm/shared-types';
import { reduceEvent } from './reducer';
import { commandToEvents } from './command-to-events';

const NOW = '2026-09-04T00:00:00.000Z';
const MATCH_ID = '00000000-0000-4000-8000-000000000001';
const UNIT_ID = '00000000-0000-4000-8000-0000000000aa';

function unit(id: string, playerId: string, overrides: Partial<Unit> = {}): Unit {
  return {
    id,
    profileId: '00000000-0000-4000-8000-0000000000ff',
    playerId,
    modelCount: 5,
    modelsRemaining: 5,
    woundsPerModel: 2,
    woundsRemaining: 10,
    position: { x: 0, y: 0, tableInches: { x: 0, y: 0 } },
    status: {
      hasMoved: true,
      hasAdvanced: false,
      hasFallenBack: false,
      hasShot: true,
      hasCharged: false,
      isInEngagement: false,
      isBattleShocked: false,
      remainedStationary: false,
    },
    label: 'A',
    enhancements: [],
    isWarlord: false,
    ...overrides,
  };
}

function baseState(overrides: Partial<MatchState> = {}): MatchState {
  return {
    id: MATCH_ID,
    round: 1,
    phase: 'pre_game',
    activePlayerId: 'p1',
    players: [],
    terrain: [],
    objectives: [],
    turnLog: [],
    createdAt: NOW,
    updatedAt: NOW,
    gameSize: 'strike_force',
    mission: '',
    isActive: false,
    ...overrides,
  };
}

const base = { id: '00000000-0000-4000-8000-0000000000e1', matchId: MATCH_ID, timestamp: NOW, sequence: 1, playerId: 'p1' };

describe('reduceEvent', () => {
  test('MatchCreated seeds players with empty armies and pre_game', () => {
    const state = reduceEvent(baseState(), {
      ...base,
      type: 'MatchCreated',
      players: [
        { id: 'p1', name: 'One', faction: 'placeholder' },
        { id: 'p2', name: 'Two', faction: 'placeholder' },
      ],
      gameSize: 'incursion',
      mission: 'Take and Hold',
      tableSize: { width: 44, height: 60 },
    });
    assert.equal(state.phase, 'pre_game');
    assert.equal(state.isActive, false);
    assert.equal(state.gameSize, 'incursion');
    assert.deepEqual(state.players.map((p) => [p.id, p.cp, p.army.units.length]), [['p1', 0, 0], ['p2', 0, 0]]);
  });

  test('MatchStarted activates the match in the command phase', () => {
    const state = reduceEvent(baseState(), { ...base, type: 'MatchStarted' });
    assert.equal(state.isActive, true);
    assert.equal(state.phase, 'command');
    assert.equal(state.round, 1);
    assert.match(state.turnLog[0], /Match started/);
  });

  test('PhaseAdvanced into command resets every unit status for the new turn', () => {
    const before = baseState({
      phase: 'morale',
      players: [
        { id: 'p1', name: 'One', faction: 'x', cp: 1, vp: 0, army: { id: 'a1', playerId: 'p1', faction: 'x', detachment: '', units: [unit(UNIT_ID, 'p1')], enhancements: [], totalPoints: 500 } },
      ],
    });
    const after = reduceEvent(before, { ...base, type: 'PhaseAdvanced', from: 'morale', to: 'command', round: 2 });
    assert.equal(after.phase, 'command');
    assert.equal(after.round, 2);
    const status = after.players[0].army.units[0].status;
    assert.equal(status.hasMoved, false);
    assert.equal(status.hasShot, false);
    assert.equal(status.remainedStationary, true);
    // the reducer is pure: the input was not mutated
    assert.equal(before.players[0].army.units[0].status.hasMoved, true);
    assert.equal(before.phase, 'morale');
  });

  test('PhaseAdvanced within a turn keeps unit statuses', () => {
    const before = baseState({
      phase: 'movement',
      players: [
        { id: 'p1', name: 'One', faction: 'x', cp: 1, vp: 0, army: { id: 'a1', playerId: 'p1', faction: 'x', detachment: '', units: [unit(UNIT_ID, 'p1')], enhancements: [], totalPoints: 500 } },
      ],
    });
    const after = reduceEvent(before, { ...base, type: 'PhaseAdvanced', from: 'movement', to: 'shooting', round: 1 });
    assert.equal(after.phase, 'shooting');
    assert.equal(after.players[0].army.units[0].status.hasMoved, true);
  });

  test('UnitMoved relocates only the named unit', () => {
    const other = unit('00000000-0000-4000-8000-0000000000bb', 'p1');
    const before = baseState({
      phase: 'movement',
      players: [
        { id: 'p1', name: 'One', faction: 'x', cp: 1, vp: 0, army: { id: 'a1', playerId: 'p1', faction: 'x', detachment: '', units: [unit(UNIT_ID, 'p1'), other], enhancements: [], totalPoints: 500 } },
      ],
    });
    const to = { x: 6, y: 8, tableInches: { x: 6, y: 8 } };
    const after = reduceEvent(before, {
      ...base,
      type: 'UnitMoved',
      unitId: UNIT_ID,
      from: { x: 0, y: 0, tableInches: { x: 0, y: 0 } },
      to,
      moveType: 'normal',
      distanceMoved: 10,
    });
    assert.deepEqual(after.players[0].army.units[0].position, to);
    assert.deepEqual(after.players[0].army.units[1].position, other.position);
  });
});

describe('commandToEvents', () => {
  const cmd = { id: '00000000-0000-4000-8000-0000000000c1', matchId: MATCH_ID, playerId: 'p1', timestamp: NOW };

  test('AdvancePhase from morale wraps to command and increments the round', () => {
    const [event] = commandToEvents(baseState({ phase: 'morale', round: 3, isActive: true }), { ...cmd, type: 'AdvancePhase' });
    assert.equal(event.type, 'PhaseAdvanced');
    if (event.type !== 'PhaseAdvanced') return;
    assert.equal(event.from, 'morale');
    assert.equal(event.to, 'command');
    assert.equal(event.round, 4);
  });

  test('AdvancePhase mid-turn keeps the round', () => {
    const [event] = commandToEvents(baseState({ phase: 'movement', round: 3, isActive: true }), { ...cmd, type: 'AdvancePhase' });
    if (event.type !== 'PhaseAdvanced') assert.fail('expected PhaseAdvanced');
    assert.equal(event.to, 'shooting');
    assert.equal(event.round, 3);
  });

  test('AdvancePhase cannot leave pre_game (MatchStarted does that)', () => {
    assert.throws(() => commandToEvents(baseState({ phase: 'pre_game' }), { ...cmd, type: 'AdvancePhase' }), /Unknown phase: pre_game/);
  });

  test('MoveUnit becomes a UnitMoved event with the distance travelled', () => {
    const state = baseState({
      phase: 'movement',
      players: [
        { id: 'p1', name: 'One', faction: 'x', cp: 1, vp: 0, army: { id: 'a1', playerId: 'p1', faction: 'x', detachment: '', units: [unit(UNIT_ID, 'p1')], enhancements: [], totalPoints: 500 } },
      ],
    });
    const events: MatchEvent[] = commandToEvents(state, {
      ...cmd,
      type: 'MoveUnit',
      unitId: UNIT_ID,
      destination: { x: 3, y: 4, tableInches: { x: 3, y: 4 } },
      moveType: 'normal',
    });
    assert.equal(events.length, 1);
    const [event] = events;
    if (event.type !== 'UnitMoved') assert.fail('expected UnitMoved');
    assert.equal(event.unitId, UNIT_ID);
    assert.equal(event.moveType, 'normal');
    assert.equal(event.distanceMoved, 5);
  });
});
