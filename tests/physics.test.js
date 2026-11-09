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
