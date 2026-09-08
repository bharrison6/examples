/*
 * Ladder Lab — faults.js
 * ----------------------
 * window.LL.Faults — the troubleshooting fault library + the Troubleshoot
 * panel UI.
 *
 *   LL.Faults.list                     >= 10 fault objects (see shape below)
 *   LL.Faults.byId(id)                 -> fault or null
 *   LL.Faults.applyById(id)            -> freshly patched program JSON
 *   LL.Faults.initPanel(containerEl, ctx)
 *
 * Fault object shape:
 *   { id, programId, title, difficulty (1-3), apply(clonedProgramJson) ->
 *     patchedJson, symptom, explanation }
 *
 * apply() receives an ALREADY deep-cloned program (applyById does the
 * cloning with LL.Util.deepClone) and transforms it in place, returning it.
 * The pristine programs in LL.Programs are never touched — the test suite
 * asserts byte-identity before/after every apply. Each apply() records
 * `faultRungs` (0-based rung indexes in the PATCHED program) on the JSON;
 * element ids are only assigned at PLC construction, so the reveal step
 * builds a throwaway PLC from the patched JSON and collects the ids of
 * every element on those rungs for ladder highlighting.
 *
 * Every patched program still passes LL.Validate with zero ERRORS.
 * Warnings are fine and sometimes the point (the double-coil fault
 * deliberately trips the duplicate-OTE warning — a student who runs the
 * validator earns the hint). This is also why the night-flasher fault sets
 * the preset to 1 ms rather than a literal 0: a zero preset is a validation
 * ERROR the validator would announce outright, while 1 ms (less than one
 * 20 ms scan) behaves identically — "zero for all practical purposes" —
 * and leaves the diagnosing to the student.
 *
 * Browser + node (same namespace pattern as engine.js/programs.js). Under
 * node the file wires its own LL from require()d siblings so applyById and
 * the data are fully usable in tests; require() caching makes these the
 * same module instances the test file sees.
 */
(function () {
  'use strict';

  var LL;
  if (typeof window !== 'undefined') {
    window.LL = window.LL || {};
    LL = window.LL;
  } else {
    LL = {};
    /* node: borrow engine + programs so applyById works in tests */
    try {
      var eng = require('./engine.js');
      LL.Engine = eng.Engine; LL.Util = eng.Util; LL.Validate = eng.Validate;
      LL.Programs = require('./programs.js').Programs;
    } catch (e) { /* stand-alone require without siblings: data still exported */ }
  }

  /* ----------------------------------------------------------------------
   * Structure-lookup helpers. Faults locate their targets by PREDICATE,
   * not by hard-coded index, and throw loudly if the program shape ever
   * drifts — a fault that silently patches the wrong element would be a
   * far worse bug than a crash.
   * ------------------------------------------------------------------- */

  function must(cond, msg) {
    if (!cond) throw new Error('faults.js: ' + msg);
    return cond;
  }

  /** Index of the first rung whose items contain an element matching pred. */
  function findRung(prog, pred) {
    for (var r = 0; r < prog.rungs.length; r++) {
      var items = prog.rungs[r].items || [];
      for (var i = 0; i < items.length; i++) if (pred(items[i])) return r;
    }
    return -1;
  }

  /** Index within rung.items of the first element matching pred, else -1. */
  function findElem(items, pred) {
    for (var i = 0; i < items.length; i++) if (pred(items[i])) return i;
    return -1;
  }

  function isType(t, tag) {
    return function (el) { return el.t === t && el.tag === tag; };
  }

  /* ----------------------------------------------------------------------
   * The fault library. Grouped by program; ids are stable.
   * ------------------------------------------------------------------- */

  var list = [

    /* ---------------- motor_sealin ---------------- */
    {
      id: 'motor_missing_sealin',
      programId: 'motor_sealin',
      title: 'Missing seal-in branch',
      difficulty: 1,
      symptom: 'The motor runs only while PB_START is physically held down, and stops the instant you let go.',
      explanation: 'The parallel XIC MOTOR branch — the seal-in — is gone, leaving the start button alone in series with the stop contact. ' +
        'With nothing to carry power once the momentary button opens, the OTE de-energizes on the very next scan after release. ' +
        'Restore the branch so (PB_START OR MOTOR) feeds the rung and the motor holds itself in.',
      apply: function (prog) {
        var r = must0(findRung(prog, function (el) { return el.t === 'BR'; }), 'motor seal-in branch not found');
        var items = prog.rungs[r].items;
        var i = findElem(items, function (el) { return el.t === 'BR'; });
        items.splice(i, 1, { t: 'XIC', tag: 'PB_START' }); // branch collapses to the bare button
        prog.faultRungs = [r];
        return prog;
      }
    },

    {
      id: 'motor_stop_swapped',
      programId: 'motor_sealin',
      title: 'XIC/XIO swapped on PB_STOP',
      difficulty: 1,
      symptom: 'Pressing START does nothing; the motor will only run while somebody holds the STOP button down.',
      explanation: 'The stop contact was entered as XIC (examine-if-closed) instead of XIO, so the rung now REQUIRES the stop button to be pressed before power can reach the coil. ' +
        'A normally-open pushbutton reads OFF at rest, which blocks the rung permanently and inverts the button\'s meaning. ' +
        'Change the PB_STOP contact back to XIO — pass power while stop is NOT pressed — the classic stop-circuit form.',
      apply: function (prog) {
        var r = must0(findRung(prog, isType('XIO', 'PB_STOP')), 'XIO PB_STOP not found');
        var items = prog.rungs[r].items;
        items[findElem(items, isType('XIO', 'PB_STOP'))].t = 'XIC';
        prog.faultRungs = [r];
        return prog;
      }
    },

    /* ---------------- stoplight_basic ---------------- */
    {
      id: 'basic_yellow_preset',
      programId: 'stoplight_basic',
      title: 'N/S yellow preset mis-keyed: 0.3 s instead of 3 s',
      difficulty: 1,
      symptom: 'The N/S yellow barely flickers — the light jumps from N/S green almost straight to E/W green.',
      explanation: 'T_NSY\'s preset was keyed in as 300 ms instead of 3000 ms — a dropped zero, the single most common data-entry fault on real timers. ' +
        'The yellow step still runs, but its timer finishes in a third of a second, so the sequencer advances before the lamp has meaningfully shown. ' +
        'Set the preset back to 3000 ms; drivers need the full 3 s yellow change interval.',
      apply: function (prog) {
        var r = must0(findRung(prog, isType('TON', 'T_NSY')), 'TON T_NSY not found');
        var items = prog.rungs[r].items;
        items[findElem(items, isType('TON', 'T_NSY'))].pre = 300;
        prog.faultRungs = [r];
        return prog;
      }
    },

    {
      id: 'basic_double_coil',
      programId: 'stoplight_basic',
      title: 'Double-coiled output: a second OTE NS_YEL holds the lamp dark',
      difficulty: 2,
      symptom: 'The N/S yellow never lights — for 3 s each cycle the N/S heads are completely dark between green and red.',
      explanation: 'A leftover "lamp test" rung at the bottom of the program has a second OTE NS_YEL, driven by test bit B12 — which is never on. ' +
        'Both coils execute every scan and the LAST write wins, so the dead test rung overwrites the real yellow rung\'s 1 with a 0 on every single scan. ' +
        'Delete the stray rung (the validator\'s duplicate-coil warning points straight at it): one OTE per output, always.',
      apply: function (prog) {
        var r = must0(findRung(prog, isType('OTE', 'NS_YEL')), 'OTE NS_YEL rung not found');
        prog.rungs.push({
          comment: 'Lamp test circuit: force the N/S yellow from test bit B12 (left over from commissioning).',
          items: [{ t: 'XIC', tag: 'B12' }, { t: 'OTE', tag: 'NS_YEL' }]
        });
        prog.faultRungs = [r, prog.rungs.length - 1];
        return prog;
      }
    },

    {
      id: 'basic_no_interlock_overlap',
      programId: 'stoplight_basic',
      title: 'Cross-interlocks removed + STEP1 never unlatched: both greens',
      difficulty: 2,
      symptom: 'About 11 s after power-up BOTH directions show green at once and the sim flashes CONFLICT.',
      explanation: 'Two defects stacked: the OTU STEP1 was dropped from the green-done transition, so STEP1 stays latched while the sequencer marches on to STEP3 — two steps active together. ' +
        'That alone would have been caught by the XIO cross-interlock contacts on the two green rungs, but those were removed too, so when STEP1 and STEP3 overlap both greens genuinely energize. ' +
        'Restore the OTU STEP1 and put both interlock contacts back: the interlock exists precisely to make the sequencer bug survivable.',
      apply: function (prog) {
        var rt = must0(findRung(prog, isType('XIC', 'T_NSG.DN')), 'STEP1 transition rung not found');
        var ti = prog.rungs[rt].items;
        var iOtu = findElem(ti, isType('OTU', 'STEP1'));
        must(iOtu >= 0, 'OTU STEP1 not found on transition rung');
        ti.splice(iOtu, 1);

        var rn = must0(findRung(prog, isType('OTE', 'NS_GRN')), 'NS_GRN rung not found');
        var ni = prog.rungs[rn].items;
        var iIln = findElem(ni, isType('XIO', 'EW_GRN'));
        must(iIln >= 0, 'XIO EW_GRN interlock not found');
        ni.splice(iIln, 1);

        var re = must0(findRung(prog, isType('OTE', 'EW_GRN')), 'EW_GRN rung not found');
        var ei = prog.rungs[re].items;
        var iIle = findElem(ei, isType('XIO', 'NS_GRN'));
        must(iIle >= 0, 'XIO NS_GRN interlock not found');
        ei.splice(iIle, 1);

        prog.faultRungs = [rt, rn, re];
        return prog;
      }
    },

    {
      id: 'basic_rung_order',
      programId: 'stoplight_basic',
      title: 'Rung-order bug: transition rung moved above its timer',
      difficulty: 3,
      symptom: 'Nothing looks wrong at speed — but in step mode, every phase change happens one scan AFTER T_NSG.DN turns on, unlike the other three transitions.',
      explanation: 'The STEP1-to-STEP2 transition rung was dragged ABOVE the rung that runs T_NSG, so it now reads the timer\'s DN bit before this scan\'s timer update has happened — it always sees last scan\'s value. ' +
        'The transition therefore fires one full scan after the timer actually completes; at 20 ms per scan nobody sees it at speed, but single-stepping (or a scan-time-critical interlock) exposes it. ' +
        'Move the transition rung back below its timer so data flows down the ladder — the exact lesson of the Scan Order demos.',
      apply: function (prog) {
        var rTimer = must0(findRung(prog, isType('TON', 'T_NSG')), 'TON T_NSG rung not found');
        var rTrans = must0(findRung(prog, isType('XIC', 'T_NSG.DN')), 'T_NSG.DN transition rung not found');
        must(rTrans === rTimer + 1, 'unexpected rung layout for rung-order fault');
        var tmp = prog.rungs[rTimer];
        prog.rungs[rTimer] = prog.rungs[rTrans];
        prog.rungs[rTrans] = tmp;
        prog.faultRungs = [rTimer, rTrans];
        return prog;
      }
    },

    {
      id: 'basic_swstop_inverted',
      programId: 'stoplight_basic',
      title: 'XIC/XIO swapped on SW_STOP in the N/S green timer rung',
      difficulty: 2,
      symptom: 'The intersection sits in N/S green forever — yet turning the master stop ON makes the cycle advance invisibly behind the all-red.',
      explanation: 'The SW_STOP contact on the T_NSG rung was entered as XIC instead of XIO, so the 8 s green timer only runs while the master stop switch is ON — exactly backwards. ' +
        'With the switch off (normal operation) T_NSG never accumulates, the sequencer never leaves STEP1, and N/S holds green forever; flip the switch and the timer happily times while the lamps are forced all-red. ' +
        'Change the contact back to XIO so the timer runs whenever the master stop is NOT active.',
      apply: function (prog) {
        var r = must0(findRung(prog, isType('TON', 'T_NSG')), 'TON T_NSG rung not found');
        var items = prog.rungs[r].items;
        var i = findElem(items, isType('XIO', 'SW_STOP'));
        must(i >= 0, 'XIO SW_STOP not found on T_NSG rung');
        items[i].t = 'XIC';
        prog.faultRungs = [r];
        return prog;
      }
    },

    /* ---------------- stoplight_ped ---------------- */
    {
      id: 'ped_button_swapped',
      programId: 'stoplight_ped',
      title: 'XIC/XIO swapped on the PED_NS button',
      difficulty: 2,
      symptom: 'WALK_NS runs on every single N/S green even though nobody ever touches the pedestrian button.',
      explanation: 'The request rung reads the N/S pedestrian button through an XIO contact, which passes power whenever the button is NOT pressed — which is almost always. ' +
        'REQ_NS therefore latches immediately at power-up and re-latches every scan, so every N/S green begins with a request pending and grants a walk nobody asked for (and an actual press changes nothing visible). ' +
        'Make the contact XIC again: a normally-open button is examined-if-closed to detect a press.',
      apply: function (prog) {
        var r = must0(findRung(prog, isType('XIC', 'PED_NS')), 'XIC PED_NS rung not found');
        var items = prog.rungs[r].items;
        items[findElem(items, isType('XIC', 'PED_NS'))].t = 'XIO';
        prog.faultRungs = [r];
        return prog;
      }
    },

    {
      id: 'ped_walk_latched',
      programId: 'stoplight_ped',
      title: 'WALK_NS is never unlatched',
      difficulty: 2,
      symptom: 'The first N/S walk ever granted never ends — WALK_NS stays lit even while E/W traffic has the green.',
      explanation: 'The rung that unlatches WALK_NS when the 4 s walk timer finishes (XIC T_WNS.DN -> OTU WALK_NS) has been deleted, and an OTL latch holds its bit until something explicitly unlatches it. ' +
        'The timer still runs and completes, but its DN bit now drives nothing, so the latched walk sign survives into the E/W green — the exact hazard the walk timer exists to prevent. ' +
        'Re-add the unlatch rung below the walk timer: every OTL needs a matching OTU somewhere, and this one\'s partner went missing.',
      apply: function (prog) {
        var r = must0(findRung(prog, isType('XIC', 'T_WNS.DN')), 'T_WNS.DN unlatch rung not found');
        must(findElem(prog.rungs[r].items, isType('OTU', 'WALK_NS')) >= 0, 'unlatch rung shape unexpected');
        prog.rungs.splice(r, 1); // the whole unlatch rung is gone
        // Highlight the survivors around the hole: the grant rung and the walk timer rung.
        var rGrant = must0(findRung(prog, isType('OTL', 'WALK_NS')), 'WALK_NS grant rung not found');
        var rTimer = must0(findRung(prog, isType('TON', 'T_WNS')), 'T_WNS timer rung not found');
        prog.faultRungs = [rGrant, rTimer];
        return prog;
      }
    },

    /* ---------------- stoplight_sensor ---------------- */
    {
      id: 'sensor_loop_inverted',
      programId: 'stoplight_sensor',
      title: 'XIO instead of XIC on LOOP_EW',
      difficulty: 2,
      symptom: 'E/W gets a green when NO car is waiting, while a car sitting on the loop waits at the red forever.',
      explanation: 'The demand transition examines the loop with XIO, which passes power while the loop is EMPTY — the sensor\'s meaning is inverted. ' +
        'So an empty approach registers as demand (the light cycles away from N/S for nobody), while a car parked on the loop holds the contact open and blocks its own green indefinitely. ' +
        'Change the LOOP_EW contact to XIC so a PRESENT car is what satisfies the demand condition.',
      apply: function (prog) {
        var r = must0(findRung(prog, isType('XIC', 'LOOP_EW')), 'XIC LOOP_EW rung not found');
        var items = prog.rungs[r].items;
        items[findElem(items, isType('XIC', 'LOOP_EW'))].t = 'XIO';
        prog.faultRungs = [r];
        return prog;
      }
    },

    /* ---------------- stoplight_night ---------------- */
    {
      id: 'night_flash_solid',
      programId: 'stoplight_night',
      title: 'Flasher timer T_FA preset effectively zero: solid, not flashing',
      difficulty: 1,
      symptom: 'In night mode the N/S yellow and E/W red are supposed to flash 0.5 s on / 0.5 s off, but they burn steadily instead.',
      explanation: 'T_FA\'s preset was wiped to (effectively) zero — 1 ms, less than one 20 ms scan — so the "on" timer finishes instantly and its DN bit, which IS the flash, is only ever off for the single reset scan of each cycle. ' +
        'A two-timer flasher makes its off-time out of T_FA still timing; with nothing left to time, the blink collapses to a steady burn with an invisible 20 ms dropout every half second. ' +
        'Restore the 500 ms preset so T_FA\'s timing period becomes the off half of the blink again.',
      apply: function (prog) {
        var r = must0(findRung(prog, isType('TON', 'T_FA')), 'TON T_FA rung not found');
        var items = prog.rungs[r].items;
        // 1 ms, not literal 0: a zero preset is a validation ERROR the validator
        // would announce, giving the fault away. See the file header comment.
        items[findElem(items, isType('TON', 'T_FA'))].pre = 1;
        prog.faultRungs = [r];
        return prog;
      }
    }
  ];

  /** must0: like must() but for "index >= 0" lookups; returns the index. */
  function must0(idx, msg) {
    must(typeof idx === 'number' && idx >= 0, msg);
    return idx;
  }

  var byIdMap = {};
  list.forEach(function (f) { byIdMap[f.id] = f; });

  /**
   * applyById(id) -> a freshly patched program JSON. Deep-clones the
   * pristine program, runs the fault's transform, stamps `faultId` so the
   * app (and this panel) can recognize the patched program when it comes
   * back around on the 'program:loaded' bus event.
   */
  function applyById(id) {
    var f = byIdMap[id];
    must(!!f, 'unknown fault id "' + id + '"');
    must(!!(LL.Programs && LL.Programs.byId), 'LL.Programs is not loaded');
    var pristine = LL.Programs.byId(f.programId);
    must(!!pristine, 'fault "' + id + '" targets unknown program "' + f.programId + '"');
    var patched = f.apply(LL.Util.deepClone(pristine));
    patched.faultId = f.id;
    return patched;
  }

  /**
   * All element ids on the patched program's faultRungs. Ids are assigned
   * at PLC construction, so we build a throwaway PLC and read them off its
   * id-stamped program clone (branch path elements included).
   */
  function faultElemIds(patched) {
    var plc = new LL.Engine.PLC(patched);
    var ids = [];
    (patched.faultRungs || []).forEach(function (r) {
      var rung = plc.program.rungs[r];
      if (!rung || !Array.isArray(rung.items)) return;
      rung.items.forEach(function (el) {
        ids.push(el.id);
        if (el.t === 'BR' && Array.isArray(el.paths)) {
          el.paths.forEach(function (path) {
            (path || []).forEach(function (pel) { ids.push(pel.id); });
          });
        }
      });
    });
    return ids;
  }

  /* ----------------------------------------------------------------------
   * Troubleshoot panel UI
   * ----------------------------------------------------------------------
   * The panel talks to the app ONLY over ctx.bus:
   *   emits 'fault:injected' {programId, program: patchedJson}
   *        — the app loads the patched program into a new PLC.
   *   emits 'fault:revealed' {faultId, elemIds}
   *        — the ladder pane highlights the listed elements.
   * It listens for 'program:loaded' so that loading anything OTHER than
   * the active patched program abandons the exercise cleanly.
   *
   * The solve timer is wall-clock on purpose (spec: allowed for this UI —
   * it measures the student, not the simulation).
   * ------------------------------------------------------------------- */
  function initPanel(containerEl, ctx) {
    var state = {
      active: null,       // fault object currently injected
      patched: null,      // its patched program JSON
      startWall: 0,       // Date.now() at inject
      interval: null,     // solve-timer display updater
      clicks: 0,          // entropy stirrer for the random pick
      best: []            // [{title, ms}] — in-memory only, by design
    };

    containerEl.innerHTML =
      '<div class="flt-panel">' +
      '  <div class="flt-head"><span class="flt-lamp" aria-hidden="true"></span>TROUBLESHOOT</div>' +
      '  <div class="flt-status">No fault active. Inject one, then diagnose it from the ladder and the sim.</div>' +
      '  <div class="flt-controls">' +
      '    <button type="button" class="flt-btn flt-inject">Inject random fault</button>' +
      '    <button type="button" class="flt-btn flt-reveal" disabled>I’ve diagnosed it — reveal</button>' +
      '  </div>' +
      '  <div class="flt-timer" aria-label="solve timer">—</div>' +
      '  <details class="flt-teacher"><summary>teacher</summary>' +
      '    <div class="flt-teacher-row">' +
      '      <select class="flt-select" aria-label="choose a specific fault"></select>' +
      '      <button type="button" class="flt-btn flt-inject-specific">Inject specific…</button>' +
      '    </div>' +
      '  </details>' +
      '  <div class="flt-reveal-box" hidden></div>' +
      '  <div class="flt-best"><div class="flt-best-title">Best times</div><ol class="flt-best-list"></ol></div>' +
      '</div>';

    var $ = function (sel) { return containerEl.querySelector(sel); };
    var elStatus = $('.flt-status');
    var elTimer = $('.flt-timer');
    var elLamp = $('.flt-lamp');
    var btnInject = $('.flt-inject');
    var btnReveal = $('.flt-reveal');
    var btnSpecific = $('.flt-inject-specific');
    var selFault = $('.flt-select');
    var boxReveal = $('.flt-reveal-box');
    var listBest = $('.flt-best-list');

    // Teacher dropdown: every fault, labelled program / title / difficulty.
    list.forEach(function (f) {
      var opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.programId + ' — ' + f.title + ' (' + starRating(f.difficulty) + ')';
      selFault.appendChild(opt);
    });

    function starRating(d) { return '★★★'.slice(0, d); }

    function fmtMs(ms) {
      var s = ms / 1000;
      var m = Math.floor(s / 60);
      var rem = (s - m * 60);
      return m + ':' + (rem < 10 ? '0' : '') + rem.toFixed(1);
    }

    function currentProgramId() {
      try {
        var plc = ctx && typeof ctx.getPlc === 'function' ? ctx.getPlc() : null;
        return plc && plc.program ? plc.program.id : null;
      } catch (e) { return null; }
    }

    function stopTimer() {
      if (state.interval) { clearInterval(state.interval); state.interval = null; }
    }

    function startTimer() {
      stopTimer();
      state.startWall = Date.now();
      elTimer.textContent = '0:00.0';
      state.interval = setInterval(function () {
        elTimer.textContent = fmtMs(Date.now() - state.startWall);
      }, 100);
    }

    function inject(fault) {
      var patched = applyById(fault.id);
      state.active = fault;
      state.patched = patched;
      boxReveal.hidden = true;
      boxReveal.textContent = '';
      btnReveal.disabled = false;
      elLamp.className = 'flt-lamp flt-lamp-on';
      var progName = (LL.Programs.byId(fault.programId) || {}).name || fault.programId;
      elStatus.textContent = 'Fault active in “' + progName + '” — find it. (Difficulty ' + starRating(fault.difficulty) + ')';
      startTimer();
      if (ctx && ctx.bus) ctx.bus.emit('fault:injected', { programId: fault.programId, program: patched });
    }

    function injectRandom() {
      state.clicks += 1;
      var progId = currentProgramId();
      var candidates = list.filter(function (f) { return f.programId === progId; });
      if (candidates.length === 0) candidates = list;
      // Real entropy is explicitly allowed HERE and only here (spec: a user
      // choice, not sim logic). We still route it through LL.Util.rng rather
      // than Math.random (forbidden app-wide): wall clock + click count seed
      // a one-shot mulberry32 draw.
      var draw = LL.Util.rng((Date.now() ^ (state.clicks * 2654435761)) >>> 0)();
      inject(candidates[Math.floor(draw * candidates.length)]);
    }

    function reveal() {
      if (!state.active) return;
      stopTimer();
      var ms = Date.now() - state.startWall;
      var f = state.active;
      elTimer.textContent = fmtMs(ms);

      var ids = faultElemIds(state.patched);

      // Reveal card: title, difficulty, what you saw, what it was.
      boxReveal.textContent = '';
      var h = document.createElement('div');
      h.className = 'flt-reveal-title';
      h.textContent = f.title + '  (' + starRating(f.difficulty) + ')';
      var sym = document.createElement('p');
      sym.className = 'flt-reveal-symptom';
      sym.textContent = 'Symptom: ' + f.symptom;
      var exp = document.createElement('p');
      exp.className = 'flt-reveal-explanation';
      exp.textContent = f.explanation;
      var t = document.createElement('p');
      t.className = 'flt-reveal-time';
      t.textContent = 'Solved in ' + fmtMs(ms);
      boxReveal.appendChild(h); boxReveal.appendChild(sym); boxReveal.appendChild(exp); boxReveal.appendChild(t);
      boxReveal.hidden = false;

      state.best.push({ title: f.title, ms: ms });
      state.best.sort(function (a, b) { return a.ms - b.ms; });
      if (state.best.length > 8) state.best.length = 8;
      listBest.textContent = '';
      state.best.forEach(function (b) {
        var li = document.createElement('li');
        li.textContent = fmtMs(b.ms) + ' — ' + b.title;
        listBest.appendChild(li);
      });

      elLamp.className = 'flt-lamp';
      elStatus.textContent = 'Fault revealed — the patched rungs are highlighted in the ladder. Inject another to go again.';
      btnReveal.disabled = true;
      state.active = null;
      // state.patched intentionally kept: the app may still be running it.

      if (ctx && ctx.bus) ctx.bus.emit('fault:revealed', { faultId: f.id, elemIds: ids });
    }

    function abandon() {
      stopTimer();
      state.active = null;
      state.patched = null;
      btnReveal.disabled = true;
      elLamp.className = 'flt-lamp';
      elTimer.textContent = '—';
      boxReveal.hidden = true;
      elStatus.textContent = 'Fault abandoned (a different program was loaded). Inject a new one when ready.';
    }

    btnInject.addEventListener('click', injectRandom);
    btnReveal.addEventListener('click', reveal);
    btnSpecific.addEventListener('click', function () {
      var f = byIdMap[selFault.value];
      if (f) inject(f);
    });

    if (ctx && ctx.bus && typeof ctx.bus.on === 'function') {
      ctx.bus.on('program:loaded', function (data) {
        if (!state.active) return;
        var loaded = data && data.program;
        if (loaded && loaded.faultId === state.active.id) return; // that's our patch arriving
        abandon();
      });
    }
  }

  LL.Faults = {
    list: list,
    byId: function (id) { return byIdMap[id] || null; },
    applyById: applyById,
    faultElemIds: faultElemIds,
    initPanel: initPanel
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LL;
  }
})();
