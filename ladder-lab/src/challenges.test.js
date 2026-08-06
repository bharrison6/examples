/*
 * Ladder Lab — src/challenges.test.js
 * Node test script for LL.Challenges: `node src/challenges.test.js` (exit 0/1).
 *
 * Contains hand-written REFERENCE SOLUTIONS for all four challenges (the
 * answer key — exported as module.exports.solutions) plus targeted broken
 * variants that must fail at the RIGHT grader step with a sensible message.
 *
 * The challenge-3 solution here is deliberately wired DIFFERENTLY from the
 * challenge-4 starter (no cross-interlock XIOs, reds derived from the lamp
 * outputs, timers T5..T8) to prove the grader accepts any behaviorally
 * correct implementation. The challenge-4 solution is built the way a
 * student would build it: the shipped starter plus crosswalk rungs.
 */
'use strict';

var LL = require('./challenges.js');
var Challenges = LL.Challenges;

/* ======================================================================
 * tiny element helpers — keep the program JSONs readable
 * ====================================================================== */

function XIC(tag) { return { t: 'XIC', tag: tag }; }
function XIO(tag) { return { t: 'XIO', tag: tag }; }
function ONS(tag) { return { t: 'ONS', tag: tag }; }
function OTE(tag) { return { t: 'OTE', tag: tag }; }
function OTL(tag) { return { t: 'OTL', tag: tag }; }
function OTU(tag) { return { t: 'OTU', tag: tag }; }
function TON(tag, pre) { return { t: 'TON', tag: tag, pre: pre }; }
function BR() { return { t: 'BR', paths: Array.prototype.slice.call(arguments) }; }
function rung(comment, items) { return { comment: comment, items: items }; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }

/* ======================================================================
 * REFERENCE SOLUTIONS (the answer key)
 * ====================================================================== */

var solutions = {};

/* --- 1. sealin: the classic three-wire start/stop, one rung --- */
solutions.sealin = {
  id: 'sol_sealin',
  name: 'Solution 1 — Motor Seal-In',
  usesMotor: true,
  rungs: [
    rung('Start/stop with seal-in: START or the motor’s own contact, through the NC stop',
      [BR([XIC('PB_START')], [XIC('MOTOR')]), XIO('PB_STOP'), OTE('MOTOR')])
  ]
};

/* --- 2. delayed: seal in a memory bit, TON 3 s, motor from T1.DN --- */
solutions.delayed = {
  id: 'sol_delayed',
  name: 'Solution 2 — Delayed Motor Start',
  usesMotor: true,
  rungs: [
    rung('Arm: B1 seals in from START, broken by STOP',
      [BR([XIC('PB_START')], [XIC('B1')]), XIO('PB_STOP'), OTE('B1')]),
    rung('3-second on-delay while armed (drops and resets if the seal breaks)',
      [XIC('B1'), TON('T1', 3000)]),
    rung('Motor runs once the delay is done',
      [XIC('T1.DN'), OTE('MOTOR')])
  ]
};

/* --- 3. stoplight: 4-step sequencer, wired differently from the starter
 *      (no cross-interlock, reds from XIO of the lamp outputs, T5..T8) --- */
solutions.stoplight = {
  id: 'sol_stoplight',
  name: 'Solution 3 — Basic Timed Stoplight',
  usesMotor: false,
  rungs: [
    rung('Power-up: latch step 1 when no step is active',
      [XIO('B1'), XIO('B2'), XIO('B3'), XIO('B4'), OTL('B1')]),
    rung('NS green times 6 s', [XIC('B1'), TON('T5', 6000)]),
    rung('Advance to NS yellow', [XIC('T5.DN'), OTL('B2'), OTU('B1')]),
    rung('NS yellow times 2 s', [XIC('B2'), TON('T6', 2000)]),
    rung('Advance to EW green', [XIC('T6.DN'), OTL('B3'), OTU('B2')]),
    rung('EW green times 6 s', [XIC('B3'), TON('T7', 6000)]),
    rung('Advance to EW yellow', [XIC('T7.DN'), OTL('B4'), OTU('B3')]),
    rung('EW yellow times 2 s', [XIC('B4'), TON('T8', 2000)]),
    rung('Wrap to NS green', [XIC('T8.DN'), OTL('B1'), OTU('B4')]),
    rung('Lamps from the step bits', [XIC('B1'), OTE('NS_GRN')]),
    rung('', [XIC('B2'), OTE('NS_YEL')]),
    rung('', [XIC('B3'), OTE('EW_GRN')]),
    rung('', [XIC('B4'), OTE('EW_YEL')]),
    rung('NS red = NS shows neither green nor yellow',
      [XIO('NS_GRN'), XIO('NS_YEL'), OTE('NS_RED')]),
    rung('EW red = EW shows neither green nor yellow',
      [XIO('EW_GRN'), XIO('EW_YEL'), OTE('EW_RED')])
  ]
};

/* --- 4. crosswalk: the shipped starter + crosswalk rungs (B5/B6/B7, T5) --- */
var crosswalkRungs = [
  rung('Any press latches a walk request',
    [XIC('PED_NS'), OTL('B5')]),
  rung('One-shot at the instant NS green begins: grant a pending request, consume it',
    [XIC('B1'), ONS('B6'), XIC('B5'), OTL('B7'), OTU('B5')]),
  rung('Walk timer: 4 s from the start of the walk',
    [XIC('B7'), TON('T5', 4000)]),
  rung('Walk over after 4 s',
    [XIC('T5.DN'), OTU('B7')]),
  rung('Walk sign follows the walk bit',
    [XIC('B7'), OTE('WALK_NS')])
];

solutions.crosswalk = {
  id: 'sol_crosswalk',
  name: 'Solution 4 — Pedestrian Crosswalk',
  usesMotor: false,
  rungs: clone(Challenges.list[3].starter.rungs).concat(clone(crosswalkRungs))
};

module.exports = module.exports || {};
module.exports.solutions = solutions;

/* ======================================================================
 * BROKEN VARIANTS — each must fail at the right step
 * ====================================================================== */

/* ch1 without the seal-in branch: runs only while the button is held */
var sealin_noBranch = {
  id: 'bad_sealin_nobranch', usesMotor: true,
  rungs: [rung('', [XIC('PB_START'), XIO('PB_STOP'), OTE('MOTOR')])]
};

/* ch1 with XIC on the stop button: rung can never conduct */
var sealin_xicStop = {
  id: 'bad_sealin_xicstop', usesMotor: true,
  rungs: [rung('', [BR([XIC('PB_START')], [XIC('MOTOR')]), XIC('PB_STOP'), OTE('MOTOR')])]
};

/* ch1 done with OTL/OTU: behaves perfectly, but the wiring check must catch it */
var sealin_otl = {
  id: 'bad_sealin_otl', usesMotor: true,
  rungs: [
    rung('', [XIC('PB_START'), OTL('MOTOR')]),
    rung('', [XIC('PB_STOP'), OTU('MOTOR')])
  ]
};
/* Old structural check accepted this unrelated decorative branch. */
var sealin_decoyBranch = { id: 'bad_sealin_decoy', usesMotor: true, rungs: [
  rung('', [XIC('PB_START'), OTL('B1')]), rung('', [XIC('PB_STOP'), OTU('B1')]),
  rung('', [XIC('B1'), OTE('MOTOR')]),
  rung('unrelated decorative MOTOR contact', [BR([XIC('MOTOR')], [XIC('B2')]), OTE('B3')])
] };

/* ch2 with a 1.0 s preset: starts far too early */
var delayed_pre1000 = clone(solutions.delayed);
delayed_pre1000.id = 'bad_delayed_pre1000';
delayed_pre1000.rungs[1].items[1].pre = 1000;

/* ch2 without the latch: a momentary press never survives to 3 s */
var delayed_unlatched = {
  id: 'bad_delayed_unlatched', usesMotor: true,
  rungs: [
    rung('', [XIC('PB_START'), XIO('PB_STOP'), TON('T1', 3000)]),
    rung('', [XIC('T1.DN'), OTE('MOTOR')])
  ]
};

/* ch3 where both greens can be on together (EW green also fed from step 1) */
var stoplight_bothGreens = clone(solutions.stoplight);
stoplight_bothGreens.id = 'bad_stoplight_bothgreens';
stoplight_bothGreens.rungs[11] =
  rung('', [BR([XIC('B3')], [XIC('B1')]), OTE('EW_GRN')]);

/* ch3 with an 8 s NS green */
var stoplight_8sGreen = clone(solutions.stoplight);
stoplight_8sGreen.id = 'bad_stoplight_8sgreen';
stoplight_8sGreen.rungs[1].items[1].pre = 8000;

/* ch4 where the walk is granted mid-green (no one-shot on the green edge) */
var crosswalk_midGreen = clone(solutions.crosswalk);
crosswalk_midGreen.id = 'bad_crosswalk_midgreen';
(function () {
  var i = crosswalk_midGreen.rungs.length - 4; // the grant rung
  crosswalk_midGreen.rungs[i] =
    rung('', [XIC('B1'), XIC('B5'), OTL('B7'), OTU('B5')]);
})();

/* ch4 where the walk never ends (no unlatch after 4 s) */
var crosswalk_neverEnds = clone(solutions.crosswalk);
crosswalk_neverEnds.id = 'bad_crosswalk_neverends';
crosswalk_neverEnds.rungs.splice(crosswalk_neverEnds.rungs.length - 2, 1); // drop "walk over"
var crosswalk_noSignals = clone(solutions.crosswalk);
crosswalk_noSignals.id = 'bad_crosswalk_no_signals';
crosswalk_noSignals.rungs.splice(10, 6); // remove all yellow/red lamp drivers
var crosswalk_noYellow = clone(solutions.crosswalk);
crosswalk_noYellow.id = 'bad_crosswalk_no_yellow';
crosswalk_noYellow.rungs.splice(10, 1); // remove NS yellow only

/* a program with a validation error (TON with no preset) */
var invalid_noPreset = {
  id: 'bad_invalid', usesMotor: true,
  rungs: [
    rung('', [BR([XIC('PB_START')], [XIC('B1')]), XIO('PB_STOP'), OTE('B1')]),
    rung('', [XIC('B1'), { t: 'TON', tag: 'T1' }]),
    rung('', [XIC('T1.DN'), OTE('MOTOR')])
  ]
};

/* ======================================================================
 * test runner
 * ====================================================================== */

var failures = 0, checks = 0;

function ok(cond, name, extra) {
  checks++;
  if (cond) {
    console.log('PASS  ' + name);
  } else {
    failures++;
    console.log('FAIL  ' + name);
    if (extra) console.log('      ' + extra);
  }
}

function firstFail(result) {
  for (var i = 0; i < result.steps.length; i++) {
    var s = result.steps[i];
    if (!s.pass && !s.skipped) return s;
  }
  return null;
}

function describeResult(result) {
  var f = firstFail(result);
  return f ? ('first failure: "' + f.desc + '" — ' + f.detail)
           : (result.pass ? 'all steps passed' : 'no explicit failing step?!');
}

function expectPass(chId, program, name) {
  var r = Challenges.grade(chId, program);
  ok(r.pass === true, name, describeResult(r));
  ok(r.steps.length > 0 && r.steps.every(function (s) { return s.pass; }),
    name + ' — every step reports pass', describeResult(r));
  return r;
}

function expectFailAt(chId, program, descRe, detailRe, name) {
  var r = Challenges.grade(chId, program);
  var f = firstFail(r);
  ok(r.pass === false, name + ' — overall fail', describeResult(r));
  ok(!!f, name + ' — has a failing step');
  if (f) {
    ok(descRe.test(f.desc), name + ' — fails at the right step',
      'failed at "' + f.desc + '" — ' + f.detail);
    if (detailRe) {
      ok(detailRe.test(f.detail), name + ' — sensible message',
        'detail was: ' + f.detail);
    }
  }
  return r;
}

console.log('== Ladder Lab challenge grader tests ==\n');

/* ---- shape of the challenge list ---- */
ok(Array.isArray(Challenges.list) && Challenges.list.length === 4, 'list has 4 challenges');
ok(Challenges.list.map(function (c) { return c.id; }).join(',') ===
  'sealin,delayed,stoplight,crosswalk', 'challenge ids and order');
Challenges.list.forEach(function (c) {
  ok(typeof c.title === 'string' && c.title.length > 0 &&
     typeof c.spec === 'string' && c.spec.length > 100 &&
     Array.isArray(c.hints) && c.hints.length >= 2 && c.hints.length <= 3 &&
     Array.isArray(c.requiredTags) && c.requiredTags.length > 0,
    'challenge "' + c.id + '" is fully specified (title/spec/hints/requiredTags)');
});
ok(Challenges.list[3].starter && Array.isArray(Challenges.list[3].starter.rungs) &&
   Challenges.list[3].starter.rungs.length > 0, 'challenge 4 ships a starter program');
ok(!Challenges.list[0].starter && !Challenges.list[1].starter && !Challenges.list[2].starter,
  'challenges 1–3 start from scratch');

console.log('');

/* ---- reference solutions pass ---- */
expectPass('sealin', solutions.sealin, 'reference solution 1 (seal-in) passes');
expectPass('delayed', solutions.delayed, 'reference solution 2 (delayed start) passes');
expectPass('stoplight', solutions.stoplight, 'reference solution 3 (stoplight) passes');
expectPass('crosswalk', solutions.crosswalk, 'reference solution 4 (crosswalk) passes');

/* the shipped ch4 starter must itself be a correct ch3 stoplight */
expectPass('stoplight', Challenges.list[3].starter, 'ch4 starter passes the ch3 grader');

/* ---- grader honesty: valid ALTERNATIVE wirings must also pass ---- */

/* ch1 with the stop contact ahead of the seal branch — same circuit, reordered */
var altSealin = {
  id: 'alt_sealin', usesMotor: true,
  rungs: [rung('', [XIO('PB_STOP'), BR([XIC('PB_START')], [XIC('MOTOR')]), OTE('MOTOR')])]
};
expectPass('sealin', altSealin, 'alternative seal-in (stop before the branch) passes');

/* ch2 built with OTL/OTU instead of a seal-in (no structural mandate here) */
var altDelayed = {
  id: 'alt_delayed', usesMotor: true,
  rungs: [
    rung('', [XIC('PB_START'), OTL('B3')]),
    rung('', [XIC('PB_STOP'), OTU('B3')]),
    rung('', [XIC('B3'), TON('T2', 3000)]),
    rung('', [XIC('T2.DN'), OTE('MOTOR')])
  ]
};
expectPass('delayed', altDelayed, 'alternative delayed start (OTL/OTU latch) passes');

/* ch3 powering up into EW green instead of NS green — phase choice is free */
var altStoplight = clone(solutions.stoplight);
altStoplight.id = 'alt_stoplight_phase';
altStoplight.rungs[0] = rung('Power-up into EW green',
  [XIO('B1'), XIO('B2'), XIO('B3'), XIO('B4'), OTL('B3')]);
expectPass('stoplight', altStoplight, 'alternative stoplight (starts in EW green) passes');

console.log('');

/* ---- broken variants fail at the right step ---- */
expectFailAt('sealin', sealin_noBranch,
  /stays ON after START is released/, /dropped out at scan \d+/,
  'ch1 without the seal-in branch fails the latch step');

expectFailAt('sealin', sealin_xicStop,
  /turns MOTOR ON/, /still OFF at scan \d+/,
  'ch1 with XIC PB_STOP fails the start step');

expectFailAt('sealin', sealin_otl,
  /Wiring check/, /OTL\/OTU/,
  'ch1 built with OTL/OTU fails the wiring check (behavior alone would pass)');
expectFailAt('sealin', sealin_decoyBranch, /Wiring check/, /No seal-in branch/,
  'ch1 unrelated MOTOR decoy branch fails the same-rung seal-in check');

expectFailAt('delayed', delayed_pre1000,
  /waits out the full 3\.0 s/, /only (0\.9|1\.0)\d s after START/,
  'ch2 with a 1.0 s preset fails the 3 s timing step');

expectFailAt('delayed', delayed_unlatched,
  /energizes 3\.0 s/, /never came on/,
  'ch2 without the latch fails: motor never comes on');

expectFailAt('stoplight', stoplight_bothGreens,
  /never on together/, /Both greens were ON together at scan \d+/,
  'ch3 with both greens possible fails the safety invariant');

expectFailAt('stoplight', stoplight_8sGreen,
  /NS green phase lasts 6\.0 s/, /lasted (7\.9|8\.0)\d s/,
  'ch3 with an 8 s green fails the timing step');

expectFailAt('crosswalk', crosswalk_midGreen,
  /DURING an NS green waits for the FOLLOWING green/, /SAME green/,
  'ch4 walk granted mid-green fails the wait-for-next-green step');

expectFailAt('crosswalk', crosswalk_neverEnds,
  /walk lasts 4\.0 s/, /still ON at scan \d+/,
  'ch4 walk that never ends fails the 4 s step');
expectFailAt('crosswalk', crosswalk_noSignals, /required tags/, /NS_YEL|NS_RED/,
  'ch4 removing every yellow/red driver rung fails required complete signal set');
expectFailAt('crosswalk', crosswalk_noYellow, /required tags/, /NS_YEL/,
  'ch4 removing one yellow phase fails required complete signal set');

console.log('');

/* ---- friendly fast-fails ---- */
(function () {
  var r = Challenges.grade('sealin', {});
  ok(!r.pass && r.steps.length === 1 && !r.steps[0].pass &&
     /empty/i.test(r.steps[0].detail),
    'empty program {} fails fast with a friendly message',
    JSON.stringify(r.steps[0]));
  var r2 = Challenges.grade('stoplight', null);
  ok(!r2.pass && /empty/i.test(r2.steps[0].detail), 'null program fails fast');
  var r3 = Challenges.grade('sealin', { rungs: [{ items: [] }] });
  ok(!r3.pass && /empty/i.test(r3.steps[0].detail), 'all-empty-rungs program fails fast');
  var r4 = Challenges.grade('delayed', invalid_noPreset);
  ok(!r4.pass && /preset/i.test(r4.steps[0].detail),
    'validation errors are surfaced before grading', JSON.stringify(r4.steps[0]));
  var r5 = Challenges.grade('nope', solutions.sealin);
  ok(!r5.pass && /Unknown challenge/.test(r5.steps[0].detail), 'unknown challenge id fails fast');
})();

/* ---- wrong program for a challenge: required-tags step catches it ---- */
(function () {
  var r = Challenges.grade('stoplight', solutions.sealin);
  var f = firstFail(r);
  ok(!r.pass && f && /required tags/.test(f.desc),
    'a motor program graded as the stoplight fails the required-tags step',
    f && f.detail);
})();

/* ---- skipped steps after the first failure ---- */
(function () {
  var r = Challenges.grade('sealin', sealin_xicStop);
  var sawFail = false, allAfterSkipped = true;
  r.steps.forEach(function (s) {
    if (sawFail && !s.skipped) allAfterSkipped = false;
    if (!s.pass && !s.skipped) sawFail = true;
  });
  ok(sawFail && allAfterSkipped && /Not checked/.test(r.steps[r.steps.length - 1].detail),
    'steps after the first failure are reported as skipped ("Not checked")');
})();

/* ---- determinism & purity ---- */
(function () {
  var before = JSON.stringify(solutions.stoplight);
  var a = Challenges.grade('stoplight', solutions.stoplight);
  var b = Challenges.grade('stoplight', solutions.stoplight);
  ok(JSON.stringify(a) === JSON.stringify(b), 'grading the same program twice is deeply equal (pass case)');
  ok(JSON.stringify(solutions.stoplight) === before, 'grade() does not mutate the program');
  var c = Challenges.grade('crosswalk', crosswalk_midGreen);
  var d = Challenges.grade('crosswalk', crosswalk_midGreen);
  ok(JSON.stringify(c) === JSON.stringify(d), 'grading the same program twice is deeply equal (fail case)');
})();

/* ---- messages carry scans + seconds ---- */
(function () {
  var r = Challenges.grade('delayed', delayed_pre1000);
  var f = firstFail(r);
  ok(!!f && /scan \d+/.test(f.detail) && /\d\.\d\d s/.test(f.detail),
    'failure details carry scan numbers and seconds', f && f.detail);
})();

console.log('\n----');
console.log((checks - failures) + ' passed, ' + failures + ' failed');
process.exit(failures > 0 ? 1 : 0);
