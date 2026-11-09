const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

export function assertClose(actual, expected, tol, msg) {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(`${msg || 'assertClose'}: got ${actual}, expected ${expected} +-${tol}`);
  }
}

export function run() {
  const out = globalThis.print ?? console.log;
  let failed = 0;
  for (const t of tests) {
    try {
      t.fn();
    } catch (e) {
      failed++;
      out(`FAIL ${t.name}: ${e && e.message ? e.message : e}`);
    }
  }
  out(failed ? `FAILED (${failed} of ${tests.length})` : `ALL PASS (${tests.length})`);
}
