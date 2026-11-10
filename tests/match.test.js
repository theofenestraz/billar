import { test, assert } from './harness.js';
import { createGame } from '../src/game/match.js';
import { POCKETS } from '../src/physics/table.js';
import { isLegalCuePosition } from '../src/physics/simulate.js';

const settle = (g) => {
  let n = 0;
  while (g.state === 'rolling' && n++ < 20000) g.tick();
  return n;
};

test('match: starts placing the cue ball in the kitchen', () => {
  const g = createGame(['A', 'B']);
  assert(g.state === 'placing' && g.match.ballInHand === 'kitchen');
  assert(g.placeCue(0, 0.2) === false, 'outside the kitchen accepted');
  assert(g.placeCue(0.1, 0.7) === true && g.state === 'aiming');
  assert(g.table.balls[0].x === 0.1 && g.table.balls[0].z === 0.7);
});

test('match: shot below minimum power is rejected and changes nothing', () => {
  const g = createGame(['A', 'B']);
  g.placeCue(0, 0.6);
  const before = JSON.stringify(g.match);
  assert(g.shoot(0, -1, 0.01) === false);
  assert(JSON.stringify(g.match) === before && g.state === 'aiming');
});

test('match: cannot shoot or place while balls are rolling', () => {
  const g = createGame(['A', 'B']);
  g.placeCue(0, 0.6);
  assert(g.shoot(0, -1, 1) === true && g.state === 'rolling');
  assert(g.shoot(0, -1, 1) === false, 'second shot accepted');
  assert(g.placeCue(0, 0.7) === false, 'placement accepted while rolling');
});

test('match: a full break resolves to aiming or placing, never stuck in rolling', () => {
  const g = createGame(['A', 'B']);
  g.placeCue(0, 0.6);
  g.shoot(0, -1, 1);
  settle(g);
  assert(g.state === 'aiming' || g.state === 'placing', `state ${g.state}`);
  assert(g.match.phase === 'play' || g.match.lastResult.rerack, 'phase did not advance');
});

test('match: scratch gives the rival ball in hand and state placing', () => {
  const g = createGame(['A', 'B']);
  g.placeCue(0, 0.6);
  const cue = g.table.balls[0];
  cue.x = 0.3;
  cue.z = 0.8;
  const p = POCKETS.find((q) => q.x > 0 && q.z > 0.5);
  const dx = p.x - cue.x, dz = p.z - cue.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  g.shoot(dx / d, dz / d, 0.4);
  settle(g);
  assert(g.match.lastResult.foul === 'scratch', `foul ${g.match.lastResult.foul}`);
  assert(g.state === 'placing' && g.match.turn === 1 && g.match.ballInHand === 'anywhere');
  const c = g.table.balls[0];
  assert(!c.pocketed && isLegalCuePosition(g.table, c.x, c.z, false), 'cue not respotted legally');
});

test('match: placeCue rejects a position on top of another ball', () => {
  const g = createGame(['A', 'B']);
  const b = g.table.balls[5];
  b.x = 0;
  b.z = 0.7;
  assert(g.placeCue(0.01, 0.7) === false);
  assert(g.state === 'placing');
});

test('match: listeners receive physics events and state changes', () => {
  const g = createGame(['A', 'B']);
  let events = 0, changes = 0;
  g.onEvent(() => events++);
  g.onChange(() => changes++);
  g.placeCue(0, 0.6);
  g.shoot(0, -1, 1);
  settle(g);
  assert(events > 10 && changes >= 3, `events ${events}, changes ${changes}`);
});

test('match: rematch resets the table and keeps the score', () => {
  const g = createGame(['A', 'B']);
  g.match = { ...g.match, phase: 'over', winner: 1, players: [{ ...g.match.players[0] }, { ...g.match.players[1], wins: 1 }] };
  g.state = 'over';
  g.rematch();
  assert(g.state === 'placing' && g.match.turn === 0 && g.match.players[1].wins === 1);
  assert(g.table.balls.every((b) => !b.pocketed));
});

test('match: two games fed the same actions stay identical, and a snapshot restores state', () => {
  const a = createGame(['A', 'B']);
  const b = createGame(['A', 'B']);
  for (const g of [a, b]) {
    g.placeCue(0.13, 0.61);
    g.shoot(-0.0721, -0.9974, 0.83);
    settle(g);
  }
  assert(a.snapshot() === b.snapshot(), 'same inputs gave different states');
  const c = createGame(['X', 'Y']);
  assert(c.adopt(a.snapshot()) === true);
  assert(c.snapshot() === a.snapshot() && c.match.players[0].name === 'A');
  // La copia no comparte objetos con el original.
  c.table.balls[0].x += 0.01;
  assert(c.snapshot() !== a.snapshot());
  // Tras adoptar, la partida sigue siendo jugable e identica.
  const d = createGame(['X', 'Y']);
  d.adopt(a.snapshot());
  const play = (g) => {
    if (g.state === 'placing') g.placeCue(g.table.balls[0].x, g.table.balls[0].z);
    const ok = g.shoot(0.3, -0.954, 0.5);
    settle(g);
    return ok;
  };
  assert(play(a) === play(d));
  assert(a.snapshot() === d.snapshot(), 'diverged after adopting a snapshot');
});

test('match: adopt is refused while balls are rolling', () => {
  const a = createGame(['A', 'B']);
  const snap = a.snapshot();
  a.placeCue(0, 0.6);
  a.shoot(0, -1, 0.5);
  assert(a.adopt(snap) === false && a.state === 'rolling');
});
