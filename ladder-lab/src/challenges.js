/*
 * Ladder Lab — src/challenges.js
 * window.LL.Challenges — 4 guided challenges with deterministic auto-graders.
 *
 * Public API (module contract, SPEC.md "Challenges"):
 *   LL.Challenges.list
 *       [{id, title, spec, hints:[..], requiredTags:[..], starter|null}]
 *   LL.Challenges.grade(challengeId, programJson)
 *       -> {pass, steps:[{desc, pass, detail}]}     (pure, deterministic)
 *   LL.Challenges.initPanel(containerEl, ctx)       challenge UI panel
 *   LL.Challenges.init(containerEl, ctx)            alias (SPEC init contract)
 *
 * Grading model:
 *   Fresh PLC(program, {scanMs:20}) per grade() call. Scripted physical
 *   inputs by scan count (momentary buttons use plc.pulseInput — a 1-scan
 *   press, the harshest legal "even briefly"). Timed edges get ±3 scans
 *   (±0.06 s) of tolerance; safety invariants ("never both greens",
 *   "WALK never with EW green") are strict every-scan checks. All grading
 *   is on BEHAVIOR at the committed outputs, so any wiring that meets the
 *   handout passes — with one exception the handout itself states:
 *   challenge 1 also performs a structural wiring check (real seal-in
 *   branch + OTE, no OTL/OTU on MOTOR).
 *
 * Documented decisions (spec: "if unspecified, choose sensibly and document"):
 *  - grade() front-runs two friendly gates before behavior steps: an
 *    empty-program check and an LL.Validate error gate (warnings do not
 *    block). Both fail fast with one plain-English step.
 *  - After the first failing step the remaining steps are reported with
 *    pass:false, skipped:true and a "Not checked" detail — the scripted
 *    timeline past a failure is unreliable, and cascading red herrings
 *    would bury the real problem. The UI renders skipped steps dimmed.
 *  - Challenge 1's structural check runs LAST, after all behavior steps:
 *    a missing seal-in then fails at the *latch* step (the behavior the
 *    branch exists to produce), while an OTL-based program that behaves
 *    correctly is caught by the final wiring check.
 *  - Challenge 3/4 phase grading is implementation- and phase-agnostic:
 *    intervals are measured off the output trace (duration + adjacency of
 *    phase edges), never against absolute scan numbers, so a sequencer
 *    that loses a scan per phase handoff (299/99/299/99) or starts its
 *    cycle late still passes. Invariants with transition sensitivity
 *    (opposing red, WALK-only-during-green) tolerate violations up to 3
 *    consecutive scans; green-vs-green and WALK-vs-EW-green are strict.
 *  - Challenge 4 includes a "request is consumed" step (one walk per
 *    press): implied by "WALK_NS turns on only at the START of the next
 *    NS green" and by the built-in ped program's OTU REQ semantics; the
 *    student handout states it explicitly.
 *  - "Load starter" emits bus 'challenge:starter' {program} for app.js to
 *    route; when no bus is wired (dev harness) it falls back to calling
 *    LL.Editor.loadChallengeStarter directly.
 *  - Per-challenge status (attempted/passed) is session memory only, per
 *    the no-localStorage rule.
 */
(function () {
  'use strict';

  var IS_NODE = (typeof window === 'undefined');
  var LL;
  if (IS_NODE) {
    LL = require('./engine.js'); // engine exports the shared LL namespace
  } else {
    window.LL = window.LL || {};
    LL = window.LL;
  }

  var SCAN_MS = 20;      // grading scan period (SPEC: fresh PLC at scanMs=20)
  var TOL = 3;           // ± scans of tolerance on timed edges (0.06 s)
  var TOL_S = '0.06';    // the same tolerance, for prose

  function deepClone(o) {
    if (LL.Util && LL.Util.deepClone) return LL.Util.deepClone(o);
    return JSON.parse(JSON.stringify(o));
  }

  /* =====================================================================
   * Prose helpers — every timing message carries seconds AND scan numbers
   * ===================================================================== */

  function secs(scans) { return (scans * SCAN_MS / 1000).toFixed(2); }
  function at(scan) { return 'scan ' + scan + ' (t = ' + secs(scan) + ' s)'; }

  /* =====================================================================
   * Harness — one fresh PLC per grade() call + a committed-output trace
   * ===================================================================== */

  function snapOutputs(plc) {
    var out = plc.outputs();
    var s = {};
    for (var k in out) if (Object.prototype.hasOwnProperty.call(out, k)) s[k] = out[k] ? 1 : 0;
    return s;
  }

  function Harness(programJson) {
    this.plc = new LL.Engine.PLC(deepClone(programJson), { scanMs: SCAN_MS });
    // trace[i] = committed outputs after the scan with scanCount === i.
    // Index 0 is the pre-scan state (all outputs 0).
    this.trace = [snapOutputs(this.plc)];
    this.mem = {}; // measurements shared between a challenge's steps
  }
  Harness.prototype.now = function () { return this.plc.scanCount; };
  Harness.prototype.out = function (tag) { return this.plc.outputs()[tag] ? 1 : 0; };
  Harness.prototype.press = function (tag) { this.plc.pulseInput(tag); };
  Harness.prototype.hold = function (tag, v) { this.plc.setPhysicalInput(tag, v); };
  Harness.prototype.step = function (n) {
    for (var i = 0; i < n; i++) {
      this.plc.scan();
      this.trace.push(snapOutputs(this.plc));
    }
    return this.plc.scanCount;
  };
  /** Run scans until pred(outputs, scanCount) is true. Returns the scanCount
   *  of the first true scan, or -1 after maxScans without a hit. */
  Harness.prototype.stepUntil = function (pred, maxScans) {
    for (var i = 0; i < maxScans; i++) {
      this.plc.scan();
      this.trace.push(snapOutputs(this.plc));
      if (pred(this.plc.outputs(), this.plc.scanCount)) return this.plc.scanCount;
    }
    return -1;
  };

  /* ---------- trace analysis ---------- */

  /** First scan in [from..to] where fn(snapshot) is truthy, else -1. */
  function firstWhere(trace, from, to, fn) {
    var lo = Math.max(1, from), hi = Math.min(trace.length - 1, to);
    for (var i = lo; i <= hi; i++) if (fn(trace[i])) return i;
    return -1;
  }
  function firstOn(trace, from, to, tag) {
    return firstWhere(trace, from, to, function (s) { return s[tag]; });
  }

  /** Maximal ON-intervals of a tag: [{start, end, complete}], scan-indexed.
   *  complete=false only for an interval still ON at the end of the trace. */
  function intervalsOf(trace, tag) {
    var iv = [], cur = null;
    for (var i = 1; i < trace.length; i++) {
      if (trace[i][tag]) {
        if (!cur) { cur = { start: i, end: i, complete: false }; iv.push(cur); }
        else cur.end = i;
      } else if (cur) {
        cur.complete = true;
        cur = null;
      }
    }
    return iv;
  }
  function completeOf(list) {
    return list.filter(function (v) { return v.complete; });
  }
  /** An interval in list starting within ±tol of scan, or null. */
  function startNear(list, scan, tol) {
    for (var i = 0; i < list.length; i++) {
      if (Math.abs(list[i].start - scan) <= tol) return list[i];
    }
    return null;
  }
  /** First scan of the first violation run LONGER than maxRun consecutive
   *  scans of badFn(snapshot) in [from..to], else -1. */
  function longViolation(trace, from, to, badFn, maxRun) {
    var run = 0;
    var lo = Math.max(1, from), hi = Math.min(trace.length - 1, to);
    for (var i = lo; i <= hi; i++) {
      if (badFn(trace[i])) {
        run++;
        if (run > maxRun) return i - run + 1;
      } else run = 0;
    }
    return -1;
  }

  /* ---------- program structure helpers ---------- */

  /** Visit every element; fn(el, inBranch). Never mutates. */
  function walkElements(program, fn) {
    var rungs = (program && Array.isArray(program.rungs)) ? program.rungs : [];
    rungs.forEach(function (rung) {
      var items = (rung && Array.isArray(rung.items)) ? rung.items : [];
      items.forEach(function (el) {
        if (!el) return;
        fn(el, false);
        if (el.t === 'BR' && Array.isArray(el.paths)) {
          el.paths.forEach(function (path) {
            (Array.isArray(path) ? path : []).forEach(function (pel) {
              if (pel) fn(pel, true);
            });
          });
        }
      });
    });
  }
  /** Set of base tags the program touches (member refs count their base). */
  function tagsUsed(program) {
    var set = {};
    walkElements(program, function (el) {
      if (typeof el.tag === 'string' && el.tag) set[el.tag.split('.')[0]] = true;
    });
    return set;
  }
  function programIsEmpty(program) {
    if (!program || !Array.isArray(program.rungs) || program.rungs.length === 0) return true;
    for (var r = 0; r < program.rungs.length; r++) {
      var rung = program.rungs[r];
      if (rung && Array.isArray(rung.items) && rung.items.length > 0) return false;
    }
    return true;
  }

  /* =====================================================================
   * Challenge 4 starter — a correct basic stoplight (also challenge 3's
   * canonical shape: 6 s greens, 2 s yellows, cross-interlocked outputs).
   * Uses B1..B4 / T1..T4 and leaves B5..B12, T5..T8 free for the student.
   * ===================================================================== */

  var STOPLIGHT_STARTER = {
    id: 'ch4_starter_stoplight',
    name: 'Challenge 4 Starter — Working Stoplight',
    description: 'A correct 6/2/6/2 stoplight sequencer. Add your crosswalk rungs to it.',
    notes: 'Step bits: B1 = NS green, B2 = NS yellow, B3 = EW green, B4 = EW yellow. ' +
      'Timers T1..T4 time the four phases. Free for your crosswalk logic: B5..B12 and T5..T8. ' +
      'Leave the light timing alone — challenge 4 grades against this exact 6/2/6/2 cycle.',
    usesMotor: false,
    rungs: [
      { comment: 'Power-up: no step active yet, so latch step 1 (NS green)',
        items: [{ t: 'XIO', tag: 'B1' }, { t: 'XIO', tag: 'B2' }, { t: 'XIO', tag: 'B3' },
                { t: 'XIO', tag: 'B4' }, { t: 'OTL', tag: 'B1' }] },
      { comment: 'NS green phase runs 6.0 s',
        items: [{ t: 'XIC', tag: 'B1' }, { t: 'TON', tag: 'T1', pre: 6000 }] },
      { comment: 'NS green done -> NS yellow',
        items: [{ t: 'XIC', tag: 'T1.DN' }, { t: 'OTL', tag: 'B2' }, { t: 'OTU', tag: 'B1' }] },
      { comment: 'NS yellow phase runs 2.0 s',
        items: [{ t: 'XIC', tag: 'B2' }, { t: 'TON', tag: 'T2', pre: 2000 }] },
      { comment: 'NS yellow done -> EW green',
        items: [{ t: 'XIC', tag: 'T2.DN' }, { t: 'OTL', tag: 'B3' }, { t: 'OTU', tag: 'B2' }] },
      { comment: 'EW green phase runs 6.0 s',
        items: [{ t: 'XIC', tag: 'B3' }, { t: 'TON', tag: 'T3', pre: 6000 }] },
      { comment: 'EW green done -> EW yellow',
        items: [{ t: 'XIC', tag: 'T3.DN' }, { t: 'OTL', tag: 'B4' }, { t: 'OTU', tag: 'B3' }] },
      { comment: 'EW yellow phase runs 2.0 s',
        items: [{ t: 'XIC', tag: 'B4' }, { t: 'TON', tag: 'T4', pre: 2000 }] },
      { comment: 'EW yellow done -> wrap back to NS green',
        items: [{ t: 'XIC', tag: 'T4.DN' }, { t: 'OTL', tag: 'B1' }, { t: 'OTU', tag: 'B4' }] },
      { comment: 'NS green lamp (cross-interlocked against the EW green)',
        items: [{ t: 'XIC', tag: 'B1' }, { t: 'XIO', tag: 'EW_GRN' }, { t: 'OTE', tag: 'NS_GRN' }] },
      { comment: 'NS yellow lamp',
        items: [{ t: 'XIC', tag: 'B2' }, { t: 'OTE', tag: 'NS_YEL' }] },
      { comment: 'EW green lamp (cross-interlocked against the NS green)',
        items: [{ t: 'XIC', tag: 'B3' }, { t: 'XIO', tag: 'NS_GRN' }, { t: 'OTE', tag: 'EW_GRN' }] },
      { comment: 'EW yellow lamp',
        items: [{ t: 'XIC', tag: 'B4' }, { t: 'OTE', tag: 'EW_YEL' }] },
      { comment: 'NS red while the EW direction has the road',
        items: [{ t: 'BR', paths: [[{ t: 'XIC', tag: 'B3' }], [{ t: 'XIC', tag: 'B4' }]] },
                { t: 'OTE', tag: 'NS_RED' }] },
      { comment: 'EW red while the NS direction has the road',
        items: [{ t: 'BR', paths: [[{ t: 'XIC', tag: 'B1' }], [{ t: 'XIC', tag: 'B2' }]] },
                { t: 'OTE', tag: 'EW_RED' }] }
    ]
  };

  /* =====================================================================
   * The four challenges — student-facing text
   * ===================================================================== */

  var CHALLENGES = [
    {
      id: 'sealin',
      title: '1 — Motor Seal-In',
      requiredTags: ['PB_START', 'PB_STOP', 'MOTOR'],
      starter: null,
      spec:
        'Wire the classic three-wire motor start/stop circuit.\n\n' +
        'Use PB_START, PB_STOP and MOTOR. Pressing START (even briefly) must turn the motor ON ' +
        'and keep it ON after release. Pressing PB_STOP turns it OFF, and it stays off until ' +
        'START is pressed again. At power-up the motor must be OFF.\n\n' +
        'Build the memory the way a real motor starter does it — with a SEAL-IN: drive MOTOR ' +
        'with an OTE coil, and hold the rung in with a parallel branch containing a MOTOR ' +
        'contact alongside the START contact. Use OTE, not a latch: OTL/OTU on MOTOR are not ' +
        'allowed here, and the grader checks the wiring for the real seal-in branch. ' +
        'Classic stop logic uses an XIO for PB_STOP, so the rung fails safe.',
      hints: [
        'A bare XIC PB_START -> OTE MOTOR only runs while your finger is on the button. ' +
        'Some contact that is ON exactly while the motor runs has to take over holding the ' +
        'rung true. Which tag is ON exactly while the motor runs?',
        'Put a branch (parallel paths) at the left of the rung: path 1 is XIC PB_START, ' +
        'path 2 is XIC MOTOR. Once the motor is on, its own contact feeds the coil — it ' +
        '"seals in".',
        'The whole thing is one rung: [ branch: XIC PB_START / XIC MOTOR ] -> XIO PB_STOP ' +
        '-> OTE MOTOR. The XIO breaks the seal the instant STOP is pressed.'
      ]
    },
    {
      id: 'delayed',
      title: '2 — Delayed Motor Start',
      requiredTags: ['PB_START', 'PB_STOP', 'MOTOR'],
      starter: null,
      spec:
        'Use PB_START, PB_STOP, MOTOR, one internal memory bit (B1..B12) and one timer (T1..T8).\n\n' +
        'Pressing START (even briefly) arms the system: a memory bit sets immediately and stays ' +
        'set after the button is released. Exactly 3.0 seconds later MOTOR turns ON (use a TON ' +
        'with a 3000 ms preset) and keeps running. Pressing PB_STOP at ANY time — during the ' +
        '3-second delay or while the motor is running — cancels everything: the motor goes ' +
        '(or stays) off and nothing restarts on its own. At power-up the motor must be OFF.\n\n' +
        'Grading is on behavior: the delay is measured from the START press and must be ' +
        '3.0 s within ± 0.06 s.',
      hints: [
        'Two problems in one: REMEMBER the button press (challenge 1’s seal-in, but on a ' +
        'memory bit like B1 instead of the motor), and DELAY the motor (a TON driven by that bit).',
        'Rung 1: seal in B1 from PB_START, broken by XIO PB_STOP. Rung 2: XIC B1 -> TON T1 ' +
        '(preset 3000). When B1 drops, the TON resets itself to zero — that is your cancel.',
        'Rung 3: XIC T1.DN -> OTE MOTOR. T1.DN only turns on after the full 3 s of rung power, ' +
        'and it drops the instant the seal is broken.'
      ]
    },
    {
      id: 'stoplight',
      title: '3 — Basic Timed Stoplight',
      requiredTags: ['NS_GRN', 'NS_YEL', 'NS_RED', 'EW_GRN', 'EW_YEL', 'EW_RED'],
      starter: null,
      spec:
        'Build the full two-direction stoplight using NS_GRN, NS_YEL, NS_RED, EW_GRN, EW_YEL ' +
        'and EW_RED. Memory bits B1..B12 and timers T1..T8 are yours for the internals.\n\n' +
        'The cycle, repeating forever: NS green 6.0 s -> NS yellow 2.0 s -> EW green 6.0 s -> ' +
        'EW yellow 2.0 s -> back to NS green. While one direction is green or yellow, the ' +
        'OTHER direction’s red must be lit the whole time. NS_GRN and EW_GRN must NEVER be on ' +
        'together — not even for a single scan; the grader checks every scan of a 72 s run.\n\n' +
        'All phase times are graded ± 0.06 s. Which phase you power up into is your choice ' +
        '(NS green is the natural start), but the cycle must be running within the first 18 s ' +
        'and each phase must hand straight off to the next with no dead gaps.',
      hints: [
        'Think in STEPS, not lamps: four step bits (B1 = NS green step, B2 = NS yellow, ' +
        'B3 = EW green, B4 = EW yellow). One power-up rung latches B1 when no step is active ' +
        'yet: XIO B1, XIO B2, XIO B3, XIO B4 -> OTL B1.',
        'Each step runs its own TON (6000 / 2000 / 6000 / 2000 ms). When a timer finishes, ' +
        'advance: XIC T1.DN -> OTL B2, OTU B1. The last step wraps back to B1.',
        'Drive the lamps from the step bits in output rungs at the END of the program: ' +
        'NS_GRN from B1, NS_YEL from B2, EW_GRN from B3, EW_YEL from B4; NS_RED from B3 OR B4 ' +
        '(a branch), EW_RED from B1 OR B2. For extra safety, series XIO EW_GRN into the ' +
        'NS_GRN rung and mirror it — the cross-interlock real controllers use.'
      ]
    },
    {
      id: 'crosswalk',
      title: '4 — Pedestrian Crosswalk',
      /* The starter's complete signal set is part of this exercise.  Listing
         all six lamps makes deleting the yellow/red output rungs fail before
         the pedestrian behaviour can hide that regression. */
      requiredTags: ['PED_NS', 'WALK_NS', 'NS_GRN', 'NS_YEL', 'NS_RED', 'EW_GRN', 'EW_YEL', 'EW_RED'],
      starter: STOPLIGHT_STARTER,
      spec:
        'Start from the working stoplight provided (press “Load starter”) and add the ' +
        'north/south pedestrian crossing. Use PED_NS and WALK_NS on top of the starter’s tags. ' +
        'Only the NS side is graded.\n\n' +
        'The rules: pressing PED_NS at ANY time (even briefly) latches a walk request. WALK_NS ' +
        'must turn on exactly at the START of the next NS green — never mid-green — stay on for ' +
        '4.0 s (± 0.06 s), then turn off for the rest of that green. A press made DURING an ' +
        'NS green is remembered but waits for the FOLLOWING NS green. Each press grants exactly ' +
        'one walk: with no new press, later greens run with WALK_NS off. WALK_NS must never be ' +
        'on while EW_GRN is on, and never outside an NS green at all.\n\n' +
        'Do not touch the starter’s light logic — the stoplight must keep cycling 6/2/6/2 ' +
        'exactly as delivered. The starter uses B1..B4 and T1..T4; build your crosswalk from ' +
        'B5..B12 and T5..T8.',
      hints: [
        'Three jobs: LATCH the request (XIC PED_NS -> OTL onto a request bit — works any time), ' +
        'GRANT it only at the instant a green begins, and TIME the 4-second walk.',
        '“The instant a green begins” is a one-shot: XIC B1 -> ONS B6 passes power for exactly ' +
        'one scan when the NS-green step bit rises. In that scan, if the request bit is set: ' +
        'OTL the walk bit and OTU the request (consume it). A press mid-green misses that scan ' +
        '— so it waits for the next green, which is exactly what the handout demands.',
        'The walk timing mirrors challenge 2: XIC walk-bit -> TON T5 (4000 ms); ' +
        'XIC T5.DN -> OTU walk-bit; XIC walk-bit -> OTE WALK_NS. Put your rungs after the ' +
        'starter’s step logic so the one-shot sees the green begin in the same scan.'
      ]
    }
  ];

  var byId = {};
  CHALLENGES.forEach(function (c) { byId[c.id] = c; });

  /* =====================================================================
   * Graders — each challenge is a sequence of {desc, run(h)} steps.
   * run(h) returns a plain-English failure detail string, or falsy = pass.
   * ===================================================================== */

  /* ---------- shared step: the handout's required tags ---------- */

  function requiredTagsStep(ch) {
    return {
      desc: 'Program uses the required tags (' + ch.requiredTags.join(', ') + ')',
      run: function (h) {
        var used = tagsUsed(h.plc.program);
        var missing = ch.requiredTags.filter(function (t) { return !used[t]; });
        if (missing.length) {
          return 'Your program never touches ' + missing.join(' or ') +
            ' — the handout requires ' + ch.requiredTags.join(', ') + '.';
        }
        return null;
      }
    };
  }

  /* ---------- challenge 1: seal-in ---------- */

  function sealinSteps() {
    return [
      {
        desc: 'MOTOR is OFF at power-up (no buttons pressed)',
        run: function (h) {
          h.step(50); // 1.0 s
          var x = firstOn(h.trace, 1, 50, 'MOTOR');
          if (x >= 0) {
            return 'MOTOR was already ON at ' + at(x) +
              ' with no button pressed — it must stay off until START is pressed.';
          }
          return null;
        }
      },
      {
        desc: 'One quick tap of START turns MOTOR ON',
        run: function (h) {
          h.press('PB_START'); // 1-scan momentary press
          var p = h.now() + 1;
          h.mem.startScan = p;
          var on = h.stepUntil(function (o) { return o.MOTOR; }, TOL + 1);
          if (on < 0) {
            return 'Expected MOTOR ON within ' + TOL_S + ' s of pressing START (' + at(p) +
              '), but it was still OFF at ' + at(h.now()) + '.';
          }
          return null;
        }
      },
      {
        desc: 'MOTOR stays ON after START is released (the seal-in holds it)',
        run: function (h) {
          var drop = h.stepUntil(function (o) { return !o.MOTOR; }, 150); // watch 3 s
          if (drop >= 0) {
            return 'MOTOR dropped out at ' + at(drop) + ' — START was already released, so ' +
              'only a seal-in contact can keep the rung true. It must run until STOP is pressed.';
          }
          return null;
        }
      },
      {
        desc: 'Pressing STOP turns MOTOR OFF',
        run: function (h) {
          h.press('PB_STOP');
          var p = h.now() + 1;
          var off = h.stepUntil(function (o) { return !o.MOTOR; }, TOL + 1);
          if (off < 0) {
            return 'Expected MOTOR OFF within ' + TOL_S + ' s of pressing STOP (' + at(p) +
              '), but it was still ON at ' + at(h.now()) + '.';
          }
          return null;
        }
      },
      {
        desc: 'MOTOR stays OFF after STOP is released',
        run: function (h) {
          var back = h.stepUntil(function (o) { return o.MOTOR; }, 100); // watch 2 s
          if (back >= 0) {
            return 'MOTOR came back ON at ' + at(back) +
              ' after STOP was released — with no new START press it must stay off.';
          }
          return null;
        }
      },
      {
        desc: 'START works again for a second run',
        run: function (h) {
          h.press('PB_START');
          var p = h.now() + 1;
          var on = h.stepUntil(function (o) { return o.MOTOR; }, TOL + 1);
          if (on < 0) {
            return 'The second START press (' + at(p) + ') did not restart the motor within ' +
              TOL_S + ' s — the circuit must be ready to run again after every stop.';
          }
          return null;
        }
      },
      {
        desc: 'Wiring check: a real seal-in — branch with a MOTOR contact feeding an OTE ' +
              '(no OTL/OTU on MOTOR)',
        run: function (h) {
          var hasSealBranch = false, latchOnMotor = false, hasOteMotor = false;
          var rungs = h.plc.program.rungs || [];
          /* A MOTOR contact elsewhere in the program is not a seal-in.  It
             must share the *same rung*, be in a parallel path with START,
             and feed that rung's OTE through the normally-closed STOP. */
          rungs.forEach(function (rung) {
            var items = (rung && rung.items) || [], coil = -1;
            items.forEach(function (el, i) {
              if ((el.t === 'OTL' || el.t === 'OTU') && el.tag === 'MOTOR') latchOnMotor = true;
              if (el.t === 'OTE' && el.tag === 'MOTOR') { hasOteMotor = true; coil = i; }
            });
            if (coil < 0) return;
            var hasStop = items.slice(0, coil).some(function (el) { return el.t === 'XIO' && el.tag === 'PB_STOP'; });
            for (var i = 0; i < coil; i++) {
              if (items[i].t !== 'BR' || !Array.isArray(items[i].paths)) continue;
              var startPath = false, motorPath = false;
              items[i].paths.forEach(function (path) {
                var hasStart = false, hasMotor = false;
                (path || []).forEach(function (el) {
                  if (el.t === 'XIC' && el.tag === 'PB_START') hasStart = true;
                  if (el.t === 'XIC' && el.tag === 'MOTOR') hasMotor = true;
                });
                startPath = startPath || hasStart;
                motorPath = motorPath || hasMotor;
              });
              if (startPath && motorPath && hasStop) hasSealBranch = true;
            }
          });
          if (latchOnMotor) {
            return 'Your program drives MOTOR with OTL/OTU. The handout asks for the classic ' +
              'seal-in: an OTE coil held in by a parallel MOTOR contact. Latch instructions ' +
              'are not allowed on MOTOR in this challenge.';
          }
          if (!hasSealBranch) {
            return 'No seal-in branch found. The grader looks for a parallel branch containing ' +
              'a MOTOR contact (XIC MOTOR) alongside the START contact — that contact is what ' +
              'keeps the rung true after the button is released.';
          }
          if (!hasOteMotor) {
            return 'MOTOR must be driven by an OTE coil (found no OTE MOTOR in the program).';
          }
          return null;
        }
      }
    ];
  }

  /* ---------- challenge 2: delayed start ---------- */

  var DELAY_SCANS = 150; // 3.0 s at 20 ms

  function delayedSteps() {
    return [
      {
        desc: 'MOTOR is OFF at power-up (no buttons pressed)',
        run: function (h) {
          h.step(50);
          var x = firstOn(h.trace, 1, 50, 'MOTOR');
          if (x >= 0) {
            return 'MOTOR was already ON at ' + at(x) +
              ' with no button pressed — it must stay off until 3.0 s after a START press.';
          }
          return null;
        }
      },
      {
        desc: 'After START, MOTOR waits out the full 3.0 s delay (no early start)',
        run: function (h) {
          h.press('PB_START'); // momentary — released immediately
          var p = h.now() + 1;
          h.mem.pressScan = p;
          var target = p + DELAY_SCANS;
          var on = h.stepUntil(function (o) { return o.MOTOR; }, (target + TOL) - h.now());
          h.mem.motorOn = on;
          if (on >= 0 && on < target - TOL) {
            return 'MOTOR turned ON at ' + at(on) + ', only ' + secs(on - p) +
              ' s after START — it must wait the full 3.0 s (expected ON around ' +
              at(target) + ', ± ' + TOL_S + ' s).';
          }
          return null;
        }
      },
      {
        desc: 'MOTOR energizes 3.0 s (± 0.06 s) after the START press — even though the ' +
              'button was released at once',
        run: function (h) {
          var p = h.mem.pressScan;
          if (h.mem.motorOn < 0) {
            return 'START was pressed (and released) at ' + at(p) + '. Expected MOTOR ON 3.0 s ' +
              'later (around ' + at(p + DELAY_SCANS) + ', ± ' + TOL_S + ' s), but it never ' +
              'came on by ' + at(h.now()) + '. A memory bit must hold the request after the ' +
              'button is released, and a TON driven by that bit does the 3-second wait.';
          }
          return null;
        }
      },
      {
        desc: 'MOTOR keeps running after the delay',
        run: function (h) {
          var drop = h.stepUntil(function (o) { return !o.MOTOR; }, 150); // watch 3 s
          if (drop >= 0) {
            return 'MOTOR shut off on its own at ' + at(drop) +
              ' — once started, it must run until STOP is pressed.';
          }
          return null;
        }
      },
      {
        desc: 'Pressing STOP shuts the motor down, and it stays down',
        run: function (h) {
          h.press('PB_STOP');
          var p = h.now() + 1;
          var off = h.stepUntil(function (o) { return !o.MOTOR; }, TOL + 1);
          if (off < 0) {
            return 'Expected MOTOR OFF within ' + TOL_S + ' s of pressing STOP (' + at(p) +
              '), but it was still ON at ' + at(h.now()) + '.';
          }
          var back = h.stepUntil(function (o) { return o.MOTOR; }, 200); // watch 4 s
          if (back >= 0) {
            return 'MOTOR restarted by itself at ' + at(back) + ' after the stop — the delay ' +
              'timer must not survive a STOP press (no restart without a fresh START).';
          }
          return null;
        }
      },
      {
        desc: 'STOP pressed DURING the delay cancels the start completely',
        run: function (h) {
          h.press('PB_START');
          var p = h.now() + 1;
          var early = h.stepUntil(function (o) { return o.MOTOR; }, 75); // 1.5 s into the delay
          if (early >= 0) {
            return 'MOTOR turned ON at ' + at(early) + ', only ' + secs(early - p) +
              ' s after START — the 3.0 s delay must hold before the mid-delay cancel can ' +
              'even be tested.';
          }
          h.press('PB_STOP');
          var stopScan = h.now() + 1;
          var on = h.stepUntil(function (o) { return o.MOTOR; }, 300); // watch 6 s
          if (on >= 0) {
            return 'STOP was pressed at ' + at(stopScan) + ', 1.5 s into the 3-second delay — ' +
              'but MOTOR still started at ' + at(on) + '. A stop during the delay must cancel ' +
              'the start completely.';
          }
          return null;
        }
      }
    ];
  }

  /* ---------- challenge 3: basic stoplight ---------- */

  var OBSERVE_SCANS = 3600;  // 72 s — at least 4 full 16 s cycles
  var GRN_SCANS = 300;       // 6.0 s
  var YEL_SCANS = 100;       // 2.0 s

  function phaseLabel(n) { return n === 1 ? 'green' : 'yellow'; }

  /** Duration check for every complete interval of a phase. */
  function checkPhaseDurations(list, wantScans, phaseName, wantSecs) {
    for (var i = 0; i < list.length; i++) {
      var d = list[i].end - list[i].start + 1;
      if (Math.abs(d - wantScans) > TOL) {
        return 'A ' + phaseName + ' phase lasted ' + secs(d) + ' s (scans ' + list[i].start +
          '–' + list[i].end + ') — expected ' + wantSecs + ' s ± ' + TOL_S + ' s.';
      }
    }
    return null;
  }

  function stoplightSteps() {
    return [
      {
        desc: 'The cycle runs: NS_GRN first appears within 18 s of power-up (observing 72 s)',
        run: function (h) {
          h.step(OBSERVE_SCANS);
          h.mem.iv = {
            NS_GRN: intervalsOf(h.trace, 'NS_GRN'),
            NS_YEL: intervalsOf(h.trace, 'NS_YEL'),
            EW_GRN: intervalsOf(h.trace, 'EW_GRN'),
            EW_YEL: intervalsOf(h.trace, 'EW_YEL')
          };
          // The very first phase shown after power-up has no predecessor —
          // the handout leaves the starting phase to the student, so that one
          // interval is exempt from the "follows its predecessor" checks.
          var firsts = ['NS_GRN', 'NS_YEL', 'EW_GRN', 'EW_YEL'].map(function (t) {
            return h.mem.iv[t].length ? h.mem.iv[t][0].start : Infinity;
          });
          h.mem.powerUp = Math.min.apply(null, firsts);
          var g = h.mem.iv.NS_GRN;
          if (!g.length) {
            return 'NS_GRN never turned on during the whole 72 s observation (' + OBSERVE_SCANS +
              ' scans) — no cycle is running.';
          }
          if (g[0].start > 900) {
            return 'NS_GRN first came on at ' + at(g[0].start) + ' — later than 18 s ' +
              '(scan 900) after power-up. The cycle must be running within one 16 s period.';
          }
          return null;
        }
      },
      {
        desc: 'Safety: NS_GRN and EW_GRN are never on together (checked every scan for 72 s)',
        run: function (h) {
          var x = firstWhere(h.trace, 1, OBSERVE_SCANS, function (s) { return s.NS_GRN && s.EW_GRN; });
          if (x >= 0) {
            return 'Both greens were ON together at ' + at(x) + ' — cross traffic would ' +
              'collide. NS_GRN and EW_GRN must never be on at the same time, not even for ' +
              'one scan.';
          }
          return null;
        }
      },
      {
        desc: 'Opposing red: EW_RED lit through all of NS green + yellow, NS_RED through all ' +
              'of EW green + yellow',
        run: function (h) {
          var x = longViolation(h.trace, 1, OBSERVE_SCANS, function (s) {
            return (s.NS_GRN || s.NS_YEL) && !s.EW_RED;
          }, TOL);
          if (x >= 0) {
            return 'While north/south showed ' + phaseLabel(h.trace[x].NS_GRN ? 1 : 2) +
              ', EW_RED was off at ' + at(x) + ' (for more than ' + TOL_S + ' s) — the ' +
              'opposing direction must sit at red the whole time.';
          }
          x = longViolation(h.trace, 1, OBSERVE_SCANS, function (s) {
            return (s.EW_GRN || s.EW_YEL) && !s.NS_RED;
          }, TOL);
          if (x >= 0) {
            return 'While east/west showed ' + phaseLabel(h.trace[x].EW_GRN ? 1 : 2) +
              ', NS_RED was off at ' + at(x) + ' (for more than ' + TOL_S + ' s) — the ' +
              'opposing direction must sit at red the whole time.';
          }
          return null;
        }
      },
      {
        desc: 'Every NS green phase lasts 6.0 s (± 0.06 s), and the cycle keeps repeating',
        run: function (h) {
          var greens = completeOf(h.mem.iv.NS_GRN);
          if (greens.length < 3) {
            return 'Only ' + greens.length + ' complete NS green phase' +
              (greens.length === 1 ? '' : 's') + ' in 72 s — the 16 s cycle must repeat ' +
              'continuously (expected at least 3).';
          }
          return checkPhaseDurations(greens, GRN_SCANS, 'NS green', '6.0');
        }
      },
      {
        desc: 'NS yellow follows its green immediately and lasts 2.0 s (± 0.06 s)',
        run: function (h) {
          var greens = completeOf(h.mem.iv.NS_GRN);
          var yels = h.mem.iv.NS_YEL;
          var bad = checkPhaseDurations(completeOf(yels), YEL_SCANS, 'NS yellow', '2.0');
          if (bad) return bad;
          for (var i = 0; i < greens.length; i++) {
            var e = greens[i].end;
            if (e + 1 + TOL > OBSERVE_SCANS - 5) continue; // follower would start off-trace
            if (!startNear(yels, e + 1, TOL)) {
              return 'NS green ended at ' + at(e) + ' but NS_YEL did not come on within ' +
                TOL_S + ' s — yellow must follow green immediately, with no dead gap.';
            }
          }
          for (i = 0; i < yels.length; i++) {
            if (Math.abs(yels[i].start - h.mem.powerUp) <= TOL) continue; // power-up phase
            var ok = false;
            for (var j = 0; j < greens.length; j++) {
              if (Math.abs(yels[i].start - (greens[j].end + 1)) <= TOL) { ok = true; break; }
            }
            if (!ok) {
              return 'NS_YEL came on at ' + at(yels[i].start) + ' — not right after an NS ' +
                'green ended. Yellow must appear only as its own green ends.';
            }
          }
          return null;
        }
      },
      {
        desc: 'EW green follows NS yellow immediately and lasts 6.0 s (± 0.06 s)',
        run: function (h) {
          var yels = completeOf(h.mem.iv.NS_YEL);
          var ewg = h.mem.iv.EW_GRN;
          var bad = checkPhaseDurations(completeOf(ewg), GRN_SCANS, 'EW green', '6.0');
          if (bad) return bad;
          for (var i = 0; i < yels.length; i++) {
            var e = yels[i].end;
            if (e + 1 + TOL > OBSERVE_SCANS - 5) continue;
            if (!startNear(ewg, e + 1, TOL)) {
              return 'NS yellow ended at ' + at(e) + ' but EW_GRN did not come on within ' +
                TOL_S + ' s — the east/west green must start as NS yellow ends.';
            }
          }
          for (i = 0; i < ewg.length; i++) {
            if (Math.abs(ewg[i].start - h.mem.powerUp) <= TOL) continue; // power-up phase
            var ok = false;
            for (var j = 0; j < yels.length; j++) {
              if (Math.abs(ewg[i].start - (yels[j].end + 1)) <= TOL) { ok = true; break; }
            }
            if (!ok) {
              return 'EW_GRN came on at ' + at(ewg[i].start) + ' — not right after an NS ' +
                'yellow ended. The east/west green may only start as NS yellow ends.';
            }
          }
          return null;
        }
      },
      {
        desc: 'EW yellow follows EW green, lasts 2.0 s (± 0.06 s), then NS green returns ' +
              '(the 16 s cycle wraps around)',
        run: function (h) {
          var ewg = completeOf(h.mem.iv.EW_GRN);
          var ewy = h.mem.iv.EW_YEL;
          var nsg = h.mem.iv.NS_GRN;
          var bad = checkPhaseDurations(completeOf(ewy), YEL_SCANS, 'EW yellow', '2.0');
          if (bad) return bad;
          var i;
          for (i = 0; i < ewg.length; i++) {
            var e = ewg[i].end;
            if (e + 1 + TOL > OBSERVE_SCANS - 5) continue;
            if (!startNear(ewy, e + 1, TOL)) {
              return 'EW green ended at ' + at(e) + ' but EW_YEL did not come on within ' +
                TOL_S + ' s — yellow must follow green immediately.';
            }
          }
          for (i = 0; i < ewy.length; i++) {
            if (Math.abs(ewy[i].start - h.mem.powerUp) <= TOL) continue; // power-up phase
            var ok = false;
            for (var j = 0; j < ewg.length; j++) {
              if (Math.abs(ewy[i].start - (ewg[j].end + 1)) <= TOL) { ok = true; break; }
            }
            if (!ok) {
              return 'EW_YEL came on at ' + at(ewy[i].start) + ' — not right after an EW ' +
                'green ended.';
            }
          }
          var ewyC = completeOf(ewy);
          for (i = 0; i < ewyC.length; i++) {
            var e2 = ewyC[i].end;
            if (e2 + 1 + TOL > OBSERVE_SCANS - 5) continue;
            if (!startNear(nsg, e2 + 1, TOL)) {
              return 'After EW yellow ended at ' + at(e2) + ', NS_GRN should restart within ' +
                TOL_S + ' s — the cycle must wrap around continuously.';
            }
          }
          return null;
        }
      }
    ];
  }

  /* ---------- challenge 4: crosswalk ---------- */

  var WALK_SCANS = 200; // 4.0 s

  /** After the harness sits at (or past) an NS-green rise, verify WALK_NS
   *  rises within ±TOL of it and lasts 4.0 s ± tol. Returns detail or null;
   *  stores walkOn/walkOff in h.mem. */
  function expectWalkAtGreen(h, greenRise, requestDesc) {
    var w = firstOn(h.trace, Math.max(1, greenRise - TOL), h.now(), 'WALK_NS');
    if (w < 0) {
      var budget = (greenRise + TOL) - h.now();
      if (budget > 0) w = h.stepUntil(function (o) { return o.WALK_NS; }, budget);
    }
    if (w < 0) {
      return requestDesc + ' Expected WALK_NS ON at the start of that NS green (' +
        at(greenRise) + ', ± ' + TOL_S + ' s), but it was still OFF at ' +
        at(greenRise + TOL) + '.';
    }
    h.mem.walkOn = w;
    return null;
  }

  function checkWalkDuration(h) {
    var w = h.mem.walkOn;
    var deadline = w + WALK_SCANS + TOL;
    var off = firstWhere(h.trace, w, h.now(), function (s) { return !s.WALK_NS; });
    if (off < 0 && deadline > h.now()) {
      off = h.stepUntil(function (o) { return !o.WALK_NS; }, deadline - h.now());
    }
    if (off < 0) {
      return 'WALK_NS was still ON at ' + at(deadline) + ' — ' + secs(deadline - w) +
        ' s after it came on at ' + at(w) + '. The walk must end after 4.0 s ± ' +
        TOL_S + ' s.';
    }
    var d = off - w; // ON scans: w .. off-1
    if (Math.abs(d - WALK_SCANS) > TOL) {
      return 'The walk lasted ' + secs(d) + ' s (WALK_NS on at ' + at(w) + ', off at ' +
        at(off) + ') — expected 4.0 s ± ' + TOL_S + ' s.';
    }
    h.mem.walkOff = off;
    return null;
  }

  function crosswalkSteps() {
    return [
      {
        desc: 'The starter stoplight still cycles (NS green 6.0 s, full cycle 16 s)',
        run: function (h) {
          var r1 = h.stepUntil(function (o) { return o.NS_GRN; }, 900);
          if (r1 < 0) {
            return 'NS_GRN never came on in the first 18 s (900 scans) — the base stoplight ' +
              'must keep running. Load the starter and add your crosswalk rungs to it.';
          }
          var e1 = h.stepUntil(function (o) { return !o.NS_GRN; }, 400);
          if (e1 < 0) {
            return 'NS_GRN stayed on for over 8 s (it rose at ' + at(r1) + ') — the starter ' +
              'times its greens at 6.0 s. Keep the light logic as delivered.';
          }
          var d = e1 - r1; // ON scans r1 .. e1-1
          if (Math.abs(d - GRN_SCANS) > TOL) {
            return 'The first NS green lasted ' + secs(d) + ' s — the starter times it at ' +
              '6.0 s ± ' + TOL_S + ' s. Keep the light logic as delivered.';
          }
          var r2 = h.stepUntil(function (o) { return o.NS_GRN; }, 600);
          if (r2 < 0) {
            return 'After the first NS green ended at ' + at(e1) + ', NS_GRN never returned ' +
              'within 12 s — the 16 s cycle is broken.';
          }
          var period = r2 - r1;
          if (Math.abs(period - 800) > 2 * TOL) {
            return 'The green-to-green cycle measured ' + secs(period) + ' s (scans ' + r1 +
              ' → ' + r2 + ') — the starter cycles every 16.0 s. Keep the light logic ' +
              'as delivered.';
          }
          h.mem.green2 = r2; // we are exactly at the start of green #2
          return null;
        }
      },
      {
        desc: 'Complete signal sequence: red/yellow/green lamps match every phase',
        run: function (h) {
          var last = h.trace.length - 1;
          for (var i = 1; i <= last; i++) {
            var s = h.trace[i];
            var ns = s.NS_GRN ? 1 : (s.NS_YEL ? 2 : 0);
            var ew = s.EW_GRN ? 1 : (s.EW_YEL ? 2 : 0);
            /* A direction with green/yellow owns the road; its opponent is
               red.  A direction without an active lamp is red.  This is an
               output contract, not an implementation-shape check. */
            var wantNsRed = ew ? 1 : 0, wantEwRed = ns ? 1 : 0;
            if ((!ns && !ew) || (ns && ew) || s.NS_RED !== wantNsRed || s.EW_RED !== wantEwRed) {
              return 'At ' + at(i) + ' the complete stoplight phase is invalid. Each phase needs exactly one active direction (green or yellow) and the opposing red lamp.';
            }
          }
          return null;
        }
      },
      {
        desc: 'No request, no walk: WALK_NS stays OFF through the first full cycle',
        run: function (h) {
          var x = firstOn(h.trace, 1, h.now(), 'WALK_NS');
          if (x >= 0) {
            return 'WALK_NS turned ON at ' + at(x) + ' even though PED_NS was never pressed — ' +
              'the walk sign may only run after a request.';
          }
          return null;
        }
      },
      {
        desc: 'A press during EW green is remembered, and WALK_NS starts exactly at the ' +
              'START of the next NS green',
        run: function (h) {
          var ew = h.stepUntil(function (o) { return o.EW_GRN; }, 700);
          if (ew < 0) {
            return 'EW_GRN never came on after the NS green at ' + at(h.mem.green2) +
              ' — the base stoplight must keep cycling.';
          }
          h.step(50); // 1 s into the EW green
          h.press('PED_NS'); // momentary request
          var p = h.now() + 1;
          h.mem.pressScan = p;
          var g = h.stepUntil(function (o) { return o.NS_GRN; }, 1000);
          if (g < 0) {
            return 'After the request at ' + at(p) + ', NS_GRN never returned within 20 s — ' +
              'the base stoplight must keep cycling.';
          }
          h.mem.walkGreen = g;
          var early = firstOn(h.trace, p, g - TOL - 1, 'WALK_NS');
          if (early >= 0) {
            return 'You pressed PED_NS at ' + at(p) + ' (during EW green). WALK_NS came on ' +
              'at ' + at(early) + ', BEFORE the next NS green began (' + at(g) + ') — the ' +
              'walk must start exactly at the start of that green, never earlier.';
          }
          return expectWalkAtGreen(h, g,
            'PED_NS was pressed at ' + at(p) + ' (during EW green).');
        }
      },
      {
        desc: 'The walk lasts 4.0 s (± 0.06 s), then WALK_NS goes off for the rest of ' +
              'the green',
        run: function (h) {
          var bad = checkWalkDuration(h);
          if (bad) return bad;
          var gEnd = h.stepUntil(function (o) { return !o.NS_GRN; }, 400);
          if (gEnd < 0) {
            return 'The NS green that started at ' + at(h.mem.walkGreen) +
              ' never ended — the base stoplight must keep cycling.';
          }
          var again = firstOn(h.trace, h.mem.walkOff, gEnd, 'WALK_NS');
          if (again >= 0) {
            return 'WALK_NS came back ON at ' + at(again) + ' in the same green — after its ' +
              '4.0 s the walk stays off (DON’T WALK) for the rest of that green.';
          }
          return null;
        }
      },
      {
        desc: 'The request is consumed: the following NS green runs with WALK_NS off ' +
              '(no new press)',
        run: function (h) {
          var g = h.stepUntil(function (o) { return o.NS_GRN; }, 1000);
          if (g < 0) {
            return 'NS_GRN never returned for the follow-up cycle — the base stoplight must ' +
              'keep cycling.';
          }
          h.mem.quietGreen = g;
          h.step(100); // 2 s into this green, nobody pressed anything
          var x = firstOn(h.trace, Math.max(1, g - TOL), h.now(), 'WALK_NS');
          if (x >= 0) {
            return 'WALK_NS ran again at ' + at(x) + ' on the next NS green with no new ' +
              'button press — each press grants exactly ONE walk.';
          }
          return null;
        }
      },
      {
        desc: 'A press DURING an NS green waits for the FOLLOWING green (and is served there)',
        run: function (h) {
          h.press('PED_NS'); // we are 2 s into a quiet NS green
          var p = h.now() + 1;
          var gEnd = h.stepUntil(function (o) { return !o.NS_GRN; }, 400);
          if (gEnd < 0) {
            return 'The NS green never ended after the mid-green press — the base stoplight ' +
              'must keep cycling.';
          }
          var x = firstOn(h.trace, p, gEnd, 'WALK_NS');
          if (x >= 0) {
            return 'PED_NS was pressed at ' + at(p) + ', 2.0 s into an NS green. WALK_NS came ' +
              'on at ' + at(x) + ' in that SAME green — a mid-green request must wait for the ' +
              'start of the FOLLOWING NS green.';
          }
          var g = h.stepUntil(function (o) { return o.NS_GRN; }, 1000);
          if (g < 0) {
            return 'NS_GRN never returned after the mid-green press — the base stoplight must ' +
              'keep cycling.';
          }
          var early = firstOn(h.trace, gEnd, g - TOL - 1, 'WALK_NS');
          if (early >= 0) {
            return 'WALK_NS came on at ' + at(early) + ', while the light was not yet green — ' +
              'the stored request must be served exactly at the start of the next NS green (' +
              at(g) + ').';
          }
          var bad = expectWalkAtGreen(h, g,
            'PED_NS was pressed at ' + at(p) + ' (mid-green); the FOLLOWING green began at ' +
            at(g) + '.');
          if (bad) return bad;
          return checkWalkDuration(h);
        }
      },
      {
        desc: 'Safety: WALK_NS never on with EW_GRN, only during NS green — and never both ' +
              'greens (checked every scan of the whole run)',
        run: function (h) {
          var last = h.trace.length - 1;
          var x = firstWhere(h.trace, 1, last, function (s) { return s.WALK_NS && s.EW_GRN; });
          if (x >= 0) {
            return 'WALK_NS and EW_GRN were ON together at ' + at(x) + ' — pedestrians would ' +
              'be walking in front of moving cross-traffic. This must never happen, not even ' +
              'for one scan.';
          }
          x = longViolation(h.trace, 1, last, function (s) { return s.WALK_NS && !s.NS_GRN; }, TOL);
          if (x >= 0) {
            return 'WALK_NS was ON outside an NS green at ' + at(x) + ' (for more than ' +
              TOL_S + ' s) — the walk sign may only run during the NS green.';
          }
          x = firstWhere(h.trace, 1, last, function (s) { return s.NS_GRN && s.EW_GRN; });
          if (x >= 0) {
            return 'The base stoplight broke: both greens were ON together at ' + at(x) + '.';
          }
          return null;
        }
      }
    ];
  }

  var GRADERS = {
    sealin: sealinSteps,
    delayed: delayedSteps,
    stoplight: stoplightSteps,
    crosswalk: crosswalkSteps
  };

  /* =====================================================================
   * grade(challengeId, programJson) -> {pass, steps:[{desc, pass, detail}]}
   * ===================================================================== */

  function grade(challengeId, programJson) {
    var steps = [];
    var ch = byId[challengeId];
    if (!ch) {
      steps.push({
        desc: 'Load challenge', pass: false,
        detail: 'Unknown challenge id "' + challengeId + '". Valid ids: ' +
          CHALLENGES.map(function (c) { return c.id; }).join(', ') + '.'
      });
      return { pass: false, steps: steps };
    }

    // Friendly fast-fail: nothing to run.
    if (programIsEmpty(programJson)) {
      steps.push({
        desc: 'Program has logic to run', pass: false,
        detail: 'Your program is empty — build at least one rung of instructions in the ' +
          'editor, then check again.'
      });
      return { pass: false, steps: steps };
    }

    // Friendly fast-fail: editor-level validation errors (warnings do not block).
    var errors = (LL.Validate && LL.Validate.check) ?
      LL.Validate.check(programJson).filter(function (i) { return i.level === 'error'; }) : [];
    if (errors.length) {
      steps.push({
        desc: 'Program passes the editor validation checks', pass: false,
        detail: 'Fix this first: ' + errors[0].msg +
          (errors.length > 1 ? ' (' + (errors.length - 1) + ' more validation error' +
            (errors.length > 2 ? 's' : '') + ' after that.)' : '')
      });
      return { pass: false, steps: steps };
    }

    var h = new Harness(programJson);
    var defs = [requiredTagsStep(ch)].concat(GRADERS[challengeId]());
    var failed = false;

    defs.forEach(function (def) {
      if (failed) {
        steps.push({
          desc: def.desc, pass: false, skipped: true,
          detail: 'Not checked — fix the failing step above first.'
        });
        return;
      }
      var detail = null;
      try {
        detail = def.run(h);
      } catch (e) {
        detail = 'The grader hit an internal error on this step (' +
          ((e && e.message) || e) + '). This usually means the program did something very ' +
          'unexpected — simplify and check again.';
      }
      if (detail) {
        failed = true;
        steps.push({ desc: def.desc, pass: false, detail: String(detail) });
      } else {
        steps.push({ desc: def.desc, pass: true, detail: '' });
      }
    });

    return { pass: !failed, steps: steps };
  }

  /* =====================================================================
   * UI panel — LL.Challenges.initPanel(containerEl, ctx)
   * (No DOM access at load time; everything lives inside initPanel.)
   * ===================================================================== */

  var UI = {
    root: null,
    ctx: null,
    activeId: null,
    status: {},        // id -> 'none' | 'attempted' | 'passed'  (best, in memory)
    hintsShown: {},    // id -> number of hints revealed
    lastResult: {}     // id -> grade() result (for re-render on tab switch)
  };

  function el(tagName, className, text) {
    var n = document.createElement(tagName);
    if (className) n.className = className;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function statusOf(id) { return UI.status[id] || 'none'; }

  function setStatus(id, s) {
    // 'passed' is sticky — it records the best result this session.
    if (UI.status[id] === 'passed') return;
    UI.status[id] = s;
  }

  function initPanel(containerEl, ctx) {
    UI.root = containerEl;
    UI.ctx = ctx || {};
    if (!UI.activeId) UI.activeId = CHALLENGES[0].id;
    renderPanel();
  }

  function renderPanel() {
    var root = UI.root;
    if (!root) return;
    root.textContent = '';

    var wrap = el('div', 'ch-root');

    /* --- tabs --- */
    var tabs = el('div', 'ch-tabs');
    tabs.setAttribute('role', 'tablist');
    CHALLENGES.forEach(function (c) {
      var b = el('button', 'ch-tab' + (c.id === UI.activeId ? ' ch-tab-active' : ''));
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', c.id === UI.activeId ? 'true' : 'false');
      var dot = el('span', 'ch-dot');
      dot.setAttribute('data-status', statusOf(c.id));
      b.appendChild(dot);
      b.appendChild(el('span', 'ch-tab-label', c.title));
      b.addEventListener('click', function () {
        UI.activeId = c.id;
        renderPanel();
      });
      tabs.appendChild(b);
    });
    wrap.appendChild(tabs);

    var ch = byId[UI.activeId];
    var body = el('div', 'ch-body');

    /* --- spec card --- */
    var specCard = el('section', 'ch-card ch-spec-card');
    var head = el('div', 'ch-card-head');
    head.appendChild(el('h2', 'ch-title', ch.title));
    var badge = el('span', 'ch-status-badge');
    badge.setAttribute('data-status', statusOf(ch.id));
    badge.textContent = statusOf(ch.id) === 'passed' ? 'PASSED' :
      statusOf(ch.id) === 'attempted' ? 'ATTEMPTED' : 'NOT TRIED';
    head.appendChild(badge);
    specCard.appendChild(head);

    var specBox = el('div', 'ch-spec');
    ch.spec.split('\n\n').forEach(function (para) {
      specBox.appendChild(el('p', 'ch-spec-para', para));
    });
    specCard.appendChild(specBox);

    var tagsRow = el('div', 'ch-tags');
    tagsRow.appendChild(el('span', 'ch-tags-label', 'Tags you’ll need:'));
    ch.requiredTags.forEach(function (t) {
      tagsRow.appendChild(el('code', 'ch-tagchip', t));
    });
    specCard.appendChild(tagsRow);

    /* hints — revealed one at a time */
    var hintsBox = el('div', 'ch-hints');
    hintsBox.appendChild(el('h3', 'ch-hints-title', 'Hints'));
    var shown = UI.hintsShown[ch.id] || 0;
    if (shown > 0) {
      var ol = el('ol', 'ch-hint-list');
      for (var i = 0; i < shown && i < ch.hints.length; i++) {
        ol.appendChild(el('li', 'ch-hint', ch.hints[i]));
      }
      hintsBox.appendChild(ol);
    }
    if (shown < ch.hints.length) {
      var hb = el('button', 'ch-btn ch-btn-hint',
        'Reveal hint ' + (shown + 1) + ' of ' + ch.hints.length);
      hb.type = 'button';
      hb.addEventListener('click', function () {
        UI.hintsShown[ch.id] = (UI.hintsShown[ch.id] || 0) + 1;
        renderPanel();
      });
      hintsBox.appendChild(hb);
    } else {
      hintsBox.appendChild(el('div', 'ch-hints-done', 'All hints revealed.'));
    }
    specCard.appendChild(hintsBox);

    /* actions */
    var actions = el('div', 'ch-actions');
    if (ch.starter) {
      var lb = el('button', 'ch-btn', 'Load starter');
      lb.type = 'button';
      lb.title = 'Load the provided starting program into the editor';
      lb.addEventListener('click', function () {
        var program = deepClone(ch.starter);
        if (UI.ctx.bus && UI.ctx.bus.emit) {
          UI.ctx.bus.emit('challenge:starter', { program: program });
        } else if (LL.Editor && LL.Editor.loadChallengeStarter) {
          // dev-harness fallback when no app bus is wired
          LL.Editor.loadChallengeStarter(program,
            'Challenge starter loaded — add your rungs below.');
        }
      });
      actions.appendChild(lb);
    }
    var cb = el('button', 'ch-btn ch-btn-primary', 'Check my program');
    cb.type = 'button';
    cb.addEventListener('click', function () { onCheck(ch); });
    actions.appendChild(cb);
    specCard.appendChild(actions);

    body.appendChild(specCard);

    /* --- results card --- */
    var resCard = el('section', 'ch-card ch-results-card');
    renderResults(resCard, ch);
    body.appendChild(resCard);

    wrap.appendChild(body);
    root.appendChild(wrap);
  }

  function onCheck(ch) {
    var Ed = LL.Editor;
    if (!Ed || typeof Ed.getProgram !== 'function') {
      UI.lastResult[ch.id] = {
        message: 'The editor isn’t available, so there is no program to check. Open the ' +
          'Challenges mode from the app (the editor loads alongside it) and build your rungs ' +
          'there first.'
      };
      renderPanel();
      return;
    }
    var program = Ed.getProgram();
    if (programIsEmpty(program)) {
      UI.lastResult[ch.id] = {
        message: 'Your ladder is empty. Build your program in the editor first — then come ' +
          'back and press “Check my program”.'
      };
      renderPanel();
      return;
    }
    var result = grade(ch.id, program);
    UI.lastResult[ch.id] = result;
    setStatus(ch.id, result.pass ? 'passed' : 'attempted');
    if (result.pass) UI.status[ch.id] = 'passed';
    renderPanel();
  }

  function renderResults(card, ch) {
    var head = el('div', 'ch-card-head');
    head.appendChild(el('h3', 'ch-results-title', 'Check results'));
    card.appendChild(head);

    var r = UI.lastResult[ch.id];
    if (!r) {
      card.appendChild(el('div', 'ch-results-empty',
        'No check yet. Build your program in the editor, then press ' +
        '“Check my program”.'));
      return;
    }
    if (r.message) { // editor-missing / empty-editor friendly message
      card.appendChild(el('div', 'ch-results-note', r.message));
      return;
    }

    var passed = r.steps.filter(function (s) { return s.pass; }).length;
    if (r.pass) {
      var banner = el('div', 'ch-banner ch-banner-pass');
      banner.appendChild(el('div', 'ch-banner-word', 'PASS'));
      banner.appendChild(el('div', 'ch-banner-sub',
        'All ' + r.steps.length + ' checks passed. Clean wiring — challenge complete.'));
      card.appendChild(banner);
    } else {
      var fb = el('div', 'ch-banner ch-banner-fail');
      fb.appendChild(el('div', 'ch-banner-word', 'NOT YET'));
      fb.appendChild(el('div', 'ch-banner-sub',
        passed + ' of ' + r.steps.length + ' checks passed — the first failing check is ' +
        'highlighted below.'));
      card.appendChild(fb);
    }

    var ol = el('ol', 'ch-steps');
    var firstFailSeen = false;
    r.steps.forEach(function (s) {
      var cls = 'ch-step ' + (s.pass ? 'ch-step-pass' : s.skipped ? 'ch-step-skip' : 'ch-step-fail');
      var isFirstFail = !s.pass && !s.skipped && !firstFailSeen;
      if (isFirstFail) { cls += ' ch-step-first-fail'; firstFailSeen = true; }
      var li = el('li', cls);
      var row = el('div', 'ch-step-row');
      row.appendChild(el('span', 'ch-step-mark', s.pass ? '✓' : s.skipped ? '○' : '✗'));
      row.appendChild(el('span', 'ch-step-desc', s.desc));
      li.appendChild(row);
      if (!s.pass && s.detail) {
        li.appendChild(el('div', isFirstFail ? 'ch-step-detail ch-step-detail-main' : 'ch-step-detail',
          s.detail));
      }
      ol.appendChild(li);
    });
    card.appendChild(ol);
  }

  /* =====================================================================
   * exports
   * ===================================================================== */

  LL.Challenges = {
    list: CHALLENGES,
    grade: grade,
    initPanel: initPanel,
    init: initPanel // SPEC.md module-init contract alias
  };

  if (IS_NODE && typeof module !== 'undefined' && module.exports) {
    module.exports = LL; // same convention as engine.js: export the namespace
  }
})();
