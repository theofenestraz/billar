import { test, assert, assertClose } from './harness.js';
import { HALF_L, HALF_W } from '../src/physics/constants.js';

test('constants: table is 1.98 x 0.99', () => {
  assert(HALF_L * 2 === 1.98, 'length');
  assert(HALF_W * 2 === 0.99, 'width');
});
