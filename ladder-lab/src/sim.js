/* =========================================================================
   Ladder Lab — sim.js
   window.LL.Sim : top-down 4-way intersection world + rendering + the
   clickable physical-input panel + status widgets (motor, sim clock).

   Contract (SPEC.md):
     LL.Sim.init(containerEl, ctx)
     LL.Sim.reset(seed)           — deterministic traffic from LL.Util.rng(seed)
     LL.Sim.prePlcTick(plc)       — sensor states -> plc.setPhysicalInput (before every scan)
     LL.Sim.postPlcTick(plc, dt)  — reads plc.outputs(), advances world by dt ms of SIMULATED time
     LL.Sim.update()              — per-animation-frame redraw; NO state changes here

   Structure: the WORLD CORE (LL.Sim.World) is a set of pure functions over a
   plain-data state object — no DOM, no clock, no Math.random. The only time
   source is the dtMs handed to postPlcTick; the only randomness is
   LL.Util.rng(seed) streams created at reset. Rendering (update) only READS
   world + plc state and draws it — state as of the last completed scan, no
   forward prediction. That split lets node run the exact same world logic
   headless (sim.test.js) — this file guards all DOM work behind init().

   Scan synchronization: pointer handlers ONLY set internal flags (held /
   clickedSinceLastScan / toggle positions). Every plc.setPhysicalInput /
   plc.pulseInput call happens inside prePlcTick, so inputs change exactly at
   scan boundaries. A fast click between scans is never lost: the clicked
   flag survives until the next tick consumes it, where it forces the input
   true for that scan AND fires plc.pulseInput (engine's >=1-scan latch).

   Choices documented where the spec is silent:
   - LOOP_EW is one PLC input but is drawn as a dashed loop in BOTH E/W
     approach lanes (a car arriving from either side should call the light);
     LOOP_EW = (car over either zone) OR (panel LOOP force button held).
   - A dark signal head (no outputs energized) is treated by drivers as red.
   - The WALK_NS pedestrian uses the WEST crosswalk (walks N/S across the
     E/W roadway); WALK_EW uses the SOUTH crosswalk. A pedestrian who is
     mid-crossing finishes even if WALK drops; while WALK stays on, another
     pedestrian starts (alternating direction). Walk speed = crossing length
     / 4 s, so a 4-second WALK phase exactly completes one crossing.
   - Maintained switches (SW_NIGHT/SW_STOP) model a physical lever: their
     position survives PLC swaps and world resets — prePlcTick re-asserts
     them into whichever PLC instance is current every tick.
   - CONFLICT banner text flashes at a 400 ms period derived from
     plc.simTimeMs; the motor fan rotates by accumulated MOTOR-on sim time.
     Nothing visual is driven by the wall clock.
   ========================================================================= */
(function () {
  'use strict';

  var IS_BROWSER = (typeof window !== 'undefined');
  var LL;
  if (IS_BROWSER) {
    window.LL = window.LL || {};
    LL = window.LL;
  } else {
    // Node (sim.test.js): engine.js exports the LL namespace (LL.Util.rng).
    LL = require('./engine.js');
  }

  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ======================================================================
   * WORLD CORE — pure functions over a plain-data world state.
   * ==================================================================== */

  /* ---- geometry (SVG user units), viewBox 800x640, center (400,320) ---- */
  var ROAD_HALF = 56;        // half-width of each roadway (documentation)
  var CAR_LEN = 34, CAR_W = 20;
  var STOP_GAP = 6;          // front-bumper gap kept before the stop bar
  var FOLLOW_GAP = 10;       // gap kept behind the car ahead
  var ACCEL = 70;            // px/s^2
  var BRAKE = 95;            // comfortable decel used for the approach curve
  var BRAKE_MAX = 170;       // panic decel; a yellow needing more is run through
  var PED_CROSS_MS = 4000;   // a full crossing takes 4 s (matches WALK preset)
  var SPAWN_CAP = 6;         // max cars per approach
  var LOOP_BACK = 64, LOOP_LEN = 58; // loop zone = [stop-64, stop-6] along s
  var MOTOR_DEG_PER_MS = 0.72;       // fan speed: 2 rev/s of MOTOR-on sim time

  /* Approaches keyed by where cars come FROM. s = distance of the FRONT
     bumper from the spawn origin along the travel direction.
     Spawn schedule: avg one car per ~5.5 s on N/S, ~7.1 s on E/W (slightly
     sparser so the LOOP_EW sensor program visibly "rests" in NS green). */
  var APPR = {
    N: { axis: 'NS', ox: 374, oy: -70, dx: 0, dy: 1,  stop: 300, boxIn: 334, boxOut: 446, end: 740, rot: 90,  spawnMin: 2600, spawnRange: 5800, firstMin: 500, firstRange: 3000 },
    S: { axis: 'NS', ox: 426, oy: 710, dx: 0, dy: -1, stop: 300, boxIn: 334, boxOut: 446, end: 740, rot: -90, spawnMin: 2600, spawnRange: 5800, firstMin: 500, firstRange: 3000 },
    W: { axis: 'EW', ox: -70, oy: 346, dx: 1, dy: 0,  stop: 380, boxIn: 414, boxOut: 526, end: 900, rot: 0,   spawnMin: 3800, spawnRange: 6600, firstMin: 800, firstRange: 3800 },
    E: { axis: 'EW', ox: 870, oy: 294, dx: -1, dy: 0, stop: 380, boxIn: 414, boxOut: 526, end: 900, rot: 180, spawnMin: 3800, spawnRange: 6600, firstMin: 800, firstRange: 3800 }
  };
  var APPR_KEYS = ['N', 'S', 'E', 'W'];
  var CAR_COLORS = ['#8fa1b3', '#a8695a', '#7d8f6d', '#b3a284', '#5d6b7c', '#9b7f8d'];

  /* Pedestrian crossings: NS walkers use the west crosswalk, EW walkers the
     south crosswalk. A..B endpoints; dir=1 walks A->B, dir=-1 walks B->A. */
  var PED_PATHS = {
    NS: { ax: 328, ay: 392, bx: 328, by: 248 },
    EW: { ax: 332, ay: 392, bx: 468, by: 392 }
  };
  function pedLen(p) { return Math.abs(p.bx - p.ax) + Math.abs(p.by - p.ay); }

  /** How drivers on `axis` read the committed outputs (dark head = red). */
  function axisSignal(out, axis) {
    if (out[axis + '_GRN']) return 'green';
    if (out[axis + '_YEL']) return 'yellow';
    return 'red';
  }

  /** True while any car overlaps either E/W loop zone. */
  function carsOverLoop(world) {
    if (!world) return false;
    var ks = ['W', 'E'];
    for (var i = 0; i < ks.length; i++) {
      var ap = APPR[ks[i]], q = world.cars[ks[i]];
      var z0 = ap.stop - LOOP_BACK, z1 = z0 + LOOP_LEN;
      for (var j = 0; j < q.length; j++) {
        var c = q[j];
        if (c.s > z0 && (c.s - CAR_LEN) < z1) return true;
      }
    }
    return false;
  }

  /** Any car (partly) inside the intersection box travelling on `axis`? */
  function anyInBoxAxis(world, axis) {
    for (var i = 0; i < APPR_KEYS.length; i++) {
      var k = APPR_KEYS[i], ap = APPR[k];
      if (ap.axis !== axis) continue;
      var q = world.cars[k];
      for (var j = 0; j < q.length; j++) {
        var c = q[j];
        if (c.s > ap.boxIn && (c.s - CAR_LEN) < ap.boxOut) return true;
      }
    }
    return false;
  }

  /**
   * Advance one car by dtMs. Queue behind the stop line (or the car ahead)
   * on red/yellow; proceed on green; a car past the line always clears the
   * intersection (it is never given a stop target inside the box).
   */
  function stepCar(c, ahead, ap, sig, dtMs) {
    var dt = dtMs / 1000;
    var stopAt = ap.stop - STOP_GAP;
    var limAhead = ahead ? (ahead.s - CAR_LEN - FOLLOW_GAP) : Infinity;
    var limStop = Infinity;

    if (c.s <= ap.stop) {
      if (sig === 'green') {
        c.committed = false;
      } else {
        if (c.committed && c.v < 2 && c.s < stopAt) c.committed = false; // stopped anyway
        if (!c.committed) {
          var d = stopAt - c.s;
          if (d <= 0) {
            if (sig === 'yellow') c.committed = true;    // on the line at yellow: go
            else limStop = c.s;                          // red right at the mark: hold
          } else {
            var needed = (c.v * c.v) / (2 * d);
            if (sig === 'yellow' && needed > BRAKE_MAX) c.committed = true; // can't stop: run it
            else limStop = stopAt;
          }
        }
      }
    } else {
      c.committed = false;   // past the line — never trapped in the box
    }

    var limit = Math.min(limAhead, limStop);
    var vAllow = c.vmax;
    if (limit < Infinity) {
      var dd = Math.max(0, limit - c.s);
      vAllow = Math.min(vAllow, Math.sqrt(2 * BRAKE * dd));
    }

    /* deterministic per-car start delay -> the lead car pulls away first */
    if (c.v < 0.1) {
      if (!c.wasStopped) { c.wasStopped = true; c.holdMs = c.reaction; }
      if (vAllow > 2) {
        c.holdMs -= dtMs;
        if (c.holdMs > 0) vAllow = 0; else c.wasStopped = false;
      } else {
        c.holdMs = c.reaction;
      }
    } else {
      c.wasStopped = false;
    }

    if (c.v > vAllow) c.v = Math.max(vAllow, c.v - BRAKE_MAX * dt);
    else c.v = Math.min(Math.min(vAllow, c.vmax), c.v + ACCEL * dt);
    c.s += c.v * dt;
    if (c.s >= limit) {                          // hard clamp: never overlap
      c.s = limit;
      c.v = (ahead && limit === limAhead) ? Math.min(c.v, ahead.v) : 0;
    }
  }

  /**
   * World.create(seed) — fresh deterministic world. One independent
   * mulberry32 stream per approach so one queue's spawns never perturb
   * another's. All other state is plain numbers.
   */
  function createWorld(seed) {
    var world = {
      t: 0,                 // accumulated sim ms
      carSeq: 0,            // car id counter (part of world: keeps ids deterministic)
      cars: { N: [], S: [], E: [], W: [] },
      nextSpawn: {},
      rngs: {},
      peds: { NS: null, EW: null },
      pedDir: { NS: 1, EW: 1 },
      sparkMs: 0,           // crash-flash time remaining
      motorMs: 0            // accumulated MOTOR-on sim time (fan angle source)
    };
    for (var i = 0; i < APPR_KEYS.length; i++) {
      var k = APPR_KEYS[i], ap = APPR[k];
      var r = LL.Util.rng((seed + i * 101159) >>> 0);
      world.rngs[k] = r;
      world.nextSpawn[k] = ap.firstMin + r() * ap.firstRange;
    }
    return world;
  }

  /**
   * World.step(world, out, dtMs) — advance the whole world by dtMs of sim
   * time under the PLC's committed outputs. Spawning, car dynamics,
   * pedestrians, crash spark, motor-on time. Pure w.r.t. everything except
   * `world` (mutated in place).
   */
  function stepWorld(world, out, dtMs) {
    var i, k, ap, q, j;
    var sig = { NS: axisSignal(out, 'NS'), EW: axisSignal(out, 'EW') };

    /* spawn (seeded, deterministic; defer WITHOUT consuming rng when blocked
       so a full queue cannot shift the later schedule) */
    for (i = 0; i < APPR_KEYS.length; i++) {
      k = APPR_KEYS[i]; ap = APPR[k]; q = world.cars[k];
      if (world.t >= world.nextSpawn[k]) {
        var tail = q.length ? q[q.length - 1] : null;
        if (q.length >= SPAWN_CAP || (tail && tail.s < CAR_LEN + 50)) {
          world.nextSpawn[k] += 450;
        } else {
          var r = world.rngs[k];
          var c = {
            id: 'c' + (world.carSeq++),
            color: CAR_COLORS[Math.floor(r() * CAR_COLORS.length) % CAR_COLORS.length],
            vmax: 112 + r() * 36,
            reaction: 260 + r() * 440,
            s: CAR_LEN, v: 0, committed: false, wasStopped: false, holdMs: 0
          };
          c.v = c.vmax * 0.9;
          q.push(c);
          world.nextSpawn[k] = world.t + ap.spawnMin + r() * ap.spawnRange;
        }
      }
    }

    /* advance cars, lead car first (q[0] is oldest = furthest along) */
    for (i = 0; i < APPR_KEYS.length; i++) {
      k = APPR_KEYS[i]; ap = APPR[k]; q = world.cars[k];
      var s = sig[ap.axis];
      for (j = 0; j < q.length; j++) stepCar(q[j], j > 0 ? q[j - 1] : null, ap, s, dtMs);
      while (q.length && (q[0].s - CAR_LEN) > ap.end) q.shift();   // despawn off-screen
    }

    /* pedestrians: spawn on WALK, finish crossing even if WALK drops */
    var keys = ['NS', 'EW'];
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      var on = !!out['WALK_' + k];
      var p = world.peds[k];
      if (!p && on) {
        var len = pedLen(PED_PATHS[k]);
        world.peds[k] = { pos: 0, dir: world.pedDir[k], len: len, speed: len / PED_CROSS_MS * 1000 };
        world.pedDir[k] = -world.pedDir[k];
      } else if (p) {
        p.pos += p.speed * dtMs / 1000;
        if (p.pos >= p.len) world.peds[k] = null;
      }
    }

    /* crash spark: perpendicular cars in the box during a green-green conflict */
    if (out.NS_GRN && out.EW_GRN && anyInBoxAxis(world, 'NS') && anyInBoxAxis(world, 'EW')) world.sparkMs = 600;
    else world.sparkMs = Math.max(0, world.sparkMs - dtMs);

    /* motor fan angle source: sim time accumulated only while MOTOR is on */
    if (out.MOTOR) world.motorMs += dtMs;

    world.t += dtMs;
  }

  /** Plain-JSON snapshot of everything positional (determinism tests). */
  function snapshotWorld(world) {
    if (!world) return null;
    var snap = { t: world.t, carSeq: world.carSeq, sparkMs: world.sparkMs, motorMs: world.motorMs, cars: {}, peds: {} };
    for (var i = 0; i < APPR_KEYS.length; i++) {
      var k = APPR_KEYS[i];
      snap.cars[k] = world.cars[k].map(function (c) {
        return { id: c.id, s: c.s, v: c.v, color: c.color, committed: !!c.committed };
      });
    }
    var pk = ['NS', 'EW'];
    for (var p = 0; p < pk.length; p++) {
      var ped = world.peds[pk[p]];
      snap.peds[pk[p]] = ped ? { pos: ped.pos, dir: ped.dir } : null;
    }
    return snap;
  }

  var World = {
    create: createWorld,
    step: stepWorld,
    carsOverLoop: carsOverLoop,
    anyInBoxAxis: anyInBoxAxis,
    axisSignal: axisSignal,
    snapshot: snapshotWorld,
    CAR_LEN: CAR_LEN,
    APPR: APPR
  };

  /* ======================================================================
   * MODULE STATE (shared by the tick hooks and the renderer)
   * ==================================================================== */

  var ctx = null, root = null, world = null;
  var dom = { lens: {}, walk: {}, loops: [], leds: {}, reqs: {}, toggles: {}, statusEls: {}, carLayer: null, pedLayer: null, spark: null, conflict: null, conflictText: null, motor: null, fan: null };
  var state = {
    seed: 12345,
    held: {},          // momentary buttons currently pointer-down (tag -> bool)
    clicked: {},       // pressed since the last completed scan (>=1-scan flag)
    toggles: { SW_NIGHT: false, SW_STOP: false },  // maintained switch positions
    usesMotor: false,
    loopLive: false,   // LOOP_EW value pushed at the last prePlcTick (pre-scan glow)
    carEls: {}, pedEls: {}
  };

  var MOMENTARY = ['PB_START', 'PB_STOP', 'PED_NS', 'PED_EW', 'LOOP_EW'];

  /* ------------------------------ helpers ------------------------------ */
  function getPlc() { return (ctx && typeof ctx.getPlc === 'function') ? ctx.getPlc() : null; }

  function svgEl(name, attrs, parent) {
    var e = document.createElementNS(SVGNS, name);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function div(cls, parent) {
    var e = document.createElement('div');
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  /* --------------------------- scene building -------------------------- */
  function buildScene(svg) {
    var i;
    svgEl('rect', { x: 0, y: 0, width: 800, height: 640, 'class': 'sim-ground' }, svg);
    /* sidewalk corner pads */
    svgEl('rect', { x: 0, y: 0, width: 340, height: 260, 'class': 'sim-pad' }, svg);
    svgEl('rect', { x: 460, y: 0, width: 340, height: 260, 'class': 'sim-pad' }, svg);
    svgEl('rect', { x: 0, y: 380, width: 340, height: 260, 'class': 'sim-pad' }, svg);
    svgEl('rect', { x: 460, y: 380, width: 340, height: 260, 'class': 'sim-pad' }, svg);
    /* roads */
    svgEl('rect', { x: 0, y: 264, width: 800, height: 112, 'class': 'sim-road' }, svg);
    svgEl('rect', { x: 344, y: 0, width: 112, height: 640, 'class': 'sim-road' }, svg);
    /* road edge lines (skip the intersection) */
    var edges = [
      [0, 264, 344, 264], [456, 264, 800, 264], [0, 376, 344, 376], [456, 376, 800, 376],
      [344, 0, 344, 264], [344, 376, 344, 640], [456, 0, 456, 264], [456, 376, 456, 640]
    ];
    for (i = 0; i < edges.length; i++) {
      svgEl('line', { x1: edges[i][0], y1: edges[i][1], x2: edges[i][2], y2: edges[i][3], 'class': 'sim-edge' }, svg);
    }
    /* dashed center lane lines */
    var dashes = [[0, 320, 336, 320], [464, 320, 800, 320], [400, 0, 400, 256], [400, 384, 400, 640]];
    for (i = 0; i < dashes.length; i++) {
      svgEl('line', { x1: dashes[i][0], y1: dashes[i][1], x2: dashes[i][2], y2: dashes[i][3], 'class': 'sim-dash' }, svg);
    }
    /* crosswalk zebra stripes (continental) on all 4 legs */
    zebra(svg, 344, 238, 112, 20, true);   // north
    zebra(svg, 344, 382, 112, 20, true);   // south (EW walkers)
    zebra(svg, 318, 264, 20, 112, false);  // west  (NS walkers)
    zebra(svg, 462, 264, 20, 112, false);  // east
    /* stop bars (approach lane half only) */
    svgEl('rect', { x: 344, y: 226, width: 54, height: 6, 'class': 'sim-stopbar' }, svg);  // N appr
    svgEl('rect', { x: 402, y: 408, width: 54, height: 6, 'class': 'sim-stopbar' }, svg);  // S appr
    svgEl('rect', { x: 306, y: 322, width: 6, height: 54, 'class': 'sim-stopbar' }, svg);  // W appr
    svgEl('rect', { x: 488, y: 264, width: 6, height: 54, 'class': 'sim-stopbar' }, svg);  // E appr
    /* inductive loop zones — one dashed wire loop per E/W approach lane */
    buildLoop(svg, 246, 327, 58, 38);   // W approach (eastbound lane)
    buildLoop(svg, 496, 275, 58, 38);   // E approach (westbound lane)
    /* dynamic layers */
    dom.carLayer = svgEl('g', { 'class': 'sim-cars' }, svg);
    dom.pedLayer = svgEl('g', { 'class': 'sim-peds' }, svg);
    /* crash spark */
    dom.spark = svgEl('g', { 'class': 'sim-spark', transform: 'translate(400 320)', display: 'none' }, svg);
    svgEl('polygon', { points: starPts(8, 30, 12), 'class': 'sim-spark-outer' }, dom.spark);
    svgEl('polygon', { points: starPts(8, 17, 7), 'class': 'sim-spark-inner', transform: 'rotate(22)' }, dom.spark);
    /* signal stacks + walk signs */
    buildStack(svg, 472, 112, 'N-S', 'NS', false);   // NE corner, mirrors both NS heads
    buildStack(svg, 268, 388, 'E-W', 'EW', true);    // SW corner
    buildWalkSign(svg, 288, 204, 'NS', false);       // NW corner, west crosswalk
    buildWalkSign(svg, 476, 398, 'EW', true);        // SE corner, south crosswalk
    /* compass */
    var comp = svgEl('g', { 'class': 'sim-compass', transform: 'translate(30 44)' }, svg);
    svgEl('polygon', { points: '0,-16 6,4 0,0 -6,4' }, comp);
    svgEl('text', { x: 0, y: 20, 'text-anchor': 'middle' }, comp).textContent = 'N';
  }

  function zebra(svg, x, y, w, h, horiz) {
    var g = svgEl('g', { 'class': 'sim-zebra' }, svg), p;
    if (horiz) for (p = x + 3; p + 7 <= x + w; p += 15) svgEl('rect', { x: p, y: y, width: 7, height: h }, g);
    else for (p = y + 3; p + 7 <= y + h; p += 15) svgEl('rect', { x: x, y: p, width: w, height: 7 }, g);
  }

  function buildLoop(svg, x, y, w, h) {
    var g = svgEl('g', { 'class': 'sim-loop' }, svg);
    svgEl('rect', { x: x, y: y, width: w, height: h, rx: 6 }, g);
    svgEl('text', { x: x + w / 2, y: y + h / 2 + 3, 'text-anchor': 'middle', 'class': 'sim-loop-label' }, g).textContent = 'LOOP';
    dom.loops.push(g);
  }

  function buildStack(svg, x, y, label, prefix, labelBelow) {
    var g = svgEl('g', { 'class': 'sim-stack' }, svg);
    svgEl('rect', { x: x, y: y, width: 52, height: 140, rx: 10, 'class': 'sim-stack-housing' }, g);
    svgEl('text', { x: x + 26, y: labelBelow ? y + 160 : y - 8, 'text-anchor': 'middle', 'class': 'sim-stack-label' }, g).textContent = label;
    var defs = [['RED', 'red', 28], ['YEL', 'yel', 70], ['GRN', 'grn', 112]];
    for (var i = 0; i < defs.length; i++) {
      var lg = svgEl('g', { 'class': 'sim-lens ' + defs[i][1] }, g);
      svgEl('circle', { cx: x + 26, cy: y + defs[i][2], r: 23, 'class': 'sim-halo' }, lg);
      svgEl('circle', { cx: x + 26, cy: y + defs[i][2], r: 16, 'class': 'sim-face' }, lg);
      dom.lens[prefix + '_' + defs[i][0]] = lg;
    }
  }

  function buildWalkSign(svg, x, y, key, labelBelow) {
    var g = svgEl('g', { 'class': 'sim-walksign' }, svg);
    svgEl('rect', { x: x, y: y, width: 44, height: 44, rx: 6, 'class': 'sim-walksign-box' }, g);
    var cx = x + 22, cy = y + 22;
    var fig = svgEl('g', { 'class': 'sim-walk-fig', transform: 'translate(' + cx + ' ' + cy + ') scale(1.9)' }, g);
    svgEl('circle', { cx: 0, cy: -7.4, r: 2.7 }, fig);
    svgEl('path', { d: 'M0,-4.4 L0,2 M0,2 L-4,9 M0,2 L3.6,9.2 M0,-3 L-3.6,1.4 M0,-3 L3.4,0.6' }, fig);
    var hand = svgEl('g', { 'class': 'sim-walk-hand', transform: 'translate(' + cx + ' ' + cy + ') scale(1.9)' }, g);
    svgEl('rect', { x: -5.5, y: -1.5, width: 11, height: 8.5, rx: 3 }, hand);
    var fx = [-5.5, -2.8, -0.1, 2.6];
    for (var i = 0; i < fx.length; i++) svgEl('rect', { x: fx[i], y: -8.4, width: 2.3, height: 8.2, rx: 1.1 }, hand);
    svgEl('rect', { x: -9.6, y: -1.4, width: 4.8, height: 2.6, rx: 1.3, transform: 'rotate(-35 -7.2 -0.1)' }, hand);
    svgEl('text', { x: cx, y: labelBelow ? y + 58 : y - 8, 'text-anchor': 'middle', 'class': 'sim-walksign-label' }, g).textContent = 'WALK ' + (key === 'NS' ? 'N-S' : 'E-W');
    dom.walk[key] = { fig: fig, hand: hand };
  }

  function starPts(n, R, r) {
    var pts = [];
    for (var i = 0; i < 2 * n; i++) {
      var a = i * Math.PI / n, rad = (i % 2) ? r : R;
      pts.push((Math.cos(a) * rad).toFixed(1) + ',' + (Math.sin(a) * rad).toFixed(1));
    }
    return pts.join(' ');
  }

  function buildCarEl(c) {
    var g = svgEl('g', { 'class': 'sim-car' }, dom.carLayer);
    svgEl('rect', { x: -CAR_LEN / 2, y: -CAR_W / 2, width: CAR_LEN, height: CAR_W, rx: 5.5, 'class': 'sim-car-body', fill: c.color }, g);
    /* direction hint: windshield + headlights mark the front (+x) */
    svgEl('rect', { x: 3, y: -7, width: 7, height: 14, rx: 2, 'class': 'sim-car-glass' }, g);
    svgEl('rect', { x: -12, y: -7, width: 4.5, height: 14, rx: 2, 'class': 'sim-car-glass' }, g);
    svgEl('circle', { cx: 15.5, cy: -6, r: 2, 'class': 'sim-car-light' }, g);
    svgEl('circle', { cx: 15.5, cy: 6, r: 2, 'class': 'sim-car-light' }, g);
    return g;
  }

  function buildPedEl() {
    /* outer g gets the position transform; inner g scales the figure up so
       it stays readable from the back of a classroom */
    var g = svgEl('g', { 'class': 'sim-ped' }, dom.pedLayer);
    var f = svgEl('g', { transform: 'scale(1.8)' }, g);
    svgEl('circle', { cx: 0, cy: -11, r: 3 }, f);
    svgEl('line', { x1: 0, y1: -8, x2: 0, y2: 1, 'class': 'sim-ped-body' }, f);
    svgEl('line', { x1: 0, y1: 1, x2: -3, y2: 9, 'class': 'sim-ped-leg1' }, f);
    svgEl('line', { x1: 0, y1: 1, x2: 3, y2: 9, 'class': 'sim-ped-leg2' }, f);
    svgEl('line', { x1: -3, y1: -3, x2: 3, y2: -3, 'class': 'sim-ped-arms' }, f);
    return g;
  }

  /* --------------------------- widgets + panel -------------------------- */
  function registerLed(el, tag) {
    (dom.leds[tag] = dom.leds[tag] || []).push(el);
  }

  function buildWidgets(parent) {
    var row = div('sim-widgets', parent);
    var status = div('sim-status', row);
    status.innerHTML =
      '<span class="sim-status-cell">SIM TIME <b data-st="time">0.0 s</b></span>' +
      '<span class="sim-status-cell">SCANS <b data-st="scans">0</b></span>' +
      '<span class="sim-status-cell">CARS <b data-st="cars">0</b></span>' +
      '<span class="sim-status-cell"><span class="sim-led" data-statusloop></span> LOOP_EW</span>';
    dom.statusEls.time = status.querySelector('[data-st="time"]');
    dom.statusEls.scans = status.querySelector('[data-st="scans"]');
    dom.statusEls.cars = status.querySelector('[data-st="cars"]');
    registerLed(status.querySelector('[data-statusloop]'), 'LOOP_EW');

    var motor = div('sim-motor', row);
    motor.hidden = true;
    motor.innerHTML =
      '<div class="sim-motor-head"><span class="sim-motor-title">MOTOR</span>' +
      '<span class="sim-led" data-motorled></span><span class="sim-motor-state">OFF</span></div>' +
      '<svg class="sim-motor-svg" viewBox="0 0 104 58" aria-hidden="true">' +
      '<rect x="4" y="14" width="54" height="30" rx="6" class="sim-motor-body"/>' +
      '<line x1="12" y1="18" x2="12" y2="40" class="sim-motor-fin"/>' +
      '<line x1="20" y1="18" x2="20" y2="40" class="sim-motor-fin"/>' +
      '<line x1="28" y1="18" x2="28" y2="40" class="sim-motor-fin"/>' +
      '<line x1="36" y1="18" x2="36" y2="40" class="sim-motor-fin"/>' +
      '<rect x="58" y="25" width="12" height="8" class="sim-motor-shaft"/>' +
      '<g class="sim-fan">' +
      '<ellipse cx="84" cy="17" rx="4.5" ry="10" class="sim-fan-blade"/>' +
      '<ellipse cx="84" cy="17" rx="4.5" ry="10" class="sim-fan-blade" transform="rotate(120 84 29)"/>' +
      '<ellipse cx="84" cy="17" rx="4.5" ry="10" class="sim-fan-blade" transform="rotate(240 84 29)"/>' +
      '<circle cx="84" cy="29" r="4" class="sim-fan-hub"/></g></svg>';
    dom.motor = motor;
    dom.motorState = motor.querySelector('.sim-motor-state');
    dom.fan = motor.querySelector('.sim-fan');
    registerLed(motor.querySelector('[data-motorled]'), '__MOTOR_OUT__');   // driven from outputs, not inputImage
  }

  /* Input handlers ONLY set flags — prePlcTick makes every plc call.
     Keyboard presses deliberately use keydown/keyup instead of click so a
     held Space/Enter behaves like the physical momentary button. */
  function bindMomentary(btn, tag) {
    var press = function (ev) {
      ev.preventDefault();
      if (state.held[tag]) return;
      state.held[tag] = true;
      state.clicked[tag] = true;      // survives until the next scan consumes it
      btn.classList.add('down');
    };
    var release = function () {
      if (!state.held[tag]) return;
      state.held[tag] = false;
      btn.classList.remove('down');
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('keydown', function (ev) {
      if (ev.code !== 'Space' && ev.key !== 'Enter') return;
      ev.preventDefault();
      press(ev);
    });
    btn.addEventListener('keyup', function (ev) {
      if (ev.code !== 'Space' && ev.key !== 'Enter') return;
      ev.preventDefault();
      release();
    });
    btn.addEventListener('blur', release);
  }

  function bindToggle(btn, tag) {
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      state.toggles[tag] = !state.toggles[tag];
      btn.classList.toggle('on', state.toggles[tag]);
    });
  }

  function ctl(parent, tag) {
    var c = div('sim-ctl', parent);
    c.setAttribute('data-ctl', tag);
    return c;
  }

  function ctlLabels(c, tag, name, reqTag) {
    var t = div('sim-ctl-tag', c); t.textContent = tag;
    var info = div('sim-ctl-info', c);
    var led = document.createElement('span'); led.className = 'sim-led';
    info.appendChild(led); registerLed(led, tag);
    var nm = document.createElement('span'); nm.className = 'sim-ctl-name'; nm.textContent = name;
    info.appendChild(nm);
    if (reqTag) {
      var rq = document.createElement('span'); rq.className = 'sim-req'; rq.textContent = 'REQ';
      rq.title = 'walk request registered (' + reqTag + ')';
      info.appendChild(rq);
      dom.reqs[reqTag] = rq;
    }
  }

  function ctlMomentary(parent, tag, name, btnCls, reqTag) {
    var c = ctl(parent, tag);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sim-btn ' + btnCls;
    btn.setAttribute('aria-label', tag + ' momentary pushbutton');
    var cap = document.createElement('span'); cap.className = 'sim-btn-cap'; btn.appendChild(cap);
    c.appendChild(btn);
    ctlLabels(c, tag, name, reqTag);
    bindMomentary(btn, tag);
  }

  function ctlSelector(parent, tag, name, posOff, posOn) {
    var c = ctl(parent, tag);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sim-btn sim-btn-sel';
    btn.setAttribute('aria-label', tag + ' selector switch');
    btn.innerHTML = '<span class="sim-sel-face"><span class="sim-sel-knob"></span></span>';
    c.appendChild(btn);
    var pos = div('sim-sel-caption', c);
    pos.innerHTML = '<span>' + posOff + '</span><span>' + posOn + '</span>';
    ctlLabels(c, tag, name, null);
    bindToggle(btn, tag);
    dom.toggles[tag] = btn;
  }

  function ctlMushroom(parent, tag, name, posOff, posOn) {
    var c = ctl(parent, tag);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sim-btn sim-btn-mushroom';
    btn.setAttribute('aria-label', tag + ' maintained mushroom switch');
    btn.innerHTML = '<span class="sim-mushroom-cap"></span>';
    c.appendChild(btn);
    var pos = div('sim-sel-caption', c);
    pos.innerHTML = '<span>' + posOff + '</span><span>' + posOn + '</span>';
    ctlLabels(c, tag, name, null);
    bindToggle(btn, tag);
    dom.toggles[tag] = btn;
  }

  function buildPanel(parent) {
    var panel = div('sim-panel', parent);
    var title = div('sim-panel-title', panel);
    title.textContent = 'FIELD DEVICES';

    var g1 = div('sim-group', panel);
    div('sim-group-title', g1).textContent = 'MOTOR';
    var g1c = div('sim-group-controls', g1);
    ctlMomentary(g1c, 'PB_START', 'START', 'sim-btn-start');
    ctlMomentary(g1c, 'PB_STOP', 'STOP', 'sim-btn-stop');

    var g2 = div('sim-group', panel);
    div('sim-group-title', g2).textContent = 'PEDESTRIAN';
    var g2c = div('sim-group-controls', g2);
    ctlMomentary(g2c, 'PED_NS', 'PED N-S', 'sim-btn-ped', 'REQ_NS');
    ctlMomentary(g2c, 'PED_EW', 'PED E-W', 'sim-btn-ped', 'REQ_EW');

    var g3 = div('sim-group', panel);
    div('sim-group-title', g3).textContent = 'SENSOR';
    var g3c = div('sim-group-controls', g3);
    ctlMomentary(g3c, 'LOOP_EW', 'LOOP FORCE', 'sim-btn-loop');

    var g4 = div('sim-group', panel);
    div('sim-group-title', g4).textContent = 'SWITCHES';
    var g4c = div('sim-group-controls', g4);
    ctlSelector(g4c, 'SW_NIGHT', 'NIGHT MODE', 'AUTO', 'NIGHT');
    ctlMushroom(g4c, 'SW_STOP', 'MASTER STOP', 'RUN', 'STOP');
  }

  /* ------------------------------ rendering ---------------------------- */
  function renderLights(out) {
    for (var key in dom.lens) {
      dom.lens[key].classList.toggle('on', !!out[key]);
    }
  }

  function renderWalkSigns(out) {
    var keys = ['NS', 'EW'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], on = !!out['WALK_' + k], w = dom.walk[k];
      if (!w) continue;
      w.fig.setAttribute('visibility', on ? 'visible' : 'hidden');
      w.hand.setAttribute('visibility', on ? 'hidden' : 'visible');
    }
  }

  function renderLoops(img) {
    var on = (img.LOOP_EW !== undefined) ? !!img.LOOP_EW : !!state.loopLive;
    for (var i = 0; i < dom.loops.length; i++) dom.loops[i].classList.toggle('on', on);
  }

  function renderCars() {
    var seen = {}, i, j, k;
    if (world) {
      for (i = 0; i < APPR_KEYS.length; i++) {
        k = APPR_KEYS[i];
        var ap = APPR[k], q = world.cars[k];
        for (j = 0; j < q.length; j++) {
          var c = q[j];
          var el = state.carEls[c.id];
          if (!el) el = state.carEls[c.id] = buildCarEl(c);
          var mid = c.s - CAR_LEN / 2;
          var x = ap.ox + ap.dx * mid, y = ap.oy + ap.dy * mid;
          el.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + ap.rot + ')');
          seen[c.id] = true;
        }
      }
    }
    for (var id in state.carEls) {
      if (!seen[id]) {
        if (state.carEls[id].parentNode) state.carEls[id].parentNode.removeChild(state.carEls[id]);
        delete state.carEls[id];
      }
    }
  }

  function renderPeds() {
    var keys = ['NS', 'EW'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], p = world ? world.peds[k] : null, el = state.pedEls[k];
      if (p) {
        if (!el) el = state.pedEls[k] = buildPedEl();
        var path = PED_PATHS[k];
        var t = Math.min(1, p.pos / p.len);
        var fx = p.dir === 1 ? path.ax : path.bx, fy = p.dir === 1 ? path.ay : path.by;
        var tx = p.dir === 1 ? path.bx : path.ax, ty = p.dir === 1 ? path.by : path.ay;
        var x = fx + (tx - fx) * t, y = fy + (ty - fy) * t;
        el.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
        var sw = Math.sin(p.pos * 0.55) * 4;         // deterministic stride (position-based)
        el.querySelector('.sim-ped-leg1').setAttribute('x2', (-sw).toFixed(1));
        el.querySelector('.sim-ped-leg2').setAttribute('x2', sw.toFixed(1));
      } else if (el) {
        if (el.parentNode) el.parentNode.removeChild(el);
        delete state.pedEls[k];
      }
    }
  }

  /* CONFLICT banner: shown while both greens are committed; the text
     flashes at a 400 ms period computed from SIM time (never wall clock). */
  function renderConflict(out, simMs) {
    var on = !!(out.NS_GRN && out.EW_GRN);
    dom.conflict.classList.toggle('on', on);
    if (on) dom.conflictText.classList.toggle('dim', Math.floor(simMs / 400) % 2 === 1);
    dom.spark.setAttribute('display', (world && world.sparkMs > 0) ? 'inline' : 'none');
  }

  function renderPanel(img, bits, out) {
    for (var tag in dom.leds) {
      var on = tag === '__MOTOR_OUT__' ? !!out.MOTOR : !!img[tag];
      var arr = dom.leds[tag];
      for (var i = 0; i < arr.length; i++) arr[i].classList.toggle('on', on);
    }
    for (var t in dom.toggles) dom.toggles[t].classList.toggle('on', !!state.toggles[t]);
    for (var rq in dom.reqs) dom.reqs[rq].classList.toggle('on', !!(bits && bits[rq]));
  }

  /* Motor widget: fan angle = accumulated MOTOR-on sim time (world.motorMs),
     so it spins only while MOTOR is on and freezes when the sim pauses. */
  function renderMotor(out) {
    if (!dom.motor) return;
    dom.motor.hidden = !state.usesMotor;
    if (state.usesMotor) {
      var on = !!out.MOTOR;
      dom.motor.classList.toggle('on', on);
      dom.motorState.textContent = on ? 'ON' : 'OFF';
      var ang = ((world ? world.motorMs : 0) * MOTOR_DEG_PER_MS) % 360;
      dom.fan.setAttribute('transform', 'rotate(' + ang.toFixed(1) + ' 84 29)');
    }
  }

  function renderStatus(plc) {
    var tMs = (plc && typeof plc.simTimeMs === 'number') ? plc.simTimeMs : (world ? world.t : 0);
    dom.statusEls.time.textContent = (tMs / 1000).toFixed(1) + ' s';
    dom.statusEls.scans.textContent = (plc && typeof plc.scanCount === 'number') ? plc.scanCount : '—';
    var n = 0;
    if (world) for (var i = 0; i < APPR_KEYS.length; i++) n += world.cars[APPR_KEYS[i]].length;
    dom.statusEls.cars.textContent = n;
  }

  function refreshMotorVisibility() {
    var plc = getPlc();
    state.usesMotor = !!(plc && plc.program && plc.program.usesMotor);
    if (dom.motor) dom.motor.hidden = !state.usesMotor;
  }

  function applyBigUI(on) {
    if (root) root.classList.toggle('sim-bigui', !!on);
  }

  /* ------------------------------ public API ---------------------------- */
  var Sim = {
    /** Pure world core, exposed for headless tests. */
    World: World,

    init: function (containerEl, c) {
      ctx = c;
      containerEl.innerHTML = '';
      root = div('sim-root', containerEl);

      var stage = div('sim-stage', root);
      var svg = svgEl('svg', { 'class': 'sim-svg', viewBox: '0 0 800 640', role: 'img', 'aria-label': 'Four-way intersection simulation' });
      stage.appendChild(svg);
      buildScene(svg);
      dom.conflict = div('sim-conflict', stage);
      dom.conflictText = div('sim-conflict-text', dom.conflict);
      dom.conflictText.textContent = 'CONFLICT';

      buildWidgets(root);
      buildPanel(root);

      if (ctx && ctx.bus && typeof ctx.bus.on === 'function') {
        /* new program => new PLC instance: re-read it, hard world reset with
           the spec's fixed seed, and re-evaluate the motor widget */
        ctx.bus.on('program:loaded', function () {
          refreshMotorVisibility();
          Sim.reset(12345);
        });
        ctx.bus.on('bigui:changed', function (d) {
          var on;
          if (typeof d === 'boolean') on = d;
          else if (d && typeof d.bigUI === 'boolean') on = d.bigUI;
          else on = !!(ctx && ctx.bigUI);
          applyBigUI(on);
        });
      }
      applyBigUI(!!(ctx && ctx.bigUI));
      refreshMotorVisibility();
    },

    reset: function (seed) {
      var s = (typeof seed === 'number' && isFinite(seed)) ? (seed >>> 0) : state.seed;
      state.seed = s;
      world = World.create(s);
      state.loopLive = false;
      state.clicked = {};
      /* held buttons + toggle switch positions are physical: they survive */
    },

    /* Before every scan: compute sensor states from world geometry + panel
       flags and push them into the PLC. This is the ONLY place (with the
       toggle re-assert below) that touches plc inputs. */
    prePlcTick: function (plc) {
      if (!plc || typeof plc.setPhysicalInput !== 'function') return;
      var canPulse = (typeof plc.pulseInput === 'function');
      for (var i = 0; i < MOMENTARY.length; i++) {
        var t = MOMENTARY[i];
        /* held => true while down; clicked => forced true for this scan even
           if the pointer already went back up (>=1-scan guarantee), doubled
           by pulseInput when the engine provides it */
        var v = !!state.held[t] || !!state.clicked[t];
        if (t === 'LOOP_EW') {
          v = v || (world ? World.carsOverLoop(world) : false);
          state.loopLive = v;
        }
        plc.setPhysicalInput(t, v);
        if (state.clicked[t] && canPulse) plc.pulseInput(t);
      }
      plc.setPhysicalInput('SW_NIGHT', !!state.toggles.SW_NIGHT);
      plc.setPhysicalInput('SW_STOP', !!state.toggles.SW_STOP);
    },

    /* After every scan: the click flags were consumed by the scan that just
       ran; then advance the world by dtMs of SIM time under the committed
       outputs. */
    postPlcTick: function (plc, dtMs) {
      state.clicked = {};
      if (!world) return;
      var out = (plc && typeof plc.outputs === 'function' && plc.outputs()) || {};
      World.step(world, out, dtMs);
    },

    /* Per animation frame: redraw current world + committed outputs.
       Read-only — draws the state as of the last completed scan. */
    update: function () {
      if (!root) return;
      var plc = getPlc();
      var out = (plc && typeof plc.outputs === 'function' && plc.outputs()) || {};
      var img = (plc && plc.inputImage) || {};
      var bits = (plc && plc.bits) || {};
      var simMs = (plc && typeof plc.simTimeMs === 'number') ? plc.simTimeMs : (world ? world.t : 0);
      renderLights(out);
      renderWalkSigns(out);
      renderLoops(img);
      renderCars();
      renderPeds();
      renderConflict(out, simMs);
      renderPanel(img, bits, out);
      renderMotor(out);
      renderStatus(plc);
    },

    /** Plain-data snapshot of the world (for the determinism test). */
    snapshot: function () {
      return World.snapshot(world);
    }
  };

  LL.Sim = Sim;

  // Node: export the namespace so sim.test.js can require() this file.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LL;
  }
})();
