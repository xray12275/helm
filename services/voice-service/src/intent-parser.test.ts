import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { IntentParser } from './intent-parser';
import { UnitDisambiguator } from './disambiguation';

describe('IntentParser', () => {
  const parser = new IntentParser();

  test('move with destination', () => {
    const i = parser.parseIntent('Move Intercessors to objective 2');
    assert.equal(i.type, 'move_unit');
    assert.equal(i.entities.unitName, 'intercessors');
    assert.equal(i.entities.location, 'objective 2');
    assert.equal(i.requiresConfirmation, false);
  });

  test('move without destination', () => {
    const i = parser.parseIntent('move terminators');
    assert.equal(i.type, 'move_unit');
    assert.equal(i.entities.unitName, 'terminators');
    assert.equal(i.entities.location, undefined);
  });

  test('attack with an explicit shooter names target and unit', () => {
    const i = parser.parseIntent('shoot rhino with intercessors');
    assert.equal(i.type, 'declare_attack');
    assert.equal(i.entities.targetName, 'rhino');
    assert.equal(i.entities.unitName, 'intercessors');
    assert.equal(i.requiresConfirmation, false);
  });

  test('attack without a shooter asks for confirmation', () => {
    const i = parser.parseIntent('shoot the rhino');
    assert.equal(i.type, 'declare_attack');
    assert.equal(i.requiresConfirmation, true);
  });

  test('roll N dice', () => {
    const i = parser.parseIntent('roll 3 dice');
    assert.equal(i.type, 'roll_dice');
    assert.equal(i.entities.count, '3');
  });

  test('stratagem use always confirms', () => {
    const i = parser.parseIntent('use overwatch');
    assert.equal(i.type, 'use_stratagem');
    assert.equal(i.entities.stratagemName, 'overwatch');
    assert.equal(i.requiresConfirmation, true);
    assert.equal(i.confirmationPrompt, 'Activate stratagem: "overwatch"?');
  });

  test('phase advance, undo and scoring confirm; select and rule queries do not', () => {
    assert.equal(parser.parseIntent('next phase').type, 'advance_phase');
    assert.equal(parser.parseIntent('next phase').requiresConfirmation, true);
    assert.equal(parser.parseIntent('undo').type, 'undo');
    const score = parser.parseIntent('score 5 points');
    assert.equal(score.type, 'score_points');
    assert.equal(score.entities.points, '5');
    const select = parser.parseIntent('select intercessors');
    assert.equal(select.type, 'select_unit');
    assert.equal(select.requiresConfirmation, false);
    const query = parser.parseIntent('explain cover');
    assert.equal(query.type, 'query_rule');
    assert.equal(query.entities.ruleName, 'cover');
  });

  test('unrecognised speech is `unknown` with zero confidence', () => {
    const i = parser.parseIntent('asdf qwerty');
    assert.equal(i.type, 'unknown');
    assert.equal(i.confidence, 0);
    assert.deepEqual(i.entities, {});
  });
});

describe('UnitDisambiguator', () => {
  const d = new UnitDisambiguator();
  const units = [
    { id: 'u1', name: 'Intercessors', label: 'A', keywords: ['INFANTRY'] },
    { id: 'u2', name: 'Intercessors', label: 'B', keywords: ['INFANTRY'] },
    { id: 'u3', name: 'Rhino', label: 'A', keywords: ['VEHICLE'] },
  ];

  test('an exact, unique name or id resolves directly', () => {
    assert.equal(d.disambiguate('rhino', units).matched?.id, 'u3');
    assert.equal(d.disambiguate('u2', units).matched?.id, 'u2');
  });

  test('a name shared by two squads is ambiguous and offers the A/B labels', () => {
    const r = d.disambiguate('Intercessors', units);
    assert.equal(r.ambiguous, true);
    assert.equal(r.matched, undefined);
    assert.deepEqual(r.options?.map((o) => o.id), ['u1', 'u2']);
    assert.equal(r.prompt, 'Which Intercessors? 1) Intercessors A, 2) Intercessors B');
  });

  test('a partial match that hits several units is ambiguous too', () => {
    const r = d.disambiguate('interc', units);
    assert.equal(r.ambiguous, true);
    assert.equal(r.options?.length, 2);
  });

  test('keywords count as partial matches', () => {
    assert.equal(d.disambiguate('vehicle', units).matched?.id, 'u3');
  });

  test('no match and no units are reported as errors', () => {
    assert.match(d.disambiguate('dreadnought', units).error ?? '', /No units matching "dreadnought"/);
    assert.equal(d.disambiguate('rhino', []).error, 'No units available');
  });
});
