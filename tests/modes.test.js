import { test, assert, assertClose } from './harness.js';
import { R, HALF_W, HALF_L } from '../src/physics/constants.js';
import { makeBall, strike, step, simulateShot, createRack } from '../src/physics/simulate.js';
import { createGame } from '../src/game/match.js';
import { newMatch } from '../src/rules/eightball.js';
import { newSolo, applySoloShot, soloRemaining } from '../src/rules/solo.js';
import { chooseShot, choosePlacement, legalTargets } from '../src/game/ai.js';

const one = (x, z) => ({ balls: [makeBall(0, x, z)] });
const settle = (g) => { let n = 0; while (g.state === 'rolling' && n++ < 30000) g.tick(); };

// ---------- Efectos ----------
test('spin: centre hit gives no spin, as before', () => {
  const s = one(0, 0);
  strike(s, { dirX: 0, dirZ: -1, speed: 2 });
  const c = s.balls[0];
  assert(c.wx === 0 && c.wy === 0 && c.wz === 0 && c.vz === -2);
});

test('spin: a hit 0.4 R above centre starts in natural roll', () => {
  const s = one(0, 0);
  strike(s, { dirX: 0, dirZ: -1, speed: 2, top: 0.8 }); // 0.8 * 0.5 R = 0.4 R
  const c = s.balls[0];
  assertClose(c.wx, c.vz / R, 1e-9, 'wx');
  assertClose(c.wz, -c.vx / R, 1e-9, 'wz');
});

test('spin: from close range, follow goes further than a centre hit and draw comes back', () => {
  const run = (top) => {
    const s = { balls: [makeBall(0, 0, 0.15), makeBall(1, 0, 0)] };
    simulateShot(s, { dirX: 0, dirZ: -1, speed: 1.5, top });
    return s.balls[0].z;
  };
  const centre = run(0);
  const follow = run(1);
  const draw = run(-1);
  assert(follow < centre - 0.05, `follow ended at ${follow}, centre at ${centre}`);
  assert(draw > centre + 0.05, `draw ended at ${draw}, centre at ${centre}`);
});

test('spin: side spin changes the rebound off a cushion, in opposite directions', () => {
  const run = (side) => {
    const s = one(0, 0);
    strike(s, { dirX: 0, dirZ: -1, speed: 3, side });
    const ev = [];
    for (let i = 0; i < 400 && s.balls[0].vz <= 0; i++) step(s, ev);
    return s.balls[0];
  };
  const none = run(0);
  const right = run(1);
  const left = run(-1);
  assertClose(none.vx, 0, 1e-12, 'no spin should come straight back');
  assert(right.vx !== 0 && left.vx !== 0, 'side spin had no effect');
  assertClose(right.vx, -left.vx, 1e-9, 'not symmetric');
  assert(Math.abs(right.wy) < Math.abs((2.5 * 0.5 * 3) / R), 'cushion did not consume spin');
});

test('spin: offsets beyond the limit are clamped to the edge of the allowed circle', () => {
  const a = one(0, 0);
  const b = one(0, 0);
  strike(a, { dirX: 1, dirZ: 0, speed: 2, side: 3, top: 4 });
  strike(b, { dirX: 1, dirZ: 0, speed: 2, side: 0.6, top: 0.8 });
  assertClose(a.balls[0].wy, b.balls[0].wy, 1e-9);
  assertClose(a.balls[0].wz, b.balls[0].wz, 1e-9);
});

// ---------- Solitario ----------
test('solo: rack has ten balls in play and five out', () => {
  const t = createRack('solo');
  const live = t.balls.filter((b) => b.id !== 0 && !b.pocketed);
  assert(live.length === 10, `live ${live.length}`);
  assert(live.some((b) => b.id === 8));
  assert(t.balls.filter((b) => b.out).length === 5);
});

test('solo: potting colours counts down, scratch only sends the cue ball back', () => {
  let m = newSolo('A');
  assert(soloRemaining(m) === 9);
  m = applySoloShot(m, { firstContact: 1, pocketed: [1, 9], cuePocketed: false });
  assert(soloRemaining(m) === 7 && m.shots === 1 && m.phase === 'play' && m.ballInHand === null);
  m = applySoloShot(m, { firstContact: 2, pocketed: [], cuePocketed: true });
  assert(m.phase === 'play' && m.lastResult.foul === 'scratch' && m.ballInHand === null && m.shots === 2);
});

test('solo: black last wins and records the best, black early loses', () => {
  let m = newSolo('A');
  m = applySoloShot(m, { firstContact: 1, pocketed: [1, 2, 3, 4, 5, 9, 10, 11, 12], cuePocketed: false });
  const win = applySoloShot(m, { firstContact: 8, pocketed: [8], cuePocketed: false });
  assert(win.phase === 'over' && win.winner === 0 && win.best === 2);
  const scratch = applySoloShot(m, { firstContact: 8, pocketed: [8], cuePocketed: true });
  assert(scratch.phase === 'over' && scratch.winner === -1);
  const early = applySoloShot(newSolo('A'), { firstContact: 8, pocketed: [8], cuePocketed: false });
  assert(early.phase === 'over' && early.winner === -1);
});

test('solo: game runs a shot, and a scratch puts the cue ball back at the start without ball in hand', () => {
  const g = createGame(['A', 'B']);
  g.restart(['Solo'], 'solo');
  assert(g.match.mode === 'solo' && g.state === 'placing');
  g.placeCue(0, 0.6);
  g.shoot(0, -1, 0.7);
  settle(g);
  assert(g.match.shots === 1 && (g.state === 'aiming' || g.state === 'over'));
  // Blanca directa a la tronera de la esquina.
  const h = createGame(['A', 'B']);
  h.restart(['Solo'], 'solo');
  h.placeCue(0.3, 0.7);
  const c = h.table.balls[0];
  const dx = HALF_W + 0.012 - c.x;
  const dz = HALF_L + 0.012 - c.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  h.shoot(dx / d, dz / d, 0.5);
  settle(h);
  assert(h.match.lastResult.foul === 'scratch', 'expected a scratch');
  assert(h.state === 'aiming' && !h.table.balls[0].pocketed);
  assertClose(h.table.balls[0].x, 0, 1e-9);
  assertClose(h.table.balls[0].z, 0.495, 1e-9);
  h.restart();
  assert(h.match.mode === 'solo' && h.match.shots === 0, 'restart left solo mode');
});

// ---------- Maquina ----------
const fixedRand = () => 0.5; // error de punteria nulo

function layout(balls) {
  const t = createRack();
  for (const b of t.balls) if (b.id !== 0) b.pocketed = true;
  for (const [id, x, z] of balls) {
    const b = t.balls[id];
    b.pocketed = false;
    b.x = x;
    b.z = z;
  }
  return t;
}

test('ai: pots a straight ball into a corner', () => {
  const t = layout([[0, 0.2, 0.3], [9, 0.35, 0.65]]);
  const m = { ...newMatch(['A', 'M']), turn: 1, phase: 'play', ballInHand: null };
  m.players[1].group = 'stripes';
  m.players[0].group = 'solids';
  const shot = chooseShot(t, m, fixedRand);
  assertClose(shot.dirX * shot.dirX + shot.dirZ * shot.dirZ, 1, 1e-9, 'direction not unit');
  const { events } = simulateShot(t, { dirX: shot.dirX, dirZ: shot.dirZ, speed: 0.3 + shot.power * shot.power * 8.7 });
  assert(events.some((e) => e.type === 'pocket' && e.ball === 9), 'did not pot the 9');
  assert(!events.some((e) => e.type === 'pocket' && e.ball === 0), 'scratched');
});

test('ai: only aims at its own group, and at the black once the group is cleared', () => {
  const t = layout([[0, 0, 0.5], [3, 0.2, 0], [12, -0.2, 0], [8, 0, -0.5]]);
  const m = { ...newMatch(['A', 'M']), turn: 1, phase: 'play', ballInHand: null };
  m.players[1].group = 'stripes';
  m.players[0].group = 'solids';
  assert(legalTargets(t, m).map((b) => b.id).join() === '12');
  t.balls[12].pocketed = true;
  assert(legalTargets(t, m).map((b) => b.id).join() === '8');
});

test('ai: with no pot available it still makes a legal contact', () => {
  // La 9 pegada a la banda norte, lejos de cualquier tronera.
  const t = layout([[0, 0, 0.6], [9, 0, -HALF_L + R + 0.001], [3, 0.1, 0.2]]);
  const m = { ...newMatch(['A', 'M']), turn: 1, phase: 'play', ballInHand: null };
  m.players[1].group = 'stripes';
  m.players[0].group = 'solids';
  const shot = chooseShot(t, m, fixedRand);
  const { events } = simulateShot(t, { dirX: shot.dirX, dirZ: shot.dirZ, speed: 0.3 + shot.power * shot.power * 8.7 });
  const first = events.find((e) => e.type === 'ballBall' && (e.a === 0 || e.b === 0));
  assert(first && (first.a === 9 || first.b === 9), 'first contact was not its own ball');
});

test('ai: breaks into the rack and places the cue ball legally', () => {
  const g = createGame(['A', 'M']);
  const spot = choosePlacement(g.table, g.match);
  assert(g.placeCue(spot.x, spot.z), 'break placement rejected');
  const shot = chooseShot(g.table, g.match, fixedRand);
  assert(g.shoot(shot.dirX, shot.dirZ, shot.power));
  settle(g);
  assert(g.match.lastResult.foul !== 'noContact', 'break missed the rack');
  // Bola en mano en mitad de la partida.
  const t = layout([[0, 0, 0], [9, 0.3, -0.6], [2, -0.3, 0.4]]);
  const m = { ...newMatch(['A', 'M']), turn: 1, phase: 'play', ballInHand: 'anywhere' };
  m.players[1].group = 'stripes';
  m.players[0].group = 'solids';
  const p = choosePlacement(t, m);
  assert(Math.abs(p.x) <= HALF_W - R && Math.abs(p.z) <= HALF_L - R, 'placement off the bed');
});
