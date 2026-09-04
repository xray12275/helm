import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AuditableDice } from './dice-engine';

describe('AuditableDice', () => {
  const dice = new AuditableDice();

  test('roll returns `count` results in [1, sides] with a matching total', () => {
    const r = dice.roll(10, 6);
    assert.equal(r.results.length, 10);
    for (const v of r.results) {
      assert.ok(Number.isInteger(v) && v >= 1 && v <= 6, `die value ${v} out of range`);
    }
    assert.equal(r.total, r.results.reduce((a, b) => a + b, 0));
    assert.equal(r.count, 10);
    assert.equal(r.sides, 6);
    assert.match(r.seed, /^[0-9a-f]{64}$/, '32 random bytes as hex');
    assert.match(r.hash, /^[0-9a-f]{64}$/, 'sha-256 as hex');
  });

  test('sides defaults to 6', () => {
    const r = dice.roll(3);
    assert.equal(r.sides, 6);
    assert.ok(r.results.every((v) => v <= 6));
  });

  test('verify accepts a genuine roll', () => {
    assert.equal(dice.verify(dice.roll(5)), true);
  });

  test('verify rejects a tampered result', () => {
    const r = dice.roll(5);
    const last = r.results[r.results.length - 1];
    const tampered = { ...r, results: [...r.results.slice(0, -1), (last % 6) + 1] };
    assert.equal(dice.verify(tampered), false);
  });

  test('verify rejects a tampered hash', () => {
    const r = dice.roll(5);
    const flipped = (r.hash[0] === '0' ? '1' : '0') + r.hash.slice(1);
    assert.equal(dice.verify({ ...r, hash: flipped }), false);
  });

  test('the seed alone reproduces the roll (id and timestamp are not part of the proof)', () => {
    const r = dice.roll(20, 20);
    assert.equal(dice.verify({ ...r, id: 'someone-else', timestamp: '1970-01-01T00:00:00.000Z' }), true);
  });

  test('each roll gets a fresh seed', () => {
    assert.notEqual(dice.roll(8).seed, dice.roll(8).seed);
  });

  test('rejects out-of-range arguments', () => {
    assert.throws(() => dice.roll(0), /count/);
    assert.throws(() => dice.roll(1001), /count/);
    assert.throws(() => dice.roll(1, 1), /sides/);
    assert.throws(() => dice.roll(1, 1001), /sides/);
  });
});
