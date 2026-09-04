import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { RulesEngine } from '@helm/rules-engine';
import { MatchStateSchema } from '@helm/shared-types';
import { createRoutes } from './routes';
import { StateEngine } from './state-engine';

describe('REST API (createRoutes mounted on a throwaway server)', () => {
  let server: Server;
  let base = '';

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', createRoutes(new StateEngine(), new RulesEngine()));
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  const json = (method: string, path: string, body?: unknown) =>
    fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  // Response bodies are untyped JSON; tests assert on their fields.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parse = (res: Response): Promise<any> => res.json();

  test('GET /health', async () => {
    const res = await json('GET', '/health');
    assert.equal(res.status, 200);
    assert.equal((await parse(res)).status, 'ok');
  });

  test('GET /rules lists the 20 default rules and explains one', async () => {
    const list = await parse(await json('GET', '/rules'));
    assert.equal(list.count, 20);
    const one = await json('GET', '/rules/movement_distance_limit');
    assert.equal(one.status, 200);
    assert.equal((await json('GET', '/rules/does_not_exist')).status, 404);
  });

  test('POST /matches requires both player ids', async () => {
    assert.equal((await json('POST', '/matches', { name: 'x', gameSize: 'strike_force' })).status, 400);
  });

  test('match lifecycle: create -> read -> advance -> command -> events', async () => {
    const created = await json('POST', '/matches', { player1Id: 'p1', player2Id: 'p2', gameSize: 'incursion' });
    assert.equal(created.status, 201);
    const match = await parse(created);
    assert.ok(MatchStateSchema.safeParse(match).success, 'response is a shared MatchState');
    assert.equal(match.gameSize, 'incursion');

    const read = await json('GET', `/matches/${match.id}`);
    assert.equal(read.status, 200);
    assert.equal((await json('GET', '/matches/does-not-exist')).status, 404);

    const advanced = await parse(await json('POST', `/matches/${match.id}/advance-phase`, {}));
    assert.equal(advanced.phase, 'command');

    const commanded = await json('POST', `/matches/${match.id}/command`, {
      type: 'MoveUnit',
      playerId: 'p1',
      unitId: 'u1',
      distance: 3,
    });
    assert.equal(commanded.status, 200);
    const result = await parse(commanded);
    assert.equal(result.isLegal, true);
    assert.equal(result.applied, true);
    assert.match(result.id, /^[0-9a-f-]{36}$/, 'legality result carries an audit id');

    const events = await parse(await json('GET', `/matches/${match.id}/events`));
    assert.deepEqual(events.map((e: { type: string }) => e.type), ['phase_advanced', 'command_executed']);
  });

  test('POST /matches/:id/override needs a legalityResultId', async () => {
    const match = await parse(await json('POST', '/matches', { player1Id: 'p1', player2Id: 'p2' }));
    assert.equal((await json('POST', `/matches/${match.id}/override`, {})).status, 400);
    const ok = await parse(await json('POST', `/matches/${match.id}/override`, { legalityResultId: 'lr-1' }));
    assert.equal(ok.success, true);
  });
});
