import { test, assert, assertClose } from './harness.js';
import { R, HALF_L } from '../src/physics/constants.js';
import { makeBall } from '../src/physics/simulate.js';
import { predictAim } from '../src/physics/aim.js';

test('aim: straight shot reports the ball and its direction', () => {
  const s = { balls: [makeBall(0, 0, 0.5), makeBall(1, 0, 0)] };
  const a = predictAim(s, 0, -1);
  assert(a.hitBall === 1, `hit ${a.hitBall}`);
  assertClose(a.endZ, 2 * R, 1e-9);
  assertClose(a.objDirX, 0, 1e-9);
  assertClose(a.objDirZ, -1, 1e-9);
});

test('aim: cut shot sends the object ball along the line of centers', () => {
  const s = { balls: [makeBall(0, R, 0.5), makeBall(1, 0, 0)] };
  const a = predictAim(s, 0, -1);
  assert(a.hitBall === 1, 'no hit');
  const dx = 0 - a.endX, dz = 0 - a.endZ;
  const d = Math.sqrt(dx * dx + dz * dz);
  assertClose(d, 2 * R, 1e-9);
  assertClose(a.objDirX, dx / d, 1e-9);
  assertClose(a.objDirZ, dz / d, 1e-9);
  assert(a.objDirX < -0.1, 'object ball should go left');
});

test('aim: empty path ends one radius from the cushion', () => {
  const s = { balls: [makeBall(0, 0, 0.5)] };
  const a = predictAim(s, 0, -1);
  assert(a.hitBall === null, 'unexpected hit');
  assertClose(a.endZ, -HALF_L + R, 1e-9);
  assert(a.objDirX === 0 && a.objDirZ === 0, 'objDir should be zero');
});
