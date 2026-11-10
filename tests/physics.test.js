import { test, assert, assertClose } from './harness.js';
import { HALF_L, HALF_W, R, MAX_STEPS } from '../src/physics/constants.js';
import { makeBall, stepFree, isAtRest } from '../src/physics/simulate.js';

const speedOf = (b) => Math.sqrt(b.vx * b.vx + b.vz * b.vz);

test('constants: table is 1.98 x 0.99', () => {
  assert(HALF_L * 2 === 1.98, 'length');
  assert(HALF_W * 2 === 0.99, 'width');
});

test('free: no-spin ball reaches natural roll at 5/7 of initial speed', () => {
  const b = makeBall(0, 0, 0);
  b.vz = -2;
  let n = 0;
  while (Math.abs(b.vz - R * b.wx) > 1e-3 && n++ < 2000) stepFree(b);
  assert(n > 5 && n < 2000, `steps to roll: ${n}`);
  assertClose(-b.vz, (2 * 5) / 7, 0.03);
});

test('free: rolling ball stops and stays stopped', () => {
  const b = makeBall(0, 0, 0);
  b.vz = -1;
  b.wx = -1 / R;
  for (let i = 0; i < MAX_STEPS; i++) stepFree(b);
  assert(b.vx === 0 && b.vz === 0 && b.wx === 0 && b.wz === 0, 'not stopped');
  assert(isAtRest({ balls: [b] }), 'isAtRest');
  assert(b.z < -1, `rolled only to ${b.z}`);
});

test('free: speed never increases', () => {
  const b = makeBall(0, 0, 0);
  b.vz = -3;
  b.vx = 1;
  let prev = speedOf(b);
  for (let i = 0; i < 500; i++) {
    stepFree(b);
    const s = speedOf(b);
    assert(s <= prev + 1e-12, `speed rose at step ${i}`);
    prev = s;
  }
});

// ---------- Task 3: choques entre bolas ----------
import { step, createRack, strike, simulateShot, findFreeSpot, isLegalCuePosition } from '../src/physics/simulate.js';
import { POCKETS, CUSHIONS } from '../src/physics/table.js';
import { E_CUSHION, DT } from '../src/physics/constants.js';

// Energia cinetica total (traslacion mas rotacion), salvo el factor m/2.
const energy = (state) =>
  state.balls.reduce((s, b) => (b.pocketed ? s : s + b.vx * b.vx + b.vz * b.vz + 0.4 * R * R * (b.wx * b.wx + b.wz * b.wz)), 0);
const minGap = (state) => {
  let m = Infinity;
  const bs = state.balls.filter((b) => !b.pocketed);
  for (let i = 0; i < bs.length; i++)
    for (let j = i + 1; j < bs.length; j++) {
      const dx = bs[i].x - bs[j].x, dz = bs[i].z - bs[j].z;
      m = Math.min(m, Math.sqrt(dx * dx + dz * dz));
    }
  return m;
};
const twoBalls = (v) => {
  const cue = makeBall(0, 0, 0.5);
  cue.vz = -v;
  cue.wx = -v / R;
  return { balls: [cue, makeBall(1, 0, 0)] };
};

test('ballBall: head-on hit transfers velocity', () => {
  const s = twoBalls(2);
  const ev = [];
  let n = 0;
  while (ev.length === 0 && n++ < 240) step(s, ev);
  assert(ev.length === 1, 'no hit');
  assert(s.balls[1].vz < -1.5, `object vz ${s.balls[1].vz}`);
  assert(Math.abs(s.balls[0].vz) < 0.4, `cue vz ${s.balls[0].vz}`);
});

test('ballBall: fast ball does not tunnel', () => {
  const cue = makeBall(0, 0, 0.3);
  cue.vz = -9;
  const s = { balls: [cue, makeBall(1, 0, 0)] };
  const ev = [];
  for (let i = 0; i < 60; i++) {
    step(s, ev);
    assert(minGap(s) >= 2 * R - 1e-6, `overlap at step ${i}: ${minGap(s)}`);
  }
  assert(ev.some((e) => e.type === 'ballBall'), 'no ballBall event');
});

test('ballBall: kinetic energy never increases across a hit', () => {
  const s = twoBalls(3);
  let prev = energy(s);
  for (let i = 0; i < 300; i++) {
    step(s, []);
    const e = energy(s);
    assert(e <= prev + 1e-9, `energy rose at step ${i}`);
    prev = e;
  }
});

test('ballBall: emits event with ids and positive speed', () => {
  const s = twoBalls(2);
  const ev = [];
  for (let i = 0; i < 240; i++) step(s, ev);
  const e = ev.find((x) => x.type === 'ballBall');
  assert(e && e.a === 0 && e.b === 1 && e.speed > 1, JSON.stringify(e));
});

// ---------- Task 4: bandas, troneras, triangulo ----------
const lone = (x, z, vx, vz) => {
  const b = makeBall(0, x, z);
  b.vx = vx;
  b.vz = vz;
  return { balls: [b] };
};

test('cushion: perpendicular hit returns E_CUSHION of the speed', () => {
  const s = lone(0, 0.3, 2, 0);
  s.balls[0].wz = -2 / R; // rodando, para que la friccion apenas cambie la velocidad
  const ev = [];
  let before = 0;
  let n = 0;
  while (ev.length === 0 && n++ < 400) {
    before = s.balls[0].vx;
    step(s, ev);
  }
  assert(ev[0] && ev[0].type === 'cushion', 'no cushion event');
  assertClose(-s.balls[0].vx, before * E_CUSHION, 0.06);
});

test('cushion: ball at 9 m/s never leaves the bed', () => {
  for (let k = 0; k < 200; k++) {
    const a = (k * 2 * Math.PI) / 200 + 0.0137;
    const s = lone(0.1, -0.2, 9 * Math.cos(a), 9 * Math.sin(a));
    for (let i = 0; i < 2400 && !isAtRest(s); i++) {
      step(s, []);
      const b = s.balls[0];
      if (b.pocketed) break;
      assert(Math.abs(b.x) <= HALF_W + 0.09 && Math.abs(b.z) <= HALF_L + 0.09, `left bed, dir ${k}: ${b.x}, ${b.z}`);
      assert(Number.isFinite(b.x) && Number.isFinite(b.z), 'non finite');
    }
  }
});

test('pocket: ball aimed at a corner pocket is pocketed, with event', () => {
  const p = POCKETS[0];
  const dx = p.x - 0, dz = p.z - 0;
  const d = Math.sqrt(dx * dx + dz * dz);
  const s = lone(0, 0, (3 * dx) / d, (3 * dz) / d);
  const ev = [];
  for (let i = 0; i < 2400 && !isAtRest(s); i++) step(s, ev);
  assert(s.balls[0].pocketed, 'not pocketed');
  const e = ev.find((x) => x.type === 'pocket');
  assert(e && e.ball === 0 && e.pocket === p.id, JSON.stringify(ev));
});

test('pocket: ball hitting the jaw point can stay out', () => {
  // Bola pegada a la banda larga este, rodando hacia la tronera de esquina: toca la punta y no entra.
  let stayedOut = 0;
  for (let k = 0; k < 20; k++) {
    const s = lone(HALF_W - R - 0.012 - k * 0.001, 0.3, 0.25, 1.2);
    for (let i = 0; i < 4800 && !isAtRest(s); i++) step(s, []);
    if (!s.balls[0].pocketed) stayedOut++;
  }
  assert(stayedOut > 0, 'every near-rail ball was pocketed');
});

test('rack: 16 balls, none overlapping, 8 in the middle of row 3', () => {
  const s = createRack();
  assert(s.balls.length === 16, 'count');
  s.balls.forEach((b, i) => assert(b.id === i, 'ids in order'));
  assert(minGap(s) >= 2 * R, `gap ${minGap(s)}`);
  assertClose(s.balls[8].x, 0, 1e-9);
  assertClose(s.balls[8].z, -0.495 - 2 * (R + 0.5e-5) * Math.sqrt(3), 1e-6);
  assert(s.balls[0].x === 0 && s.balls[0].z === 0.495, 'cue on head spot');
});

const BREAK = { dirX: 0.02, dirZ: -Math.sqrt(1 - 0.02 * 0.02), speed: 9 };

test('break: all values finite and no overlaps after a 9 m/s break', () => {
  const s = createRack();
  const { events } = simulateShot(s, BREAK);
  for (const b of s.balls) {
    for (const k of ['x', 'z', 'vx', 'vz', 'wx', 'wy', 'wz']) assert(Number.isFinite(b[k]), `ball ${b.id} ${k}`);
  }
  assert(minGap(s) >= 2 * R - 1e-6, `gap ${minGap(s)}`);
  assert(isAtRest(s), 'not at rest');
  assert(events.filter((e) => e.type === 'ballBall').length >= 10, 'rack did not spread');
});

test('determinism: same break twice gives identical positions and events', () => {
  const a = createRack(), b = createRack();
  const ra = simulateShot(a, BREAK), rb = simulateShot(b, BREAK);
  assert(JSON.stringify(a) === JSON.stringify(b), 'states differ');
  assert(JSON.stringify(ra) === JSON.stringify(rb), 'events differ');
});

test('termination: 50 fixed shots all come to rest before MAX_STEPS', () => {
  for (let k = 0; k < 50; k++) {
    const a = (k * 2 * Math.PI) / 50 + 0.05;
    const s = createRack();
    const { steps } = simulateShot(s, { dirX: Math.cos(a), dirZ: Math.sin(a), speed: 1 + (k % 9) });
    assert(steps < MAX_STEPS, `shot ${k} hit MAX_STEPS`);
    assert(isAtRest(s), `shot ${k} not at rest`);
  }
});

test('energy: total kinetic energy is non-increasing during a break', () => {
  const s = createRack();
  strike(s, BREAK);
  let prev = energy(s);
  for (let i = 0; i < 2400; i++) {
    step(s, []);
    const e = energy(s);
    assert(e <= prev + 1e-9, `energy rose at step ${i}: ${prev} -> ${e}`);
    prev = e;
  }
});

test('findFreeSpot: returns the nearest free point when the spot is taken', () => {
  const s = createRack();
  s.balls[5].x = 0;
  s.balls[5].z = 0.6;
  s.balls[0].pocketed = true;
  assert(!isLegalCuePosition(s, 0, 0.6, true), 'occupied spot is legal');
  const p = findFreeSpot(s, 0, 0.6, true);
  assert(isLegalCuePosition(s, p.x, p.z, true), 'returned spot not legal');
  const d = Math.sqrt(p.x * p.x + (p.z - 0.6) * (p.z - 0.6));
  assert(d >= 2 * R && d < 4 * R, `distance ${d}`);
  assert(!isLegalCuePosition(s, 0, 0.2, true), 'outside kitchen accepted');
  assert(isLegalCuePosition(s, 0, 0.2, false), 'anywhere rejected');
});

import { createRack as rackForBreak, strike as strikeForBreak, step as stepForBreak, isAtRest as restForBreak } from '../src/physics/simulate.js';
import { cueSpeed } from '../src/physics/constants.js';

test('break: at full power the whole rack opens, not just the corner balls', () => {
  for (const x of [0, 0.006, -0.011]) {
    const s = rackForBreak();
    s.balls[0].x = x;
    const start = s.balls.map((b) => ({ x: b.x, z: b.z }));
    const dz = s.balls[1].z - s.balls[0].z;
    const dx = s.balls[1].x - s.balls[0].x;
    const d = Math.sqrt(dx * dx + dz * dz);
    strikeForBreak(s, { dirX: dx / d, dirZ: dz / d, speed: cueSpeed(1) });
    const ev = [];
    let n = 0;
    while (!restForBreak(s) && n++ < 240 * 45) stepForBreak(s, ev);
    let moved = 0;
    for (let i = 1; i < 16; i++) {
      const b = s.balls[i];
      if (b.pocketed || Math.hypot(b.x - start[i].x, b.z - start[i].z) > 0.25) moved++;
    }
    assert(moved >= 11, `only ${moved} of 15 balls left the rack (cue x ${x})`);
  }
});

test('power bar: full power is 75% of the old 10.5 m/s, the whole bar scales the same', () => {
  assert(Math.abs(cueSpeed(1) - 0.75 * 10.5) < 1e-9);
  assert(Math.abs(cueSpeed(0.5) - 0.75 * (0.3 + 0.25 * 8.7)) < 0.01);
  for (let p = 0; p < 1; p += 0.05) assert(cueSpeed(p + 0.05) > cueSpeed(p), 'not increasing');
});
