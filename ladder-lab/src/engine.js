/*
 * Ladder Lab — engine.js
 * ----------------------
 * The PLC scan engine: window.LL.Engine (class PLC), LL.Validate, LL.Util.
 *
 * This file is written for students AND their teachers to read. It models a
 * real PLC scan cycle faithfully — no event-driven shortcuts anywhere:
 *
 *   1. INPUT SCAN  — latched physical inputs are copied into the input image.
 *   2. LOGIC       — rungs are solved strictly top-to-bottom; within a rung,
 *                    elements strictly left-to-right; branch paths top-to-bottom.
 *                    Every element is executed every scan (even on dead rungs —
 *                    that is how OTE de-energizes and TON resets). A bit written
 *                    by rung N is visible to rung N+1 in the SAME scan, but to
 *                    rung N-1 only on the NEXT scan.
 *   3. OUTPUT SCAN — the output image built during logic is committed to the
 *                    real outputs (plc.outputs()), which the sim pane reads.
 *   4. simTimeMs += scanMs; scanCount += 1.
 *
 * All timing is SIMULATED time: every scan advances the clock by exactly
 * scanMs milliseconds. Date.now() and Math.random() are never used, so a
 * given program + input script always behaves identically (deterministic).
 *
 * Runs in the browser (attaches to window.LL) and under node:
 *   node src/engine.js --test     -> runs the built-in unit test suite,
 *                                    prints results, exits 0 (pass) / 1 (fail).
 *   require('./engine.js')        -> exports the LL namespace for other tests.
 * In the browser, LL.Engine.runSelfTests() returns
 *   { passed, failed, results: [{name, pass, detail}] }.
 *
 * Plain ES2018, no dependencies.
 */
(function () {
  'use strict';

  // Shared namespace: attach to window.LL in the browser, or to a private
  // object under node (exported via module.exports at the bottom).
  var LL;
  if (typeof window !== 'undefined') {
    window.LL = window.LL || {};
    LL = window.LL;
  } else {
    LL = {};
  }

  /* ======================================================================
   * Fixed tag universe (see SPEC.md)
   * ==================================================================== */

  var INPUT_TAGS = [
    'PB_START', 'PB_STOP', 'PED_NS', 'PED_EW', 'LOOP_EW', 'SW_NIGHT', 'SW_STOP'
  ];
  var OUTPUT_TAGS = [
    'NS_GRN', 'NS_YEL', 'NS_RED', 'EW_GRN', 'EW_YEL', 'EW_RED',
    'WALK_NS', 'WALK_EW', 'MOTOR'
  ];

  // Fast lookup sets ({tag: true}).
  var INPUT_SET = {};
  var OUTPUT_SET = {};
  INPUT_TAGS.forEach(function (t) { INPUT_SET[t] = true; });
  OUTPUT_TAGS.forEach(function (t) { OUTPUT_SET[t] = true; });

  // Element type classes.
  var CONDITION_TYPES = { XIC: true, XIO: true, ONS: true };
  var OUTPUT_TYPES = { OTE: true, OTL: true, OTU: true, TON: true, TOF: true, CTU: true, CTD: true, RES: true };

  // Members readable through a "BASE.MEMBER" contact tag.
  var TIMER_MEMBERS = { EN: true, TT: true, DN: true };
  var COUNTER_MEMBERS = { DN: true, CU: true, CD: true };

  // Bare "T3" / "C2" style names count as timers/counters even if no timer or
  // counter instruction declares them (so `RES T3` or a `T3.DN` contact on an
  // as-yet-unprogrammed timer is legal). Any other bare name becomes a timer
  // or counter ONLY when a TON/TOF/CTU/CTD instruction uses it (e.g. T_NSG).
  var TIMER_NAME_RE = /^T\d+$/;
  var COUNTER_NAME_RE = /^C\d+$/;

  /* ======================================================================
   * LL.Util — deterministic helpers
   * ==================================================================== */

  /**
   * mulberry32 PRNG. rng(seed) returns a function producing floats in [0, 1).
   * Same seed => same sequence, forever. This is the ONLY allowed source of
   * randomness in the whole app (Math.random is forbidden by the spec).
   */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Deep clone of plain JSON-ish data (objects, arrays, primitives). */
  function deepClone(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(deepClone);
    var out = {};
    for (var k in value) {
      if (Object.prototype.hasOwnProperty.call(value, k)) out[k] = deepClone(value[k]);
    }
    return out;
  }

  LL.Util = { rng: rng, deepClone: deepClone };

  /* ======================================================================
   * Small shared helpers
   * ==================================================================== */

  /** Split "T1.DN" into {base:"T1", member:"DN"}; null for a plain tag. */
  function splitMember(tag) {
    var i = typeof tag === 'string' ? tag.indexOf('.') : -1;
    if (i < 0) return null;
    return { base: tag.slice(0, i), member: tag.slice(i + 1) };
  }

  /**
   * Walk every element of a program (including branch path contents).
   * cb(elem, rungIndex, inBranch). BR elements themselves are visited too
   * (with inBranch = false), then their path contents (inBranch = true).
   */
  function forEachElement(program, cb) {
    var rungs = (program && Array.isArray(program.rungs)) ? program.rungs : [];
    rungs.forEach(function (rung, r) {
      var items = Array.isArray(rung.items) ? rung.items : [];
      items.forEach(function (el) {
        cb(el, r, false);
        if (el.t === 'BR' && Array.isArray(el.paths)) {
          el.paths.forEach(function (path) {
            if (!Array.isArray(path)) return;
            path.forEach(function (pel) { cb(pel, r, true); });
          });
        }
      });
    });
  }

  /**
   * Scan a program for declared timers and counters: any tag used by a
   * TON/TOF is a timer, any tag used by a CTU/CTD is a counter. Bare
   * T#/C# names referenced via RES or a .member contact also register,
   * per the naming convention above. Returns {timers:{tag:pre}, counters:{tag:pre}}.
   */
  function collectDeclared(program) {
    var timers = {};   // tag -> last preset seen (ms)
    var counters = {}; // tag -> last preset seen (counts)
    forEachElement(program, function (el) {
      if (!el || typeof el.tag !== 'string') return;
      var pre = typeof el.pre === 'number' ? el.pre : 0;
      if (el.t === 'TON' || el.t === 'TOF') {
        timers[el.tag] = pre;
      } else if (el.t === 'CTU' || el.t === 'CTD') {
        if (!(el.tag in counters)) counters[el.tag] = pre;
        else counters[el.tag] = pre || counters[el.tag];
      } else if (el.t === 'RES') {
        if (TIMER_NAME_RE.test(el.tag) && !(el.tag in timers) && !(el.tag in counters)) timers[el.tag] = 0;
        if (COUNTER_NAME_RE.test(el.tag) && !(el.tag in timers) && !(el.tag in counters)) counters[el.tag] = 0;
      } else {
        // A contact like "T3.DN" on a bare-named timer/counter registers it.
        var m = splitMember(el.tag);
        if (m) {
          if (TIMER_NAME_RE.test(m.base) && !(m.base in timers) && !(m.base in counters)) timers[m.base] = 0;
          if (COUNTER_NAME_RE.test(m.base) && !(m.base in timers) && !(m.base in counters)) counters[m.base] = 0;
        }
      }
    });
    return { timers: timers, counters: counters };
  }

  /* ======================================================================
   * LL.Engine.PLC — the scan engine
   * ==================================================================== */

  /**
   * new LL.Engine.PLC(programJson, { scanMs: 20 })
   *
   * The program JSON is deep-cloned at load (the caller's object is never
   * mutated) and every element gets a stable id stored on the element:
   *   top-level:      "r{rung}.{index}"           e.g. "r0.2"
   *   inside branch:  "r{rung}.b{brIndex}p{path}.{index}"  e.g. "r2.b0p1.3"
   * plc.program exposes the id-stamped clone; plc.power is keyed by these ids
   * so the ladder renderer can highlight power flow per element.
   */
  function PLC(programJson, opts) {
    opts = opts || {};
    this.scanMs = (typeof opts.scanMs === 'number' && opts.scanMs > 0) ? opts.scanMs : 20;

    this.program = deepClone(programJson || {});
    if (!Array.isArray(this.program.rungs)) this.program.rungs = [];

    this._assignIds();

    // Declarations discovered at load: which tags are timers/counters, and
    // which plain tags are internal bits. Used to pre-build the data tables so
    // the watch window sees a stable tag list from scan 0.
    this._declared = collectDeclared(this.program);
    this._bitTags = this._collectBitTags();

    this.reset();
  }

  /** Stamp stable ids onto every element of the loaded program. */
  PLC.prototype._assignIds = function () {
    this.program.rungs.forEach(function (rung, r) {
      var items = Array.isArray(rung.items) ? rung.items : [];
      items.forEach(function (el, i) {
        el.id = 'r' + r + '.' + i;
        if (el.t === 'BR' && Array.isArray(el.paths)) {
          el.paths.forEach(function (path, p) {
            if (!Array.isArray(path)) return;
            path.forEach(function (pel, j) {
              pel.id = 'r' + r + '.b' + i + 'p' + p + '.' + j;
            });
          });
        }
      });
    });
  };

  /** Every plain tag the program touches that lives in the bit table. */
  PLC.prototype._collectBitTags = function () {
    var declared = this._declared;
    var tags = [];
    var seen = {};
    forEachElement(this.program, function (el) {
      if (!el || typeof el.tag !== 'string' || el.t === 'BR') return;
      var tag = el.tag;
      if (splitMember(tag)) return;                  // timer/counter member
      if (INPUT_SET[tag] || OUTPUT_SET[tag]) return; // physical I/O
      if (tag in declared.timers || tag in declared.counters) return;
      if (!seen[tag]) { seen[tag] = true; tags.push(tag); }
    });
    return tags;
  };

  /**
   * plc.reset() — return to the freshly-loaded state. Zeroes EVERYTHING:
   * bit/timer/counter tables, ONS storage, counter edge memory, both image
   * tables, committed outputs, scanCount, simTimeMs, power map, changedBits —
   * and clears the physical input latches too (per spec: reset clears
   * physical inputs, it does not keep them).
   */
  PLC.prototype.reset = function () {
    var self = this;

    this.scanCount = 0;
    this.simTimeMs = 0;

    // Physical inputs: latched values written by setPhysicalInput(), read only
    // at the input scan. _pulse holds one-scan minimum latches (pulseInput).
    this._physical = {};
    this._pulse = {};

    // Image tables. inputImage/outputImage are the working images the logic
    // reads/writes; _committed is what outputs() returns (updated only at the
    // output scan step — the sim never sees a half-solved scan).
    this.inputImage = {};
    INPUT_TAGS.forEach(function (t) { self.inputImage[t] = 0; });
    this.outputImage = {};
    this._committed = {};
    OUTPUT_TAGS.forEach(function (t) { self.outputImage[t] = 0; self._committed[t] = 0; });

    // Internal bit table (includes named bits like STEP1 and ONS storage bits).
    this.bits = {};
    this._bitTags.forEach(function (t) { self.bits[t] = 0; });

    // Timer and counter data tables.
    this.timers = {};
    Object.keys(this._declared.timers).forEach(function (t) {
      self.timers[t] = { EN: 0, TT: 0, DN: 0, ACC: 0, PRE: self._declared.timers[t] };
    });
    this.counters = {};
    Object.keys(this._declared.counters).forEach(function (t) {
      self.counters[t] = { CU: 0, CD: 0, DN: 0, ACC: 0, PRE: self._declared.counters[t] };
    });

    // Per-ELEMENT rising-edge memory for CTU/CTD, keyed by element id (two
    // counters on the same tag each keep their own edge bit — real behavior).
    this._edge = {};

    // Per-element power flow from the last scan: {elemId: {in:0|1, out:0|1}}.
    this.power = {};

    // "table:tag" strings that changed value during the last scan.
    this.changedBits = new Set();
  };

  /* ---------- physical inputs ---------- */

  /**
   * Latch a physical input. The value is NOT seen by logic until the next
   * scan's input read — exactly like wiring a real switch to an input card.
   */
  PLC.prototype.setPhysicalInput = function (tag, v) {
    this._physical[tag] = v ? 1 : 0;
  };

  /** The value the next input scan will read (latched OR pending pulse). */
  PLC.prototype.getPhysicalInput = function (tag) {
    return (this._physical[tag] || this._pulse[tag]) ? 1 : 0;
  };

  /**
   * plc.pulseInput(tag) — momentary press helper for the sim's pushbuttons.
   * Guarantees the input reads TRUE for at least the next ONE FULL SCAN, even
   * if the caller clears the physical latch before that scan runs (a fast
   * click between scans must never be lost). The pulse is consumed by the
   * next input scan; if the physical latch is still held (pointer still
   * down), the input simply stays true after the pulse is consumed.
   */
  PLC.prototype.pulseInput = function (tag) {
    this._pulse[tag] = 1;
  };

  /* ---------- tag read/write during logic ---------- */

  /** Read a contact tag (any bit tag, or a timer/counter .member). */
  PLC.prototype._readTag = function (tag) {
    if (typeof tag !== 'string' || !tag) return 0;
    var m = splitMember(tag);
    if (m) {
      var t = this.timers[m.base];
      if (t && TIMER_MEMBERS[m.member]) return t[m.member] ? 1 : 0;
      var c = this.counters[m.base];
      if (c && COUNTER_MEMBERS[m.member]) return c[m.member] ? 1 : 0;
      return 0; // unknown member — validator flags this; engine reads 0
    }
    if (INPUT_SET[tag]) return this.inputImage[tag] ? 1 : 0;
    if (OUTPUT_SET[tag]) return this.outputImage[tag] ? 1 : 0; // working image: enables same-scan seal-ins
    // Convenience: a bare timer/counter tag used as a contact reads its DN bit.
    if (this.timers[tag]) return this.timers[tag].DN ? 1 : 0;
    if (this.counters[tag]) return this.counters[tag].DN ? 1 : 0;
    return this.bits[tag] ? 1 : 0; // internal bit (undefined reads 0)
  };

  /** Write a coil tag into the appropriate table. */
  PLC.prototype._writeBit = function (tag, v) {
    if (typeof tag !== 'string' || !tag) return;
    v = v ? 1 : 0;
    if (OUTPUT_SET[tag]) { this.outputImage[tag] = v; return; }
    if (INPUT_SET[tag]) { this.inputImage[tag] = v; return; } // legal but pointless: overwritten next input scan
    this.bits[tag] = v;
  };

  /** Fetch (or create) the timer struct for a timer instruction. */
  PLC.prototype._timer = function (el) {
    var t = this.timers[el.tag];
    if (!t) t = this.timers[el.tag] = { EN: 0, TT: 0, DN: 0, ACC: 0, PRE: 0 };
    if (typeof el.pre === 'number') t.PRE = el.pre; // instruction's preset lives in the shared data table
    return t;
  };

  /** Fetch (or create) the counter struct for a counter instruction. */
  PLC.prototype._counter = function (el) {
    var c = this.counters[el.tag];
    if (!c) c = this.counters[el.tag] = { CU: 0, CD: 0, DN: 0, ACC: 0, PRE: 0 };
    if (typeof el.pre === 'number') c.PRE = el.pre;
    return c;
  };

  /* ---------- element solvers ---------- */

  /**
   * Solve a SERIES of elements with incoming power `powerIn`.
   * Returns the power at the right end of the series. Records {in, out} into
   * this.power for every element. EVERY element executes every scan — output
   * instructions execute with false rung-in too (that is what de-energizes an
   * OTE and resets a TON).
   */
  PLC.prototype._solveSeries = function (items, powerIn) {
    var p = powerIn ? 1 : 0;
    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      var pin = p;
      var pout;
      if (el.t === 'BR') {
        // Parallel branch: paths solved TOP TO BOTTOM (path 0 first), and
        // every path is ALWAYS fully executed for its side effects, even if
        // an earlier path already made the OR true. Branch out = OR of path outs.
        // (An empty path is a plain wire: its out equals the branch's in.)
        var anyOut = 0;
        var paths = Array.isArray(el.paths) ? el.paths : [];
        for (var pi = 0; pi < paths.length; pi++) {
          var pathOut = this._solveSeries(Array.isArray(paths[pi]) ? paths[pi] : [], pin);
          if (pathOut) anyOut = 1;
        }
        pout = anyOut;
      } else {
        pout = this._solveElement(el, pin);
      }
      this.power[el.id] = { in: pin, out: pout };
      p = pout;
    }
    return p;
  };

  /** Solve one non-branch element. Returns its outgoing power. */
  PLC.prototype._solveElement = function (el, pin) {
    var t, c, prev;
    switch (el.t) {

      // ---- condition class: pass/condition power -------------------------
      case 'XIC': // "examine if closed": passes power while the bit is ON
        return (pin && this._readTag(el.tag)) ? 1 : 0;

      case 'XIO': // "examine if open": passes power while the bit is OFF
        return (pin && !this._readTag(el.tag)) ? 1 : 0;

      case 'ONS': // one-shot: out is true for exactly one scan per rising edge
        // Storage bit lives in the bit table under el.tag (so it is visible
        // in the watch window, and reset() clears it).
        prev = this.bits[el.tag] ? 1 : 0;
        this.bits[el.tag] = pin ? 1 : 0;
        return (pin && !prev) ? 1 : 0;

      // ---- output class: execute, then PASS INCOMING POWER THROUGH -------
      // (AB-style, so several output instructions in series all fire from the
      //  same condition.)
      case 'OTE': // energize: bit := rung-in, EVERY scan it is solved
        this._writeBit(el.tag, pin);
        return pin;

      case 'OTL': // latch: set the bit while powered, else leave it alone
        if (pin) this._writeBit(el.tag, 1);
        return pin;

      case 'OTU': // unlatch: clear the bit while powered, else leave it alone
        if (pin) this._writeBit(el.tag, 0);
        return pin;

      case 'TON': // on-delay timer
        t = this._timer(el);
        t.EN = pin ? 1 : 0;
        if (pin) {
          t.ACC += this.scanMs;               // simulated time only
          if (t.ACC >= t.PRE) t.DN = 1;       // DN latches while rung stays true
          if (t.ACC > t.PRE) t.ACC = t.PRE;   // cap ACC at PRE for display
          t.TT = t.DN ? 0 : 1;                // "timer timing" until done
        } else {
          t.ACC = 0; t.DN = 0; t.TT = 0;      // false rung fully resets a TON
        }
        return pin;

      case 'TOF': // off-delay timer: DN true while rung true, times on falling
        t = this._timer(el);
        t.EN = pin ? 1 : 0;
        if (pin) {
          t.DN = 1; t.TT = 0; t.ACC = 0;
        } else if (t.DN) {
          t.TT = 1;
          t.ACC += this.scanMs;
          if (t.ACC >= t.PRE) {
            t.DN = 0; t.TT = 0;               // DN drops when the off-delay expires
            if (t.ACC > t.PRE) t.ACC = t.PRE; // cap for display
          }
        }
        return pin;

      case 'CTU': // count up on each RISING EDGE of rung-in
        c = this._counter(el);
        prev = this._edge[el.id] || 0;        // per-ELEMENT edge memory
        this._edge[el.id] = pin ? 1 : 0;
        c.CU = pin ? 1 : 0;
        if (pin && !prev) c.ACC += 1;         // ACC may pass PRE — no cap
        c.DN = (c.ACC >= c.PRE) ? 1 : 0;
        return pin;

      case 'CTD': // count down on each rising edge
        c = this._counter(el);
        prev = this._edge[el.id] || 0;
        this._edge[el.id] = pin ? 1 : 0;
        c.CD = pin ? 1 : 0;
        if (pin && !prev) c.ACC -= 1;
        c.DN = (c.ACC >= c.PRE) ? 1 : 0;
        return pin;

      case 'RES': // reset the targeted timer or counter while powered
        if (pin) {
          t = this.timers[el.tag];
          c = this.counters[el.tag];
          if (t) {
            t.ACC = 0; t.DN = 0; t.TT = 0; t.EN = 0;  // RES clears EN too; a true rung re-asserts it next scan
          } else if (c) {
            c.ACC = 0;
            c.DN = (c.ACC >= c.PRE) ? 1 : 0;  // DN recomputed from the new ACC
          }
          // No timer/counter with that name: validator flags it; engine no-ops.
        }
        return pin;

      default: // unknown element type: validator flags it; pass power through
        return pin;
    }
  };

  /* ---------- the scan cycle ---------- */

  /**
   * plc.scan() — one full, genuine scan cycle. See the header comment for the
   * four steps. Also rebuilds plc.power and plc.changedBits for the UI.
   */
  PLC.prototype.scan = function () {
    var self = this;
    var changed = new Set();
    var tag, i;

    /* ---- 1. INPUT SCAN -------------------------------------------------- */
    // Copy latched physical inputs into the input image. A pending pulse
    // (pulseInput) forces the tag true for this one scan, then is consumed.
    for (i = 0; i < INPUT_TAGS.length; i++) {
      tag = INPUT_TAGS[i];
      var v = (this._physical[tag] || this._pulse[tag]) ? 1 : 0;
      if (v !== (this.inputImage[tag] ? 1 : 0)) changed.add('I:' + tag);
      this.inputImage[tag] = v;
    }
    this._pulse = {}; // pulses satisfied their one-scan-minimum guarantee

    /* ---- snapshot internal state so we can report what changed ---------- */
    // Timer ACC is deliberately NOT tracked here: it changes every scan while
    // timing and would flood changedBits; the watch window reads ACC directly.
    // Only EN/TT/DN transitions are reported for timers.
    var bitsBefore = {};
    for (tag in this.bits) bitsBefore[tag] = this.bits[tag];
    var timersBefore = {};
    for (tag in this.timers) {
      timersBefore[tag] = { EN: this.timers[tag].EN, TT: this.timers[tag].TT, DN: this.timers[tag].DN };
    }
    var countersBefore = {};
    for (tag in this.counters) {
      countersBefore[tag] = { DN: this.counters[tag].DN, ACC: this.counters[tag].ACC };
    }

    /* ---- 2. LOGIC: solve rungs 0..N-1 in order -------------------------- */
    this.power = {};
    var rungs = this.program.rungs;
    for (i = 0; i < rungs.length; i++) {
      var items = Array.isArray(rungs[i].items) ? rungs[i].items : [];
      this._solveSeries(items, 1); // the left power rail is always hot
    }

    /* ---- report internal-state transitions ------------------------------ */
    for (tag in this.bits) {
      var before = Object.prototype.hasOwnProperty.call(bitsBefore, tag) ? bitsBefore[tag] : 0;
      if ((this.bits[tag] ? 1 : 0) !== (before ? 1 : 0)) changed.add('B:' + tag);
    }
    for (tag in this.timers) {
      var tb = timersBefore[tag] || { EN: 0, TT: 0, DN: 0 };
      var tn = this.timers[tag];
      if (tn.EN !== tb.EN) changed.add('T:' + tag + '.EN');
      if (tn.TT !== tb.TT) changed.add('T:' + tag + '.TT');
      if (tn.DN !== tb.DN) changed.add('T:' + tag + '.DN');
    }
    for (tag in this.counters) {
      var cb = countersBefore[tag] || { DN: 0, ACC: 0 };
      var cn = this.counters[tag];
      if (cn.DN !== cb.DN) changed.add('C:' + tag + '.DN');
      // Counter ACC only moves on an edge (never every scan), so reporting it
      // is useful for row-flash and cannot flood the set.
      if (cn.ACC !== cb.ACC) changed.add('C:' + tag + '.ACC');
    }

    /* ---- 3. OUTPUT SCAN: commit the output image ------------------------ */
    for (i = 0; i < OUTPUT_TAGS.length; i++) {
      tag = OUTPUT_TAGS[i];
      var ov = this.outputImage[tag] ? 1 : 0;
      if (ov !== (this._committed[tag] ? 1 : 0)) changed.add('O:' + tag);
      this._committed[tag] = ov;
    }

    /* ---- 4. advance simulated time -------------------------------------- */
    this.simTimeMs += this.scanMs;
    this.scanCount += 1;
    this.changedBits = changed;
  };

  /** Committed outputs (what the field devices / sim pane see). */
  PLC.prototype.outputs = function () {
    return this._committed;
  };

  /**
   * plc.tagList() — every tag the program touches plus all physical I/O.
   * Bit-like tags get {tag, kind, value}; timers/counters get {tag, kind, state}.
   */
  PLC.prototype.tagList = function () {
    var self = this;
    var list = [];
    INPUT_TAGS.forEach(function (t) {
      list.push({ tag: t, kind: 'I', value: self.inputImage[t] ? 1 : 0 });
    });
    OUTPUT_TAGS.forEach(function (t) {
      list.push({ tag: t, kind: 'O', value: self._committed[t] ? 1 : 0 });
    });
    Object.keys(this.bits).forEach(function (t) {
      list.push({ tag: t, kind: 'B', value: self.bits[t] ? 1 : 0 });
    });
    Object.keys(this.timers).forEach(function (t) {
      var s = self.timers[t];
      list.push({ tag: t, kind: 'T', state: { EN: s.EN, TT: s.TT, DN: s.DN, ACC: s.ACC, PRE: s.PRE } });
    });
    Object.keys(this.counters).forEach(function (t) {
      var s = self.counters[t];
      list.push({ tag: t, kind: 'C', state: { CU: s.CU, CD: s.CD, DN: s.DN, ACC: s.ACC, PRE: s.PRE } });
    });
    return list;
  };

  /* ======================================================================
   * LL.Validate — plain-English program checks
   * ==================================================================== */

  /**
   * LL.Validate.check(programJson) -> [{level:'error'|'warn', rung:i, msg}]
   * `rung` is the 0-based rung index (-1 for whole-program problems); the
   * message text uses human 1-based rung numbers ("Rung 3: ...").
   */
  function validateCheck(program) {
    var issues = [];
    function error(rung, msg) { issues.push({ level: 'error', rung: rung, msg: msg }); }
    function warn(rung, msg) { issues.push({ level: 'warn', rung: rung, msg: msg }); }
    function R(r) { return 'Rung ' + (r + 1); }

    if (!program || !Array.isArray(program.rungs)) {
      error(-1, 'This program has no rungs, so there is nothing to run. Add at least one rung.');
      return issues;
    }

    var declared = collectDeclared(program);
    var oteSightings = {};  // tag -> [rung indices]
    var onsSightings = {};  // storage tag -> [rung indices]

    function describe(el) {
      return el.t + (el.tag ? ' "' + el.tag + '"' : '');
    }

    function checkElement(el, r, inBranch) {
      if (!el || typeof el.t !== 'string') {
        error(r, R(r) + ': found a malformed element with no instruction type.');
        return;
      }

      if (el.t === 'BR') {
        if (inBranch) {
          error(r, R(r) + ': a branch is nested inside another branch. Ladder Lab branches cannot contain branches — restructure using extra rungs instead.');
          return; // do not descend; the walker below handles paths of top-level BRs
        }
        if (!Array.isArray(el.paths) || el.paths.length < 2) {
          error(r, R(r) + ': a branch needs at least 2 parallel paths, but this one has ' + (Array.isArray(el.paths) ? el.paths.length : 0) + '.');
        }
        return;
      }

      if (!CONDITION_TYPES[el.t] && !OUTPUT_TYPES[el.t]) {
        error(r, R(r) + ': "' + el.t + '" is not a known instruction. Valid instructions are XIC, XIO, ONS, OTE, OTL, OTU, TON, TOF, CTU, CTD, RES and BR.');
        return;
      }

      // Every non-branch element needs a tag.
      if (typeof el.tag !== 'string' || el.tag === '') {
        error(r, R(r) + ': a ' + el.t + ' instruction has no tag. Every contact and coil needs a tag name.');
        return;
      }

      var m = splitMember(el.tag);

      // Contacts (XIC/XIO) may reference timer/counter members like T1.DN.
      if (el.t === 'XIC' || el.t === 'XIO') {
        if (m) {
          var isTimerBase = (m.base in declared.timers) || TIMER_NAME_RE.test(m.base);
          var isCounterBase = (m.base in declared.counters) || COUNTER_NAME_RE.test(m.base);
          if (!isTimerBase && !isCounterBase) {
            error(r, R(r) + ': the contact reads "' + el.tag + '", but there is no timer or counter named "' + m.base + '" in this program.');
          } else if (isTimerBase && !TIMER_MEMBERS[m.member]) {
            error(r, R(r) + ': "' + el.tag + '" is not a readable timer bit. Use .EN, .TT or .DN (for example "' + m.base + '.DN").');
          } else if (!isTimerBase && isCounterBase && !COUNTER_MEMBERS[m.member]) {
            error(r, R(r) + ': "' + el.tag + '" is not a readable counter bit. Use .DN (for example "' + m.base + '.DN").');
          }
        } else if ((el.tag in declared.timers) || (el.tag in declared.counters)) {
          warn(r, R(r) + ': the contact reads "' + el.tag + '" directly, which is a whole timer/counter. You probably want a member bit like "' + el.tag + '.DN".');
        }
        return;
      }

      // ONS: tag is a private storage bit — must be a plain internal bit.
      if (el.t === 'ONS') {
        if (m) {
          error(r, R(r) + ': ONS storage must be a plain bit tag, not a timer/counter member like "' + el.tag + '".');
          return;
        }
        if (INPUT_SET[el.tag] || OUTPUT_SET[el.tag]) {
          warn(r, R(r) + ': ONS uses "' + el.tag + '" for storage, but that is a physical I/O point. Give each ONS a private internal bit (e.g. B7) instead.');
        }
        (onsSightings[el.tag] = onsSightings[el.tag] || []).push(r);
        return;
      }

      // Coils and boxes must not target a .member.
      if (m && el.t !== 'RES') {
        error(r, R(r) + ': ' + describe(el) + ' cannot write to a timer/counter member bit. Only whole bits and outputs can be coil targets.');
        return;
      }

      if (el.t === 'OTE') {
        (oteSightings[el.tag] = oteSightings[el.tag] || []).push(r);
      }

      if ((el.t === 'OTE' || el.t === 'OTL' || el.t === 'OTU') && INPUT_SET[el.tag]) {
        warn(r, R(r) + ': ' + describe(el) + ' writes to a physical INPUT. The input scan overwrites it at the start of every scan, so this coil has no lasting effect.');
      }
      if ((el.t === 'OTE' || el.t === 'OTL' || el.t === 'OTU') && ((el.tag in declared.timers) || (el.tag in declared.counters))) {
        error(r, R(r) + ': ' + describe(el) + ' writes to "' + el.tag + '", which is a timer/counter in this program. Coils can only write bits and outputs.');
      }

      // Timer/counter boxes need a usable preset.
      if (el.t === 'TON' || el.t === 'TOF' || el.t === 'CTU' || el.t === 'CTD') {
        var unit = (el.t === 'TON' || el.t === 'TOF') ? 'milliseconds' : 'counts';
        if (typeof el.pre !== 'number' || el.pre <= 0) {
          error(r, R(r) + ': ' + describe(el) + ' has a missing or zero preset. Give it a preset in ' + unit +
            ((el.t === 'TON' || el.t === 'TOF') ? ' (for example 5000 for five seconds).' : ' (for example 4).'));
        }
      }

      // RES must point at something resettable.
      if (el.t === 'RES') {
        var target = el.tag;
        var known = (target in declared.timers) || (target in declared.counters) ||
          TIMER_NAME_RE.test(target) || COUNTER_NAME_RE.test(target);
        if (!known) {
          error(r, R(r) + ': RES targets "' + target + '", but there is no timer or counter with that name to reset.');
        }
      }
    }

    program.rungs.forEach(function (rung, r) {
      var items = (rung && Array.isArray(rung.items)) ? rung.items : [];
      if (items.length === 0) {
        warn(r, R(r) + ' is empty — it does nothing. Add instructions or delete it.');
        return;
      }
      items.forEach(function (el) {
        checkElement(el, r, false);
        if (el && el.t === 'BR' && Array.isArray(el.paths)) {
          el.paths.forEach(function (path) {
            if (!Array.isArray(path)) return;
            path.forEach(function (pel) { checkElement(pel, r, true); });
          });
        }
      });
    });

    // Duplicate OTE coils: both execute every scan, so the one solved last
    // wins ("last write wins") — the earlier coil can never hold the output.
    Object.keys(oteSightings).forEach(function (tag) {
      var rungsSeen = oteSightings[tag];
      if (rungsSeen.length > 1) {
        var human = rungsSeen.map(function (r) { return r + 1; }).join(' and ');
        warn(rungsSeen[rungsSeen.length - 1],
          'The output "' + tag + '" is written by an OTE coil on rungs ' + human +
          '. Both coils run every scan, so the LAST one solved wins and the earlier one has no effect. Use one OTE per output (branch the conditions instead).');
      }
    });

    // ONS storage bits must be unique per ONS instruction.
    Object.keys(onsSightings).forEach(function (tag) {
      var rungsSeen = onsSightings[tag];
      if (rungsSeen.length > 1) {
        var human2 = rungsSeen.map(function (r) { return r + 1; }).join(' and ');
        error(rungsSeen[rungsSeen.length - 1],
          'The storage bit "' + tag + '" is shared by more than one ONS (rungs ' + human2 +
          '). Each one-shot needs its own private storage bit, or they will interfere with each other.');
      }
    });

    return issues;
  }

  LL.Validate = { check: validateCheck };

  /* ======================================================================
   * Built-in unit test suite
   * ----------------------------------------------------------------------
   * Exposed as LL.Engine.runSelfTests() (used by ?selftest=1 in the browser)
   * and executed by `node src/engine.js --test` / src/engine.test.js.
   * ==================================================================== */

  // -- tiny test helpers --------------------------------------------------

  function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'assertion failed');
  }
  function assertEq(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error((msg || 'assertEq') + ' — expected ' + JSON.stringify(expected) +
        ', got ' + JSON.stringify(actual));
    }
  }

  /** Build a program JSON from an array of rung item-arrays. */
  function P() {
    var rungs = [];
    for (var i = 0; i < arguments.length; i++) rungs.push({ items: arguments[i] });
    return { id: 'test', name: 'test program', rungs: rungs };
  }
  // Element shorthands for readable test programs.
  function XIC(tag) { return { t: 'XIC', tag: tag }; }
  function XIO(tag) { return { t: 'XIO', tag: tag }; }
  function ONS(tag) { return { t: 'ONS', tag: tag }; }
  function OTE(tag) { return { t: 'OTE', tag: tag }; }
  function OTL(tag) { return { t: 'OTL', tag: tag }; }
  function OTU(tag) { return { t: 'OTU', tag: tag }; }
  function TON(tag, pre) { return { t: 'TON', tag: tag, pre: pre }; }
  function TOF(tag, pre) { return { t: 'TOF', tag: tag, pre: pre }; }
  function CTU(tag, pre) { return { t: 'CTU', tag: tag, pre: pre }; }
  function RES(tag) { return { t: 'RES', tag: tag }; }
  function BR() { return { t: 'BR', paths: Array.prototype.slice.call(arguments) }; }

  /** Scan until predicate() is true; returns the scanCount at which it first
   *  held, or -1 if it never did within maxScans. */
  function scanUntil(plc, predicate, maxScans) {
    for (var i = 0; i < maxScans; i++) {
      plc.scan();
      if (predicate()) return plc.scanCount;
    }
    return -1;
  }

  var TESTS = [

    /* 1 ------------------------------------------------------------------ */
    { name: 'TON 5000ms @ scanMs=20: DN exactly at true-scan 250, TT while timing, full reset on false', fn: function () {
      var plc = new PLC(P([XIC('PB_START'), TON('T1', 5000)]), { scanMs: 20 });
      plc.setPhysicalInput('PB_START', 1);

      for (var i = 0; i < 249; i++) plc.scan();
      var t = plc.timers.T1;
      assertEq(t.ACC, 4980, 'ACC after 249 true scans');
      assertEq(t.DN, 0, 'DN must still be 0 one scan before the preset');
      assertEq(t.TT, 1, 'TT true while timing');
      assertEq(t.EN, 1, 'EN follows the rung');

      plc.scan(); // true-scan 250: ACC reaches exactly 5000
      assertEq(t.ACC, 5000, 'ACC at the done scan');
      assertEq(t.DN, 1, 'DN must go true exactly at scan 250');
      assertEq(t.TT, 0, 'TT drops when done');
      assert(plc.changedBits.has('T:T1.DN'), 'changedBits reports the DN transition');
      assert(plc.changedBits.has('T:T1.TT'), 'changedBits reports the TT transition');

      plc.scan(); plc.scan(); // DN latches while the rung stays true; ACC capped
      assertEq(t.ACC, 5000, 'ACC capped at PRE for display');
      assertEq(t.DN, 1, 'DN latched while rung true');

      plc.setPhysicalInput('PB_START', 0);
      plc.scan();
      assertEq(t.ACC, 0, 'ACC resets when rung goes false');
      assertEq(t.DN, 0, 'DN resets');
      assertEq(t.TT, 0, 'TT resets');
      assertEq(t.EN, 0, 'EN follows the rung down');
    } },

    /* 2 ------------------------------------------------------------------ */
    { name: 'TOF 1000ms @ scanMs=20: DN true while rung true, times on falling edge, DN drops exactly at PRE', fn: function () {
      var plc = new PLC(P([XIC('PB_START'), TOF('T2', 1000)]), { scanMs: 20 });
      var t;

      plc.setPhysicalInput('PB_START', 1);
      plc.scan();
      t = plc.timers.T2;
      assertEq(t.DN, 1, 'TOF DN true immediately while rung true');
      assertEq(t.TT, 0, 'not timing while rung true');
      assertEq(t.ACC, 0, 'ACC held at 0 while rung true');
      assertEq(t.EN, 1, 'EN follows rung');
      plc.scan(); plc.scan();
      assertEq(t.DN, 1, 'DN stays true while rung true');

      plc.setPhysicalInput('PB_START', 0);
      for (var k = 1; k <= 49; k++) { // 49 false scans: still inside the off-delay
        plc.scan();
        assertEq(t.DN, 1, 'DN must stay true during the off-delay (false scan ' + k + ')');
        assertEq(t.TT, 1, 'TT true while timing out (false scan ' + k + ')');
        assertEq(t.ACC, 20 * k, 'ACC accumulates on false scans');
      }
      plc.scan(); // 50th false scan: ACC reaches 1000 exactly
      assertEq(t.ACC, 1000, 'ACC at expiry');
      assertEq(t.DN, 0, 'DN drops exactly at PRE');
      assertEq(t.TT, 0, 'TT drops at PRE');
      plc.scan();
      assertEq(t.DN, 0, 'DN stays down afterwards');
      assertEq(t.ACC, 1000, 'ACC frozen after expiry');

      plc.setPhysicalInput('PB_START', 1); // re-true: DN back, ACC cleared
      plc.scan();
      assertEq(t.DN, 1, 'DN true again on new rising edge');
      assertEq(t.ACC, 0, 'ACC cleared on new rising edge');
    } },

    /* 3 ------------------------------------------------------------------ */
    { name: 'Seal-in circuit: 1-scan start pulse latches MOTOR, stop pulse drops it', fn: function () {
      var plc = new PLC(P([BR([XIC('PB_START')], [XIC('MOTOR')]), XIO('PB_STOP'), OTE('MOTOR')]), { scanMs: 20 });

      plc.scan();
      assertEq(plc.outputs().MOTOR, 0, 'MOTOR off before start');

      plc.pulseInput('PB_START'); // momentary: guaranteed one full scan
      plc.scan();
      assertEq(plc.outputs().MOTOR, 1, 'MOTOR on at the start scan');

      for (var i = 0; i < 10; i++) plc.scan(); // button long released
      assertEq(plc.outputs().MOTOR, 1, 'MOTOR sealed in after button release');

      plc.pulseInput('PB_STOP');
      plc.scan();
      assertEq(plc.outputs().MOTOR, 0, 'MOTOR drops at the stop scan');
      for (var j = 0; j < 5; j++) plc.scan();
      assertEq(plc.outputs().MOTOR, 0, 'MOTOR stays off after stop');
    } },

    /* 4 ------------------------------------------------------------------ */
    { name: 'Scan order: echo-before-source lags one scan; source-before-echo updates same scan', fn: function () {
      // Program A: rung1 echoes B_SRC, rung2 derives B_SRC from the button.
      // Rung1 runs BEFORE B_SRC is written, so the echo lags by one scan.
      var pa = new PLC(P([XIC('B_SRC'), OTE('B_ECHO')], [XIC('PB_START'), OTE('B_SRC')]), { scanMs: 20 });
      pa.setPhysicalInput('PB_START', 1);
      var aSrc = scanUntil(pa, function () { return pa.bits.B_SRC === 1; }, 10);
      var aEcho = scanUntil(pa, function () { return pa.bits.B_ECHO === 1; }, 10);
      assert(aSrc > 0, 'A: B_SRC must turn on');
      assert(aEcho > 0, 'A: B_ECHO must turn on');

      // Program B: same two rungs, swapped. B_SRC is written FIRST, so the
      // echo rung sees it within the SAME scan.
      var pb = new PLC(P([XIC('PB_START'), OTE('B_SRC')], [XIC('B_SRC'), OTE('B_ECHO')]), { scanMs: 20 });
      pb.setPhysicalInput('PB_START', 1);
      pb.scan();
      var bSrc = pb.bits.B_SRC;
      var bEcho = pb.bits.B_ECHO;

      assertEq(aEcho - aSrc, 1, 'A: B_ECHO must lag B_SRC by exactly ONE scan');
      assertEq(bSrc, 1, 'B: B_SRC on in the first scan');
      assertEq(bEcho, 1, 'B: B_ECHO on in the SAME scan as B_SRC');
    } },

    /* 5 ------------------------------------------------------------------ */
    { name: 'ONS fires exactly one scan per rising edge; two ONS with separate storage are independent', fn: function () {
      var plc = new PLC(P(
        [XIC('PB_START'), ONS('B7'), OTE('B_OUT1')],
        [XIC('SW_NIGHT'), ONS('B8'), OTE('B_OUT2')]
      ), { scanMs: 20 });

      plc.setPhysicalInput('PB_START', 1);
      plc.scan();
      assertEq(plc.bits.B_OUT1, 1, 'ONS output true on the edge scan');
      plc.scan();
      assertEq(plc.bits.B_OUT1, 0, 'ONS output false on the second held scan');
      plc.scan();
      assertEq(plc.bits.B_OUT1, 0, 'still false while held');

      plc.setPhysicalInput('PB_START', 0);
      plc.scan();
      assertEq(plc.bits.B_OUT1, 0, 'false after release');
      plc.setPhysicalInput('PB_START', 1);
      plc.scan();
      assertEq(plc.bits.B_OUT1, 1, 'fires again on a new rising edge');

      // Independence: with the first ONS storage bit set (button held),
      // the second ONS must still fire normally on its own input's edge.
      assertEq(plc.bits.B7, 1, 'first ONS storage holds while its input is held');
      plc.setPhysicalInput('SW_NIGHT', 1);
      plc.scan();
      assertEq(plc.bits.B_OUT2, 1, 'second ONS fires on its own edge');
      assertEq(plc.bits.B_OUT1, 0, 'first ONS unaffected by second');
      plc.scan();
      assertEq(plc.bits.B_OUT2, 0, 'second ONS one scan only');
    } },

    /* 6 ------------------------------------------------------------------ */
    { name: 'CTU counts rising edges only, DN at PRE, ACC passes PRE, RES zeroes', fn: function () {
      var plc = new PLC(P([XIC('PB_START'), CTU('C1', 3)], [XIC('SW_STOP'), RES('C1')]), { scanMs: 20 });
      var c = plc.counters.C1;

      function press() { // press and hold for 3 scans, then release for 2
        plc.setPhysicalInput('PB_START', 1);
        plc.scan(); plc.scan(); plc.scan();
        plc.setPhysicalInput('PB_START', 0);
        plc.scan(); plc.scan();
      }

      press();
      assertEq(c.ACC, 1, 'one count per press, however long it is held');
      assertEq(c.DN, 0, 'DN off below preset');
      press();
      assertEq(c.ACC, 2, 'second press counts once');
      press();
      assertEq(c.ACC, 3, 'third press counts once');
      assertEq(c.DN, 1, 'DN on exactly at PRE');
      press();
      assertEq(c.ACC, 4, 'ACC may pass PRE');
      assertEq(c.DN, 1, 'DN stays on above PRE');

      plc.setPhysicalInput('SW_STOP', 1);
      plc.scan();
      assertEq(c.ACC, 0, 'RES zeroes the accumulator');
      assertEq(c.DN, 0, 'RES recomputes DN from ACC=0');
    } },

    /* 7 ------------------------------------------------------------------ */
    { name: 'OTL/OTU latch behavior; when both fire in one scan the later one wins', fn: function () {
      // Latch persistence.
      var plc = new PLC(P([XIC('PB_START'), OTL('B_L')], [XIC('SW_STOP'), OTU('B_L')]), { scanMs: 20 });
      plc.pulseInput('PB_START');
      plc.scan();
      assertEq(plc.bits.B_L, 1, 'OTL sets the bit');
      for (var i = 0; i < 5; i++) plc.scan();
      assertEq(plc.bits.B_L, 1, 'latched bit holds with no rung power');
      plc.pulseInput('SW_STOP');
      plc.scan();
      assertEq(plc.bits.B_L, 0, 'OTU clears the latch');

      // Both fire in the same scan: execution order decides — later wins.
      var pa = new PLC(P([XIC('PB_START'), OTL('BX')], [XIC('PB_START'), OTU('BX')]), { scanMs: 20 });
      pa.setPhysicalInput('PB_START', 1);
      pa.scan();
      assertEq(pa.bits.BX, 0, 'OTL then OTU in one scan: OTU (later) wins');

      var pb = new PLC(P([XIC('PB_START'), OTU('BY')], [XIC('PB_START'), OTL('BY')]), { scanMs: 20 });
      pb.setPhysicalInput('PB_START', 1);
      pb.scan();
      assertEq(pb.bits.BY, 1, 'OTU then OTL in one scan: OTL (later) wins');
    } },

    /* 8 ------------------------------------------------------------------ */
    { name: 'Two OTE coils on the same output: both execute, last write wins in the committed image', fn: function () {
      var plc = new PLC(P([XIC('PB_START'), OTE('MOTOR')], [XIC('SW_NIGHT'), OTE('MOTOR')]), { scanMs: 20 });

      plc.setPhysicalInput('PB_START', 1); // first coil says ON, second says OFF
      plc.setPhysicalInput('SW_NIGHT', 0);
      plc.scan();
      assertEq(plc.outputs().MOTOR, 0, 'later OTE (off) overwrites earlier OTE (on)');
      // Both really executed: the power map shows the first coil energized.
      assertEq(plc.power['r0.1'].in, 1, 'first OTE received power');
      assertEq(plc.power['r1.1'].in, 0, 'second OTE received no power');

      plc.setPhysicalInput('PB_START', 0);
      plc.setPhysicalInput('SW_NIGHT', 1); // now only the later coil says ON
      plc.scan();
      assertEq(plc.outputs().MOTOR, 1, 'later OTE (on) wins');
    } },

    /* 9 ------------------------------------------------------------------ */
    { name: 'changedBits reports I:/B:/O: transitions once, and stays empty on steady scans', fn: function () {
      var plc = new PLC(P([XIC('PB_START'), OTE('B_FLAG')], [XIC('B_FLAG'), OTE('MOTOR')]), { scanMs: 20 });

      plc.scan();
      assertEq(plc.changedBits.size, 0, 'nothing changed on an idle scan');

      plc.setPhysicalInput('PB_START', 1);
      plc.scan();
      assert(plc.changedBits.has('I:PB_START'), 'input transition reported');
      assert(plc.changedBits.has('B:B_FLAG'), 'bit transition reported');
      assert(plc.changedBits.has('O:MOTOR'), 'output transition reported');
      assertEq(plc.changedBits.size, 3, 'exactly the three transitions reported');

      plc.scan();
      assertEq(plc.changedBits.size, 0, 'steady state reports nothing');

      plc.setPhysicalInput('PB_START', 0);
      plc.scan();
      assert(plc.changedBits.has('I:PB_START') && plc.changedBits.has('B:B_FLAG') && plc.changedBits.has('O:MOTOR'),
        'falling transitions reported too');
    } },

    /* 10 ----------------------------------------------------------------- */
    { name: 'Branch side effects: TON on the second path accumulates even when the first path is already true', fn: function () {
      var plc = new PLC(P([BR([XIC('PB_START')], [XIC('PB_START'), TON('T3', 10000)]), OTE('MOTOR')]), { scanMs: 20 });
      plc.setPhysicalInput('PB_START', 1);
      for (var i = 0; i < 5; i++) plc.scan();
      assertEq(plc.outputs().MOTOR, 1, 'branch OR passes power');
      assertEq(plc.timers.T3.ACC, 100, 'second path executed every scan despite first path being true');
      assertEq(plc.timers.T3.EN, 1, 'TON enabled on its path');
    } },

    /* 11 ----------------------------------------------------------------- */
    { name: 'Validate: duplicate OTE, zero/missing preset, missing tag, ONS reuse, thin branch, bad RES, unknown member', fn: function () {
      function msgsOf(issues) { return issues.map(function (x) { return x.msg; }).join(' | '); }
      function allWellFormed(issues) {
        issues.forEach(function (x) {
          assert(x.level === 'error' || x.level === 'warn', 'level must be error|warn');
          assert(typeof x.rung === 'number', 'rung index present');
          assert(typeof x.msg === 'string' && x.msg.length > 10, 'plain-English message non-empty');
        });
      }

      // Duplicate OTE.
      var dup = validateCheck(P([XIC('PB_START'), OTE('MOTOR')], [XIC('SW_NIGHT'), OTE('MOTOR')]));
      allWellFormed(dup);
      assert(dup.some(function (x) { return x.msg.indexOf('MOTOR') >= 0 && /last/i.test(x.msg); }),
        'duplicate OTE detected with a last-write-wins explanation: ' + msgsOf(dup));

      // Zero and missing presets.
      var zp = validateCheck(P([XIC('PB_START'), TON('T1', 0)], [XIC('PB_START'), { t: 'CTU', tag: 'C1' }]));
      allWellFormed(zp);
      assertEq(zp.filter(function (x) { return x.level === 'error' && /preset/i.test(x.msg); }).length, 2,
        'zero TON preset and missing CTU preset both flagged: ' + msgsOf(zp));

      // Missing tag.
      var mt = validateCheck(P([{ t: 'XIC' }, OTE('MOTOR')]));
      allWellFormed(mt);
      assert(mt.some(function (x) { return x.level === 'error' && /tag/i.test(x.msg); }),
        'missing tag detected: ' + msgsOf(mt));

      // ONS storage reuse.
      var or = validateCheck(P([XIC('PB_START'), ONS('B7'), OTE('B1')], [XIC('SW_NIGHT'), ONS('B7'), OTE('B2')]));
      allWellFormed(or);
      assert(or.some(function (x) { return x.level === 'error' && x.msg.indexOf('B7') >= 0; }),
        'ONS storage reuse detected: ' + msgsOf(or));

      // Branch with fewer than 2 paths.
      var tb = validateCheck(P([BR([XIC('PB_START')]), OTE('MOTOR')]));
      allWellFormed(tb);
      assert(tb.some(function (x) { return x.level === 'error' && /path/i.test(x.msg); }),
        'thin branch detected: ' + msgsOf(tb));

      // RES with no matching timer/counter.
      var br = validateCheck(P([XIC('PB_START'), RES('B5')]));
      allWellFormed(br);
      assert(br.some(function (x) { return x.level === 'error' && x.msg.indexOf('B5') >= 0; }),
        'bad RES target detected: ' + msgsOf(br));

      // Contact on a member of a non-existent timer.
      var um = validateCheck(P([XIC('FOO.DN'), OTE('MOTOR')]));
      allWellFormed(um);
      assert(um.some(function (x) { return x.level === 'error' && x.msg.indexOf('FOO') >= 0; }),
        'unknown member base detected: ' + msgsOf(um));

      // Empty rung warns.
      var er = validateCheck(P([XIC('PB_START'), OTE('MOTOR')], []));
      allWellFormed(er);
      assert(er.some(function (x) { return x.level === 'warn' && /empty/i.test(x.msg); }),
        'empty rung warned: ' + msgsOf(er));

      // A clean program produces no issues at all.
      var ok = validateCheck(P([BR([XIC('PB_START')], [XIC('MOTOR')]), XIO('PB_STOP'), OTE('MOTOR')]));
      assertEq(ok.length, 0, 'clean seal-in program validates clean: ' + msgsOf(ok));
    } },

    /* 12 ----------------------------------------------------------------- */
    { name: 'pulseInput guarantees one full scan even if the latch is cleared first; consumed after one scan', fn: function () {
      var plc = new PLC(P([XIC('PB_START'), OTE('MOTOR')]), { scanMs: 20 });
      plc.pulseInput('PB_START');
      plc.setPhysicalInput('PB_START', 0); // "released" before the scan ran
      assertEq(plc.getPhysicalInput('PB_START'), 1, 'pending pulse visible via getPhysicalInput');
      plc.scan();
      assertEq(plc.inputImage.PB_START, 1, 'pulse forces the input image true for the whole scan');
      assertEq(plc.outputs().MOTOR, 1, 'logic saw the press');
      plc.scan();
      assertEq(plc.inputImage.PB_START, 0, 'pulse consumed after one scan');
      assertEq(plc.outputs().MOTOR, 0, 'output follows');
    } },

    /* 13 ----------------------------------------------------------------- */
    { name: 'Element ids are stable and stored on elements; power map keyed by them with correct in/out', fn: function () {
      var plc = new PLC(P([BR([XIC('PB_START')], [XIC('MOTOR')]), XIO('PB_STOP'), OTE('MOTOR')]), { scanMs: 20 });
      var items = plc.program.rungs[0].items;
      assertEq(items[0].id, 'r0.0', 'branch element id');
      assertEq(items[0].paths[0][0].id, 'r0.b0p0.0', 'path 0 element id');
      assertEq(items[0].paths[1][0].id, 'r0.b0p1.0', 'path 1 element id');
      assertEq(items[1].id, 'r0.1', 'series element id');
      assertEq(items[2].id, 'r0.2', 'coil id');

      plc.pulseInput('PB_START');
      plc.scan();
      assertEq(plc.power['r0.0'].in, 1, 'branch fed from the hot rail');
      assertEq(plc.power['r0.0'].out, 1, 'branch OR true');
      assertEq(plc.power['r0.b0p0.0'].out, 1, 'start contact conducting');
      assertEq(plc.power['r0.b0p1.0'].out, 0, 'seal contact not yet conducting (MOTOR image was 0 when read)');
      assertEq(plc.power['r0.1'].out, 1, 'XIO PB_STOP conducting');
      assertEq(plc.power['r0.2'].in, 1, 'coil energized');
      assertEq(plc.power['r0.2'].out, 1, 'output class passes power through');

      plc.scan(); // sealed now
      assertEq(plc.power['r0.b0p1.0'].out, 1, 'seal-in contact conducting on the next scan');
    } },

    /* 14 ----------------------------------------------------------------- */
    { name: 'reset() re-initializes everything including physical input latches and pulses', fn: function () {
      var plc = new PLC(P([BR([XIC('PB_START')], [XIC('MOTOR')]), XIO('PB_STOP'), OTE('MOTOR')],
        [XIC('MOTOR'), TON('T1', 1000)]), { scanMs: 20 });
      plc.setPhysicalInput('PB_START', 1);
      for (var i = 0; i < 10; i++) plc.scan();
      assertEq(plc.outputs().MOTOR, 1, 'motor running before reset');
      assert(plc.timers.T1.ACC > 0, 'timer accumulated before reset');
      plc.pulseInput('PED_NS');

      plc.reset();
      assertEq(plc.scanCount, 0, 'scanCount zeroed');
      assertEq(plc.simTimeMs, 0, 'simTimeMs zeroed');
      assertEq(plc.outputs().MOTOR, 0, 'committed outputs cleared');
      assertEq(plc.outputImage.MOTOR, 0, 'output image cleared');
      assertEq(plc.timers.T1.ACC, 0, 'timer cleared');
      assertEq(plc.getPhysicalInput('PB_START'), 0, 'physical input latch cleared');
      assertEq(plc.getPhysicalInput('PED_NS'), 0, 'pending pulse cleared');
      assertEq(plc.changedBits.size, 0, 'changedBits cleared');

      plc.scan(); // and it does not spring back to life
      assertEq(plc.outputs().MOTOR, 0, 'stays off after reset (start button no longer latched)');
    } },

    /* 15 ----------------------------------------------------------------- */
    { name: 'LL.Util: mulberry32 rng is deterministic and in [0,1); deepClone isolates', fn: function () {
      var a = rng(42), b = rng(42), c = rng(43);
      var same = true, diff = false;
      for (var i = 0; i < 20; i++) {
        var va = a(), vb = b(), vc = c();
        assert(va >= 0 && va < 1, 'rng value in [0,1)');
        if (va !== vb) same = false;
        if (va !== vc) diff = true;
      }
      assert(same, 'same seed gives the same sequence');
      assert(diff, 'different seed gives a different sequence');

      var src = { a: 1, b: { c: [1, 2, { d: 'x' }] }, e: null };
      var copy = deepClone(src);
      copy.b.c[2].d = 'changed';
      copy.b.c.push(9);
      assertEq(src.b.c[2].d, 'x', 'deepClone does not share nested objects');
      assertEq(src.b.c.length, 3, 'deepClone does not share nested arrays');
    } },

    /* 16 ----------------------------------------------------------------- */
    { name: 'Output-class instructions pass power through: a series of coils all fire from one condition', fn: function () {
      var plc = new PLC(P([XIC('PB_START'), OTE('B_A'), OTE('B_B'), OTL('B_C'), TON('T1', 100)]), { scanMs: 20 });
      plc.setPhysicalInput('PB_START', 1);
      plc.scan();
      assertEq(plc.bits.B_A, 1, 'first coil fired');
      assertEq(plc.bits.B_B, 1, 'second coil fired from the same condition');
      assertEq(plc.bits.B_C, 1, 'latch fired');
      assertEq(plc.timers.T1.EN, 1, 'timer enabled at the end of the series');
    } },

    /* 17 ----------------------------------------------------------------- */
    { name: 'Double-coiled TON accumulates twice per scan (real PLC bug behavior)', fn: function () {
      var plc = new PLC(P([XIC('PB_START'), TON('T1', 1000)], [XIC('PB_START'), TON('T1', 1000)]), { scanMs: 20 });
      plc.setPhysicalInput('PB_START', 1);
      for (var i = 0; i < 5; i++) plc.scan();
      assertEq(plc.timers.T1.ACC, 200, 'ACC advanced 2 x scanMs per scan');
    } },

    /* 18 ----------------------------------------------------------------- */
    { name: 'RES executes in rung order: a later RES cancels a timer solved earlier the same scan', fn: function () {
      var plc = new PLC(P([XIC('PB_START'), TON('T1', 1000)], [XIC('SW_STOP'), RES('T1')]), { scanMs: 20 });
      plc.setPhysicalInput('PB_START', 1);
      for (var i = 0; i < 10; i++) plc.scan();
      assertEq(plc.timers.T1.ACC, 200, 'timer running');
      plc.setPhysicalInput('SW_STOP', 1);
      plc.scan(); // TON adds 20 first (rung 1), then RES (rung 2) zeroes it
      assertEq(plc.timers.T1.ACC, 0, 'RES zeroed the accumulator after the TON ran');
      assertEq(plc.timers.T1.DN, 0, 'DN cleared');
      assertEq(plc.timers.T1.EN, 0, 'RES clears EN too');
    } },

    /* 19 ----------------------------------------------------------------- */
    { name: 'Steady TON timing does not flood changedBits with ACC entries', fn: function () {
      var plc = new PLC(P([XIC('PB_START'), TON('T1', 5000)]), { scanMs: 20 });
      plc.setPhysicalInput('PB_START', 1);
      plc.scan(); // transition scan: I:, T:T1.EN, T:T1.TT expected
      assert(plc.changedBits.has('T:T1.EN'), 'EN transition reported once');
      for (var i = 0; i < 100; i++) {
        plc.scan();
        assertEq(plc.changedBits.size, 0, 'no ACC-churn entries while timing steadily (scan ' + plc.scanCount + ')');
      }
    } },

    /* 20 ----------------------------------------------------------------- */
    { name: 'CTD counts down on rising edges; CTU/CTD sharing a counter keep independent edge memory', fn: function () {
      var plc = new PLC(P(
        [XIC('PB_START'), CTU('C1', 2)],
        [XIC('SW_NIGHT'), { t: 'CTD', tag: 'C1', pre: 2 }]
      ), { scanMs: 20 });
      var c = plc.counters.C1;

      function pulseTag(tag) { // one-scan press, then a released scan
        plc.setPhysicalInput(tag, 1); plc.scan();
        plc.setPhysicalInput(tag, 0); plc.scan();
      }

      pulseTag('PB_START'); pulseTag('PB_START');
      assertEq(c.ACC, 2, 'two up-counts');
      assertEq(c.DN, 1, 'DN at PRE');

      pulseTag('SW_NIGHT');
      assertEq(c.ACC, 1, 'CTD decremented once');
      assertEq(c.DN, 0, 'DN recomputed below PRE');

      // Hold the CTU input continuously; the CTD's edge detector must be
      // unaffected (edge memory is per ELEMENT, not per counter tag).
      plc.setPhysicalInput('PB_START', 1);
      plc.scan(); // CTU counts its own edge: ACC 1 -> 2
      assertEq(c.ACC, 2, 'CTU edge counted while starting the hold');
      plc.scan(); plc.scan(); // held: no more counts
      assertEq(c.ACC, 2, 'no counts while CTU input is held');
      pulseTag('SW_NIGHT');
      assertEq(c.ACC, 1, 'CTD edge still detected independently while CTU input held');
    } },

    /* 21 ----------------------------------------------------------------- */
    { name: 'tagList covers all physical I/O plus every program tag with values/state', fn: function () {
      var plc = new PLC(P([XIC('PB_START'), TON('T_NSG', 8000)], [XIC('T_NSG.DN'), OTE('STEP1')],
        [XIC('STEP1'), CTU('C1', 4)]), { scanMs: 20 });
      var list = plc.tagList();
      function find(tag) {
        for (var i = 0; i < list.length; i++) if (list[i].tag === tag) return list[i];
        return null;
      }
      INPUT_TAGS.forEach(function (t) { assert(find(t) && find(t).kind === 'I', 'input ' + t + ' listed'); });
      OUTPUT_TAGS.forEach(function (t) { assert(find(t) && find(t).kind === 'O', 'output ' + t + ' listed'); });
      var tmr = find('T_NSG');
      assert(tmr && tmr.kind === 'T', 'named timer listed as a timer (not a bit)');
      assertEq(tmr.state.PRE, 8000, 'timer state carries PRE');
      var bit = find('STEP1');
      assert(bit && bit.kind === 'B', 'named internal bit listed');
      var ctr = find('C1');
      assert(ctr && ctr.kind === 'C', 'counter listed');
      assertEq(ctr.state.PRE, 4, 'counter state carries PRE');
    } },
  ];

  /**
   * LL.Engine.runSelfTests() -> {passed, failed, results:[{name, pass, detail}]}
   * Runs the whole suite; never throws. Used by ?selftest=1 (browser) and by
   * `node src/engine.js --test` / engine.test.js (node).
   */
  function runSelfTests() {
    var results = [];
    var passed = 0;
    var failed = 0;
    TESTS.forEach(function (t) {
      try {
        t.fn();
        results.push({ name: t.name, pass: true, detail: 'ok' });
        passed += 1;
      } catch (e) {
        results.push({ name: t.name, pass: false, detail: e && e.message ? e.message : String(e) });
        failed += 1;
      }
    });
    return { passed: passed, failed: failed, results: results };
  }

  /* ======================================================================
   * Exports
   * ==================================================================== */

  LL.Engine = {
    PLC: PLC,
    runSelfTests: runSelfTests,
    // Handy constants for other modules (renderer, editor, validators).
    INPUT_TAGS: INPUT_TAGS.slice(),
    OUTPUT_TAGS: OUTPUT_TAGS.slice()
  };

  // Node: export the namespace so test scripts can require() this file.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LL;
  }

  // `node src/engine.js --test` — run the suite from the command line.
  if (typeof window === 'undefined' && typeof require !== 'undefined' &&
      typeof module !== 'undefined' && require.main === module) {
    var argv = (typeof process !== 'undefined' && process.argv) ? process.argv.slice(2) : [];
    if (argv.indexOf('--test') !== -1) {
      var report = runSelfTests();
      report.results.forEach(function (r) {
        console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.name);
        if (!r.pass) console.log('      ' + r.detail);
      });
      console.log('----');
      console.log(report.passed + ' passed, ' + report.failed + ' failed');
      process.exit(report.failed > 0 ? 1 : 0);
    } else {
      console.log('Ladder Lab PLC engine. Run with --test to execute the unit test suite.');
    }
  }
})();
