/*
 * sim.test.js — headless determinism test for the LL.Sim world core.
 *
 *   node src/sim.test.js      -> exit 0 on pass, 1 on fail
 *
 * Drives the REAL public API (reset / prePlcTick / postPlcTick) under node
 * with a stub PLC whose outputs follow a scripted light cycle, so cars
 * genuinely spawn, queue at reds, proceed on greens and cross the loop.
 * Two identical 5000-tick runs from reset(42) must produce byte-identical
 * world snapshots; a different seed must not (guards against a snapshot
 * that is trivially constant). Also checks LOOP_EW actually went true at
 * some point — a positive control that the sensor geometry really ran.
 */
'use strict';

var LL = require('./sim.js');   // sim.js pulls in engine.js for LL.Util.rng
var Sim = LL.Sim;

/* Stub PLC: deterministic scripted outputs; records what the sim writes. */
function stubPlc() {
  var out = {};
  return {
    scanMs: 20,
    simTimeMs: 0,
    scanCount: 0,
    inputs: {},              // latched physical inputs, as the sim set them
    loopEverTrue: false,
    inputImage: {},
    setPhysicalInput: function (tag, v) {
      this.inputs[tag] = v ? 1 : 0;
      if (tag === 'LOOP_EW' && v) this.loopEverTrue = true;
    },
    pulseInput: function () { /* no-op: pulse semantics belong to the engine */ },
    outputs: function () { return out; },
    scan: function () {
      // copy latched inputs -> image (what the engine's input scan does)
      for (var k in this.inputs) this.inputImage[k] = this.inputs[k];
      this.simTimeMs += this.scanMs;
      this.scanCount += 1;
      // scripted cycle: NS grn 8s / NS yel 3s / EW grn 8s / EW yel 3s,
      // opposite red; WALK_NS for the first 4s of each NS green; MOTOR on.
      var t = this.simTimeMs % 22000;
      for (var o in out) out[o] = 0;
      if (t < 8000) {
        out.NS_GRN = 1; out.EW_RED = 1;
        if (t < 4000) out.WALK_NS = 1;
      } else if (t < 11000) {
        out.NS_YEL = 1; out.EW_RED = 1;
      } else if (t < 19000) {
        out.EW_GRN = 1; out.NS_RED = 1;
        if (t < 15000) out.WALK_EW = 1;
      } else {
        out.EW_YEL = 1; out.NS_RED = 1;
      }
      out.MOTOR = 1;
    }
  };
}

function run(seed, ticks) {
  Sim.reset(seed);
  var plc = stubPlc();
  for (var i = 0; i < ticks; i++) {
    Sim.prePlcTick(plc);
    plc.scan();
    Sim.postPlcTick(plc, plc.scanMs);
  }
  return { snap: JSON.stringify(Sim.snapshot()), loop: plc.loopEverTrue };
}

var failures = [];
function check(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures.push(name);
}

var a = run(42, 5000);
var b = run(42, 5000);
var c = run(1337, 5000);

check('5000 ticks from reset(42), twice: identical world snapshots', a.snap === b.snap);
check('different seed (1337) produces a different world', a.snap !== c.snap);
check('snapshot is non-trivial (cars exist after 100 s)', /"s":/.test(a.snap));
check('LOOP_EW went true during the run (sensor geometry exercised)', a.loop);

// Third repeat AFTER other seeds ran: no state leaks between resets.
var d = run(42, 5000);
check('reset(42) after other seeds still reproduces the same world', d.snap === a.snap);

console.log('----');
if (failures.length) {
  console.log(failures.length + ' FAILED');
  process.exit(1);
} else {
  console.log('all sim determinism tests passed');
  process.exit(0);
}
