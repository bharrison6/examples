/*
 * Ladder Lab — engine.test.js
 * ---------------------------
 * Standalone node test runner for the PLC engine.
 *
 *   node src/engine.test.js
 *
 * The full unit test suite lives INSIDE engine.js (as LL.Engine.runSelfTests)
 * so the exact same tests run in the browser via ?selftest=1 and on the
 * command line via `node src/engine.js --test`. This runner requires the
 * engine, performs a few extra API-surface sanity checks, executes the suite,
 * prints one line per test, and exits 0 on success / 1 on any failure.
 */
'use strict';

var LL = require('./engine.js');

var failures = 0;

/* ---- API-surface sanity checks (the module contract other files rely on) */

function apiCheck(name, cond) {
  if (cond) {
    console.log('PASS  [api] ' + name);
  } else {
    console.log('FAIL  [api] ' + name);
    failures += 1;
  }
}

apiCheck('module exports the LL namespace object', LL && typeof LL === 'object');
apiCheck('LL.Engine.PLC is a constructor', typeof LL.Engine === 'object' && typeof LL.Engine.PLC === 'function');
apiCheck('LL.Engine.runSelfTests is a function', typeof LL.Engine.runSelfTests === 'function');
apiCheck('LL.Validate.check is a function', LL.Validate && typeof LL.Validate.check === 'function');
apiCheck('LL.Util.rng is a function', LL.Util && typeof LL.Util.rng === 'function');
apiCheck('LL.Util.deepClone is a function', LL.Util && typeof LL.Util.deepClone === 'function');

// A PLC instance must expose the exact public surface the UI modules depend on.
var probe = new LL.Engine.PLC({ id: 'probe', name: 'probe', rungs: [{ items: [{ t: 'XIC', tag: 'PB_START' }, { t: 'OTE', tag: 'MOTOR' }] }] }, { scanMs: 20 });
[
  'scan', 'reset', 'setPhysicalInput', 'getPhysicalInput', 'pulseInput', 'outputs', 'tagList'
].forEach(function (fn) {
  apiCheck('plc.' + fn + '() exists', typeof probe[fn] === 'function');
});
apiCheck('plc.program carries stable element ids', probe.program.rungs[0].items[0].id === 'r0.0');
apiCheck('plc.scanMs / scanCount / simTimeMs present',
  probe.scanMs === 20 && probe.scanCount === 0 && probe.simTimeMs === 0);
apiCheck('plc.inputImage / outputImage / bits / timers / counters present',
  probe.inputImage && probe.outputImage && probe.bits && probe.timers && probe.counters ? true : false);
apiCheck('plc.changedBits is a Set', probe.changedBits instanceof Set);
probe.scan();
apiCheck('plc.power keyed by element ids after a scan',
  probe.power && probe.power['r0.0'] && typeof probe.power['r0.0'].in === 'number');
apiCheck('scan advances simulated time deterministically',
  probe.scanCount === 1 && probe.simTimeMs === 20);

/* ---- the embedded engine test suite ------------------------------------ */

var report = LL.Engine.runSelfTests();
report.results.forEach(function (r) {
  console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.name);
  if (!r.pass) console.log('      ' + r.detail);
});
failures += report.failed;

console.log('----');
console.log(report.passed + ' engine tests passed, ' + report.failed + ' failed; ' +
  'total failures including API checks: ' + failures);
process.exit(failures > 0 ? 1 : 0);
