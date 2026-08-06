/*
 * Ladder Lab — programs.test.js
 * -----------------------------
 * Behavioral test suite for the built-in programs (programs.js) and the
 * fault library (faults.js). Run with:
 *
 *   node src/programs.test.js        -> prints PASS/FAIL lines, exit 0/1
 *
 * Everything here ACTUALLY SIMULATES with the real engine at scanMs = 20;
 * nothing is asserted from inspection of the JSON alone (except validator
 * and byte-identity checks, which are about the JSON by nature).
 *
 * Timing conventions used in the assertions ("tick k" = the committed
 * outputs after the k-th scan, k starting at 0): a TON with preset P
 * completes on the scan where ACC reaches P, and the transition rung fires
 * the same scan, so an 8 s phase spans 399 ticks and a 3 s phase 149 —
 * each nominally one scan short because the completion scan already
 * belongs to the next phase. All timing checks therefore use a tolerance
 * of +-3 scans (60 ms) around the nominal 400/150/200 tick figures.
 *
 * Interpretation note (documented, deliberate): the spec line "exactly one
 * green or two reds at any time" is enforced as the precise legal lamp-
 * state set {NS green + EW red, NS yellow + EW red, EW green + NS red,
 * EW yellow + NS red, all-red}; a yellow phase lawfully shows one yellow
 * plus the opposite red (a literal reading — one green OR two reds — would
 * outlaw every yellow phase, which cannot be the intent).
 */
'use strict';

var eng = require('./engine.js');
var Engine = eng.Engine;
var Validate = eng.Validate;
var Programs = require('./programs.js').Programs;
var Faults = require('./faults.js').Faults;

var SCAN = 20; // ms per scan, per the task
var passed = 0, failed = 0;

function check(name, cond, detail) {
  if (cond) { passed++; console.log('PASS  ' + name); }
  else {
    failed++;
    console.log('FAIL  ' + name + (detail !== undefined && detail !== null ? '   [' + detail + ']' : ''));
  }
}
function section(title) { console.log('\n===== ' + title + ' ====='); }

/* ---------------------------------------------------------------------- */
/* Harness helpers                                                        */
/* ---------------------------------------------------------------------- */

function plcFor(idOrJson) {
  var json = typeof idOrJson === 'string' ? Programs.byId(idOrJson) : idOrJson;
  if (!json) throw new Error('no such program: ' + idOrJson);
  return new Engine.PLC(json, { scanMs: SCAN });
}

/**
 * Run n scans. perScan(k, plc), if given, runs BEFORE each scan with
 * k = plc.scanCount (absolute scan index about to execute) — use it to
 * drive physical inputs on a script. Returns an array of committed-output
 * snapshots, one per scan ("ticks").
 */
function run(plc, n, perScan) {
  var frames = [];
  for (var i = 0; i < n; i++) {
    if (perScan) perScan(plc.scanCount, plc);
    plc.scan();
    frames.push(Object.assign({}, plc.outputs()));
  }
  return frames;
}

/** Collapse a tag's value over frames into [{v, start, len}] segments. */
function segments(frames, tag) {
  var segs = [], cur = null;
  for (var i = 0; i < frames.length; i++) {
    var v = frames[i][tag] ? 1 : 0;
    if (!cur || cur.v !== v) { cur = { v: v, start: i, len: 1 }; segs.push(cur); }
    else cur.len++;
  }
  return segs;
}

/** Frame indices where tag goes 0 -> 1 (index 0 counts if already on). */
function risingEdges(frames, tag) {
  var out = [];
  for (var i = 0; i < frames.length; i++) {
    var v = frames[i][tag] ? 1 : 0;
    var p = i === 0 ? 0 : (frames[i - 1][tag] ? 1 : 0);
    if (v && !p) out.push(i);
  }
  return out;
}

var LAMPS = ['NS_GRN', 'NS_YEL', 'NS_RED', 'EW_GRN', 'EW_YEL', 'EW_RED'];
function lampTuple(f) { return LAMPS.map(function (t) { return f[t] ? 1 : 0; }).join(''); }
// Legal committed lamp states (see interpretation note in the header).
var LEGAL = { '100001': 1, '010001': 1, '001100': 1, '001010': 1, '001001': 1 };

function firstIllegal(frames) {
  for (var i = 0; i < frames.length; i++) {
    if (!LEGAL[lampTuple(frames[i])]) return 'tick ' + i + ' -> ' + lampTuple(frames[i]);
  }
  return null;
}

function phaseOf(f) {
  if (f.NS_GRN) return 'NSG';
  if (f.NS_YEL) return 'NSY';
  if (f.EW_GRN) return 'EWG';
  if (f.EW_YEL) return 'EWY';
  return 'RED';
}
function phaseSegments(frames) {
  var segs = [], cur = null;
  for (var i = 0; i < frames.length; i++) {
    var ph = phaseOf(frames[i]);
    if (!cur || cur.ph !== ph) { cur = { ph: ph, start: i, len: 1 }; segs.push(cur); }
    else cur.len++;
  }
  return segs;
}
function near(x, target, tol) { return Math.abs(x - target) <= tol; }

/* ====================================================================== */
section('Program catalog and static validation');
/* ====================================================================== */

check('7 built-in programs in menu order', Programs.list.length === 7 &&
  Programs.list.map(function (p) { return p.id; }).join(',') ===
  'stoplight_basic,stoplight_ped,stoplight_sensor,stoplight_night,motor_sealin,scan_order_demo_a,scan_order_demo_b');

check('byId returns the list entries; unknown id -> null',
  Programs.byId('motor_sealin') === Programs.list[4] && Programs.byId('nope') === null);

check('scan-order variants link each other via variantOf',
  Programs.byId('scan_order_demo_a').variantOf === 'scan_order_demo_b' &&
  Programs.byId('scan_order_demo_b').variantOf === 'scan_order_demo_a');

Programs.list.forEach(function (p) {
  var issues = Validate.check(p);
  check('validate ' + p.id + ': zero errors AND zero warnings', issues.length === 0,
    issues.map(function (i) { return i.level + ': ' + i.msg; }).join(' | '));
});

/* ====================================================================== */
section('stoplight_basic — phase sequence, invariants, SW_STOP');
/* ====================================================================== */

(function () {
  var plc = plcFor('stoplight_basic');
  var frames = run(plc, 10000); // 200 s ~= 9 cycles

  var conflict = -1;
  for (var i = 0; i < frames.length; i++) {
    if (frames[i].NS_GRN && frames[i].EW_GRN) { conflict = i; break; }
  }
  check('basic: INVARIANT never NS_GRN && EW_GRN across 10000 scans', conflict === -1, 'tick ' + conflict);
  check('basic: every tick is a legal lamp state (one green/yellow + opposite red, or all-red)',
    firstIllegal(frames) === null, firstIllegal(frames));

  var segs = phaseSegments(frames);
  var order = ['NSG', 'NSY', 'EWG', 'EWY'];
  var seqOk = segs[0].ph === 'NSG';
  for (var s = 0; s + 1 < segs.length; s++) {
    var want = order[(order.indexOf(segs[s].ph) + 1) % 4];
    if (segs[s + 1].ph !== want) { seqOk = false; break; }
  }
  check('basic: phase order is NSG -> NSY -> EWG -> EWY, repeating', seqOk,
    segs.slice(0, 8).map(function (x) { return x.ph; }).join('>'));

  var cycles = segs.filter(function (x) { return x.ph === 'NSG'; }).length;
  check('basic: at least 3 full cycles observed (' + cycles + ' NS greens)', cycles >= 4);

  var durOk = true, durBad = null;
  for (s = 0; s + 1 < segs.length; s++) { // last segment is truncated by the window
    var exp = (segs[s].ph === 'NSG' || segs[s].ph === 'EWG') ? 400 : 150;
    if (!near(segs[s].len, exp, 3)) { durOk = false; durBad = segs[s].ph + '@' + segs[s].start + ' len ' + segs[s].len + ' want ~' + exp; break; }
  }
  check('basic: greens last 8 s and yellows 3 s (+-3 scans), every phase', durOk, durBad);

  var redsOk = true, redsBad = null;
  for (i = 0; i < frames.length; i++) {
    var ph = phaseOf(frames[i]);
    if ((ph === 'NSG' || ph === 'NSY') && !(frames[i].EW_RED && !frames[i].NS_RED)) { redsOk = false; redsBad = i; break; }
    if ((ph === 'EWG' || ph === 'EWY') && !(frames[i].NS_RED && !frames[i].EW_RED)) { redsOk = false; redsBad = i; break; }
  }
  check('basic: opposite red is on (and own red off) through every phase', redsOk, 'tick ' + redsBad);
})();

(function () {
  var plc = plcFor('stoplight_basic');
  run(plc, 100); // 2 s into the first NS green
  plc.setPhysicalInput('SW_STOP', 1);
  var fStop = run(plc, 250); // 5 s of master stop
  var allRed = true, bad = null;
  for (var i = 0; i < fStop.length; i++) {
    if (lampTuple(fStop[i]) !== '001001') { allRed = false; bad = i + ':' + lampTuple(fStop[i]); break; }
  }
  check('basic: SW_STOP mid-green -> both reds only, greens/yellows off, from the very first scan', allRed, bad);

  plc.setPhysicalInput('SW_STOP', 0);
  var fRes = run(plc, 1200);
  check('basic: on release, NS green is back immediately (step stayed latched)', lampTuple(fRes[0]) === '100001', lampTuple(fRes[0]));
  check('basic: cycle resumes sanely — all states legal after release', firstIllegal(fRes) === null, firstIllegal(fRes));
  var ewg = risingEdges(fRes, 'EW_GRN');
  // The interrupted green restarts from zero (TON reset), so EW green ~11 s after release.
  check('basic: reaches EW green ~11 s after release (green restarts from zero)', ewg.length > 0 && near(ewg[0], 549, 5), ewg[0]);
})();

/* ====================================================================== */
section('stoplight_ped — request latching, grant-at-green-start, 4 s walk');
/* ====================================================================== */

(function () { // press mid-EW-green -> walk exactly when NS green next begins
  var plc = plcFor('stoplight_ped');
  var frames = run(plc, 3000, function (k, p) {
    if (k === 700) p.setPhysicalInput('PED_NS', 1);
    if (k === 703) p.setPhysicalInput('PED_NS', 0);
  });
  check('ped: test precondition — tick 700 is mid-EW-green', frames[700].EW_GRN === 1);
  var nsg = risingEdges(frames, 'NS_GRN').filter(function (i) { return i > 700; });
  var wns = risingEdges(frames, 'WALK_NS');
  check('ped: WALK_NS rises on EXACTLY the tick NS green next begins', wns.length >= 1 && nsg.length >= 1 && wns[0] === nsg[0],
    'walk@' + wns[0] + ' vs green@' + nsg[0]);
  var wseg = segments(frames, 'WALK_NS').filter(function (s) { return s.v === 1; })[0];
  check('ped: WALK_NS stays on 4 s (+-3 scans) then goes off', wseg && near(wseg.len, 200, 3), wseg && wseg.len);
  check('ped: request was consumed — no second walk without a second press', wns.length === 1, wns.join(','));
})();

(function () { // press DURING NS green -> deferred to the FOLLOWING NS green
  var plc = plcFor('stoplight_ped');
  var frames = run(plc, 2500, function (k, p) {
    if (k === 100) p.setPhysicalInput('PED_NS', 1);
    if (k === 103) p.setPhysicalInput('PED_NS', 0);
  });
  check('ped: test precondition — tick 100 is mid-NS-green', frames[100].NS_GRN === 1);
  var wns = risingEdges(frames, 'WALK_NS');
  // First re-begin of NS green (~tick 1096). risingEdges counts tick 0 as an
  // edge (the power-up green), so look for the first edge AFTER the press.
  var nsg2 = risingEdges(frames, 'NS_GRN').filter(function (i) { return i > 100; })[0];
  check('ped: press during NS green does NOT light WALK_NS in that green', wns.length === 0 || wns[0] >= nsg2, 'walk@' + wns[0]);
  check('ped: ...but DOES light it at the FOLLOWING NS green start', wns.length === 1 && wns[0] === nsg2,
    'walk@' + wns[0] + ' vs next green@' + nsg2);
})();

(function () { // mirror: PED_EW / WALK_EW
  var plc = plcFor('stoplight_ped');
  var frames = run(plc, 3000, function (k, p) {
    if (k === 100) p.setPhysicalInput('PED_EW', 1); // pressed mid-NS-green
    if (k === 103) p.setPhysicalInput('PED_EW', 0);
  });
  var ewg = risingEdges(frames, 'EW_GRN');
  var wew = risingEdges(frames, 'WALK_EW');
  check('ped(EW): WALK_EW rises on EXACTLY the tick EW green begins', wew.length >= 1 && wew[0] === ewg[0],
    'walk@' + wew[0] + ' vs green@' + ewg[0]);
  var wseg = segments(frames, 'WALK_EW').filter(function (s) { return s.v === 1; })[0];
  check('ped(EW): WALK_EW stays on 4 s (+-3 scans)', wseg && near(wseg.len, 200, 3), wseg && wseg.len);

  var plc2 = plcFor('stoplight_ped');
  var f2 = run(plc2, 3200, function (k, p) {
    if (k === 700) p.setPhysicalInput('PED_EW', 1); // pressed DURING EW green
    if (k === 703) p.setPhysicalInput('PED_EW', 0);
  });
  check('ped(EW): test precondition — tick 700 is mid-EW-green', f2[700].EW_GRN === 1);
  var wew2 = risingEdges(f2, 'WALK_EW');
  var ewg2 = risingEdges(f2, 'EW_GRN').filter(function (i) { return i > 700; })[0]; // following EW green (~1644)
  check('ped(EW): press during EW green is deferred to the FOLLOWING EW green', wew2.length === 1 && wew2[0] === ewg2,
    'walk@' + wew2[0] + ' vs next green@' + ewg2);
})();

(function () { // safety invariants under sustained button mashing
  var plc = plcFor('stoplight_ped');
  var frames = run(plc, 12000, function (k, p) {
    p.setPhysicalInput('PED_NS', (k % 731) < 3 ? 1 : 0);
    p.setPhysicalInput('PED_EW', (k % 977) < 3 ? 1 : 0);
  });
  var bad = null;
  for (var i = 0; i < frames.length; i++) {
    if (frames[i].WALK_NS && !frames[i].NS_GRN) { bad = 'WALK_NS outside NS green @' + i; break; }
    if (frames[i].WALK_EW && !frames[i].EW_GRN) { bad = 'WALK_EW outside EW green @' + i; break; }
  }
  check('ped: WALK_NS never outside NS green, WALK_EW never outside EW green (12000 scans, buttons mashed)', bad === null, bad);
  check('ped: lamp invariants hold throughout', firstIllegal(frames) === null, firstIllegal(frames));
})();

/* ====================================================================== */
section('stoplight_sensor — rest state, demand, minimum green');
/* ====================================================================== */

(function () {
  var plc = plcFor('stoplight_sensor');
  var frames = run(plc, 5000); // 100 s, LOOP_EW never true
  var solid = true, badTick = null;
  for (var i = 0; i < frames.length; i++) {
    if (!frames[i].NS_GRN || frames[i].EW_GRN) { solid = false; badTick = i; break; }
  }
  check('sensor: with no car ever, NS green rests solid for 100 s (EW never green)', solid, 'tick ' + badTick);
})();

(function () { // demand long after minimum green
  var plc = plcFor('stoplight_sensor');
  var frames = run(plc, 2200, function (k, p) {
    if (k === 1000) p.setPhysicalInput('LOOP_EW', 1); // car arrives at t=20 s
    if (k === 1200) p.setPhysicalInput('LOOP_EW', 0); // car leaves once served
  });
  var nsy = risingEdges(frames, 'NS_YEL');
  var ewg = risingEdges(frames, 'EW_GRN');
  check('sensor: car (after min green served) -> NS yellow immediately', nsy.length >= 1 && near(nsy[0], 1000, 2), nsy[0]);
  var nsySeg = segments(frames, 'NS_YEL').filter(function (s) { return s.v === 1; })[0];
  check('sensor: EW green begins right after the 3 s NS yellow', ewg.length >= 1 && nsySeg &&
    ewg[0] === nsySeg.start + nsySeg.len && near(nsySeg.len, 150, 3),
    'ewg@' + ewg[0] + ' yellow ' + (nsySeg && (nsySeg.start + '+' + nsySeg.len)));
  var ewgSeg = segments(frames, 'EW_GRN').filter(function (s) { return s.v === 1; })[0];
  check('sensor: EW green lasts the fixed 8 s (+-3 scans)', ewgSeg && near(ewgSeg.len, 400, 3), ewgSeg && ewgSeg.len);
  check('sensor: returns to the NS-green rest and stays (car gone)',
    frames[2199].NS_GRN === 1 && risingEdges(frames, 'EW_GRN').length === 1);
  check('sensor: lamp invariants hold throughout', firstIllegal(frames) === null, firstIllegal(frames));
})();

(function () { // minimum green respected
  var plc = plcFor('stoplight_sensor');
  var frames = run(plc, 800, function (k, p) {
    if (k === 50) p.setPhysicalInput('LOOP_EW', 1); // car arrives 1 s into the green
  });
  var nsy = risingEdges(frames, 'NS_YEL');
  check('sensor: car during first 4 s -> NO yellow before minimum green has elapsed', nsy.length >= 1 && nsy[0] >= 196, nsy[0]);
  check('sensor: ...and yellow comes exactly when minimum green completes (~4 s, +-3 scans)', nsy.length >= 1 && near(nsy[0], 199, 3), nsy[0]);
})();

/* ====================================================================== */
section('stoplight_night — 0.5 s flasher at night, clean return to day');
/* ====================================================================== */

(function () {
  var plc = plcFor('stoplight_night');
  var fDay = run(plc, 100);
  check('night: daytime cycling is normal before the switch', firstIllegal(fDay) === null && fDay[50].NS_GRN === 1, firstIllegal(fDay));

  plc.setPhysicalInput('SW_NIGHT', 1);
  var fN = run(plc, 500); // 10 s of night

  var others = ['NS_GRN', 'NS_RED', 'EW_GRN', 'EW_YEL', 'WALK_NS', 'WALK_EW'];
  var dark = true, darkBad = null;
  var together = true;
  for (var i = 0; i < fN.length; i++) {
    for (var j = 0; j < others.length; j++) {
      if (fN[i][others[j]]) { dark = false; darkBad = others[j] + '@' + i; }
    }
    if ((fN[i].NS_YEL ? 1 : 0) !== (fN[i].EW_RED ? 1 : 0)) together = false;
    if (!dark) break;
  }
  check('night: at night every lamp except NS_YEL/EW_RED is dark for the whole 10 s', dark, darkBad);
  check('night: NS_YEL and EW_RED flash in unison (identical every scan)', together);

  var rises = risingEdges(fN, 'NS_YEL');
  check('night: at least 8 full flash periods in 10 s', rises.length >= 8, rises.length);
  var periodsOk = true, pBad = null;
  for (i = 0; i + 1 < rises.length; i++) {
    var per = rises[i + 1] - rises[i]; // nominal 51 scans = 1.02 s (25 timing + 26 hold + reset)
    if (per < 48 || per > 54) { periodsOk = false; pBad = per; break; }
  }
  check('night: flash period is ~1 s (0.5 s on / 0.5 s off, +-60 ms)', periodsOk, pBad);
  var widthsOk = true, wBad = null;
  var segs = segments(fN, 'NS_YEL');
  for (i = 1; i + 1 < segs.length; i++) { // interior segments only (window edges are partial)
    var want = segs[i].v ? 26 : 25;
    if (!near(segs[i].len, want, 3)) { widthsOk = false; wBad = (segs[i].v ? 'on' : 'off') + ' ' + segs[i].len; break; }
  }
  check('night: on-width and off-width are each ~0.5 s (+-60 ms)', widthsOk, wBad);

  plc.setPhysicalInput('SW_NIGHT', 0);
  var fD2 = run(plc, 1500);
  check('night: day cycling resumes cleanly after the switch (legal states from the first scan)',
    firstIllegal(fD2) === null, firstIllegal(fD2));
  check('night: resumed cycle reaches EW green within 30 s', risingEdges(fD2, 'EW_GRN').length >= 1);
  check('night: flasher is fully off by day', fD2.every(function (f, idx) { return idx < 1 || !f.NS_YEL || phaseOf(f) === 'NSY'; }));
})();

/* ====================================================================== */
section('motor_sealin — seal-in latch behavior');
/* ====================================================================== */

(function () {
  var plc = plcFor('motor_sealin');
  var idle = run(plc, 5);
  check('motor: off at rest', idle.every(function (f) { return !f.MOTOR; }));

  plc.setPhysicalInput('PB_START', 1);
  var fa = run(plc, 2);
  plc.setPhysicalInput('PB_START', 0);
  check('motor: energizes on the scan START is read', fa[0].MOTOR === 1);

  var fb = run(plc, 100);
  check('motor: seal-in holds for 2 s after START released', fb.every(function (f) { return f.MOTOR === 1; }));

  plc.setPhysicalInput('PB_STOP', 1);
  var fc = run(plc, 2);
  plc.setPhysicalInput('PB_STOP', 0);
  check('motor: STOP drops it on the scan STOP is read', fc[0].MOTOR === 0);

  var fd = run(plc, 50);
  check('motor: stays off after STOP released (seal is broken)', fd.every(function (f) { return !f.MOTOR; }));

  plc.setPhysicalInput('PB_START', 1); run(plc, 2); plc.setPhysicalInput('PB_START', 0); run(plc, 5);
  check('motor: start counter counted both starts (CTU edge-triggered)',
    plc.counters.C_STARTS && plc.counters.C_STARTS.ACC === 2, plc.counters.C_STARTS && plc.counters.C_STARTS.ACC);
})();

/* ====================================================================== */
section('scan_order demos — one-scan lag in A, same-scan in B');
/* ====================================================================== */

(function () {
  var a = plcFor('scan_order_demo_a');
  a.setPhysicalInput('PB_START', 1);
  a.scan();
  check('demo A: after scan 1, B_SRC is on but B_ECHO still off (echo rung read last scan\'s value)',
    a.bits.B_SRC === 1 && a.bits.B_ECHO === 0, 'SRC=' + a.bits.B_SRC + ' ECHO=' + a.bits.B_ECHO);
  a.scan();
  check('demo A: after scan 2, B_ECHO has caught up — exactly one scan of lag', a.bits.B_ECHO === 1);
  a.setPhysicalInput('PB_START', 0);
  a.scan();
  check('demo A: same one-scan lag on the way off', a.bits.B_SRC === 0 && a.bits.B_ECHO === 1);
  a.scan();
  check('demo A: echo off one scan later', a.bits.B_ECHO === 0);

  var b = plcFor('scan_order_demo_b');
  b.setPhysicalInput('PB_START', 1);
  b.scan();
  check('demo B: after scan 1, B_SRC AND B_ECHO are both on — same-scan propagation',
    b.bits.B_SRC === 1 && b.bits.B_ECHO === 1, 'SRC=' + b.bits.B_SRC + ' ECHO=' + b.bits.B_ECHO);
  b.setPhysicalInput('PB_START', 0);
  b.scan();
  check('demo B: both drop together on release', b.bits.B_SRC === 0 && b.bits.B_ECHO === 0);
})();

/* ====================================================================== */
section('Fault library — hygiene common to every fault');
/* ====================================================================== */

check('faults: at least 10 faults defined', Faults.list.length >= 10, Faults.list.length);

var REQUIRED_FAULTS = [
  'motor_missing_sealin', 'ped_button_swapped', 'basic_yellow_preset',
  'basic_double_coil', 'basic_no_interlock_overlap', 'basic_rung_order',
  'sensor_loop_inverted', 'ped_walk_latched', 'night_flash_solid', 'motor_stop_swapped'
];
check('faults: the spec\'s required coverage set is present',
  REQUIRED_FAULTS.every(function (id) { return !!Faults.byId(id); }),
  REQUIRED_FAULTS.filter(function (id) { return !Faults.byId(id); }).join(','));

check('faults: initPanel is exported for the app', typeof Faults.initPanel === 'function');

Faults.list.forEach(function (f) {
  var pristine = Programs.byId(f.programId);
  var before = JSON.stringify(pristine);
  var patched = Faults.applyById(f.id);
  var after = JSON.stringify(Programs.byId(f.programId));

  check(f.id + ': pristine program is byte-identical after apply', before === after);
  check(f.id + ': patch actually changes the ladder',
    JSON.stringify(patched.rungs) !== JSON.stringify(pristine.rungs));
  var errs = Validate.check(patched).filter(function (i) { return i.level === 'error'; });
  check(f.id + ': patched program validates with zero ERRORS', errs.length === 0,
    errs.map(function (e) { return e.msg; }).join(' | '));
  check(f.id + ': faultRungs recorded with valid indexes',
    Array.isArray(patched.faultRungs) && patched.faultRungs.length > 0 &&
    patched.faultRungs.every(function (r) { return r >= 0 && r < patched.rungs.length && r === Math.floor(r); }));
  var ids = Faults.faultElemIds(patched);
  check(f.id + ': highlight element ids resolvable from faultRungs', ids.length > 0 &&
    ids.every(function (x) { return typeof x === 'string' && /^r\d+\./.test(x); }));
  check(f.id + ': metadata complete (title, symptom, explanation, difficulty 1-3)',
    !!f.title && !!f.symptom && !!f.explanation && f.difficulty >= 1 && f.difficulty <= 3);
});

check('basic_double_coil: the duplicate-coil WARNING fires (that is the teaching hint)',
  Validate.check(Faults.applyById('basic_double_coil')).some(function (i) {
    return i.level === 'warn' && i.msg.indexOf('NS_YEL') >= 0;
  }));

/* ====================================================================== */
section('Fault library — every documented symptom actually manifests');
/* ====================================================================== */

(function () { // motor_missing_sealin
  var plc = plcFor(Faults.applyById('motor_missing_sealin'));
  var frames = run(plc, 60, function (k, p) {
    if (k === 5) p.setPhysicalInput('PB_START', 1);
    if (k === 10) p.setPhysicalInput('PB_START', 0);
  });
  var heldOn = frames.slice(5, 10).every(function (f) { return f.MOTOR === 1; });
  var dropped = frames.slice(11, 60).every(function (f) { return f.MOTOR === 0; });
  check('motor_missing_sealin: runs only while START held, drops on release', heldOn && dropped);
})();

(function () { // motor_stop_swapped
  var plc = plcFor(Faults.applyById('motor_stop_swapped'));
  var frames = run(plc, 60, function (k, p) {
    if (k === 5) p.setPhysicalInput('PB_START', 1);
    if (k === 10) p.setPhysicalInput('PB_START', 0);
  });
  check('motor_stop_swapped: START alone can never start the motor', frames.every(function (f) { return !f.MOTOR; }));
  var frames2 = run(plc, 20, function (k, p) {
    p.setPhysicalInput('PB_STOP', 1); // stop held down...
    p.setPhysicalInput('PB_START', 1); // ...and start pressed
  });
  check('motor_stop_swapped: ...but it runs while STOP is held (contact sense inverted)',
    frames2[frames2.length - 1].MOTOR === 1);
})();

(function () { // basic_yellow_preset
  var frames = run(plcFor(Faults.applyById('basic_yellow_preset')), 700);
  var seg = segments(frames, 'NS_YEL').filter(function (s) { return s.v === 1; })[0];
  check('basic_yellow_preset: NS yellow phase lasts ~0.3 s instead of 3 s', seg && near(seg.len, 15, 3), seg && seg.len);
})();

(function () { // basic_double_coil
  var frames = run(plcFor(Faults.applyById('basic_double_coil')), 2000);
  check('basic_double_coil: NS_YEL never lights across 2 full cycles (last write wins)',
    frames.every(function (f) { return !f.NS_YEL; }));
  var darkTicks = frames.filter(function (f) { return !f.NS_GRN && !f.NS_YEL && !f.NS_RED; }).length;
  check('basic_double_coil: the NS head goes fully dark for the yellow phases (~150 ticks/cycle)', darkTicks >= 250, darkTicks);
})();

(function () { // basic_no_interlock_overlap
  var frames = run(plcFor(Faults.applyById('basic_no_interlock_overlap')), 3000);
  var conflictAt = -1;
  for (var i = 0; i < frames.length; i++) {
    if (frames[i].NS_GRN && frames[i].EW_GRN) { conflictAt = i; break; }
  }
  check('basic_no_interlock_overlap: BOTH greens actually show within 60 s', conflictAt >= 0 && conflictAt < 3000, 'tick ' + conflictAt);
})();

(function () { // basic_rung_order — demonstrate the one-scan delay vs pristine
  var pf = run(plcFor('stoplight_basic'), 600);
  var ff = run(plcFor(Faults.applyById('basic_rung_order')), 600);
  var pRise = risingEdges(pf, 'NS_YEL')[0];
  var fRise = risingEdges(ff, 'NS_YEL')[0];
  check('basic_rung_order: first NS_GRN->NS_YEL transition happens exactly ONE scan later than pristine',
    pRise !== undefined && fRise === pRise + 1, 'pristine@' + pRise + ' faulty@' + fRise);
})();

(function () { // basic_swstop_inverted
  var frames = run(plcFor(Faults.applyById('basic_swstop_inverted')), 3000);
  check('basic_swstop_inverted: stuck in NS green forever with the master stop off (60 s)',
    frames.every(function (f) { return f.NS_GRN && !f.EW_GRN; }));
})();

(function () { // ped_button_swapped
  var frames = run(plcFor(Faults.applyById('ped_button_swapped')), 300); // nobody presses anything
  var w = risingEdges(frames, 'WALK_NS');
  check('ped_button_swapped: WALK_NS is granted with no press at all (phantom request)', w.length >= 1 && w[0] < 10, w[0]);
})();

(function () { // ped_walk_latched
  var frames = run(plcFor(Faults.applyById('ped_walk_latched')), 1800, function (k, p) {
    if (k === 700) p.setPhysicalInput('PED_NS', 1);
    if (k === 703) p.setPhysicalInput('PED_NS', 0);
  });
  var bad = -1;
  for (var i = 0; i < frames.length; i++) {
    if (frames[i].WALK_NS && frames[i].EW_GRN) { bad = i; break; }
  }
  check('ped_walk_latched: WALK_NS survives into the EW green (the hazard the timer prevents)', bad >= 0, 'tick ' + bad);
})();

(function () { // sensor_loop_inverted — both facets
  var f1 = run(plcFor(Faults.applyById('sensor_loop_inverted')), 1000); // no car anywhere
  check('sensor_loop_inverted: EW gets a green with NO car waiting', risingEdges(f1, 'EW_GRN').length >= 1);

  var plc2 = plcFor(Faults.applyById('sensor_loop_inverted'));
  plc2.setPhysicalInput('LOOP_EW', 1); // car parks on the loop from the start
  var f2 = run(plc2, 1500);
  check('sensor_loop_inverted: a car sitting on the loop waits forever (30 s and counting)',
    f2.every(function (f) { return f.NS_GRN && !f.EW_GRN; }));
})();

(function () { // night_flash_solid
  var plc = plcFor(Faults.applyById('night_flash_solid'));
  plc.setPhysicalInput('SW_NIGHT', 1);
  var frames = run(plc, 500); // 10 s of night
  var window = frames.slice(100); // skip the settling scans
  var onCount = window.filter(function (f) { return f.NS_YEL === 1; }).length;
  var duty = onCount / window.length;
  var maxOff = 0, curOff = 0;
  window.forEach(function (f) {
    if (!f.NS_YEL) { curOff++; if (curOff > maxOff) maxOff = curOff; }
    else curOff = 0;
  });
  check('night_flash_solid: the "flasher" burns essentially solid (duty >= 90%, pristine is ~51%)', duty >= 0.9, duty.toFixed(3));
  check('night_flash_solid: never dark for more than 2 scans (pristine goes dark for ~25)', maxOff <= 2, maxOff);
})();

/* ====================================================================== */
console.log('\n----');
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
