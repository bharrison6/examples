/* Ideal Gas Law — the physics and measurement model. No DOM in this file.

   WHAT THIS IS. N hard discs in a rectangular box with one movable wall (the
   piston). Particles fly freely, reflect off the walls, and (optionally)
   collide elastically with each other. Nothing about the ideal gas law is
   written into the simulation: PRESSURE is measured by adding up the momentum
   the walls receive, TEMPERATURE is computed from the particles' kinetic
   energy, and P·A = N·T is a PREDICTION the rest of the demo tests against
   those measurements.

   UNITS, and the one constant that must not drift. This is a 2D box, in
   reduced units: every particle has mass 1 and Boltzmann's constant is 1.
   Equipartition then says each degree of freedom carries T/2 of kinetic
   energy, so with DOF = 2

       T = <v^2> / DOF         (= half the mean squared speed)

   "Pressure" in 2D is force per unit LENGTH of wall, and "volume" is the box
   AREA, so the ideal gas law reads P·A = N·T. Every formula below derives
   from DOF; never write a 3D constant (3/2, 4πv²) anywhere in this demo.

   The default temperature is 300 because it reads like room temperature in
   kelvin. It is not kelvin. The scale is a teaching choice, and the page says
   so wherever the number appears.

   Bundled into index.html by build.js; the CommonJS tail lets test-model.js
   require it under node, where `module` exists and in the browser does not. */
const IdealGasModel = (() => {
  'use strict';

  const DOF = 2;

  const DEFAULTS = Object.freeze({
    boxWidth: 100,
    boxHeight: 60,
    count: 240,
    temperature: 300,
    radius: 0.35,
    thermostat: true,
    collisions: true,
    timeScale: 2,        /* simulated seconds per real second */
    emaTau: 1.0,         /* smoothing time for the pressure readout, sim-s */
    thermostatTau: 0.15, /* how fast the thermostat pulls T to its target, sim-s */
    pistonSpeed: 12,     /* how fast the piston slides toward its target, units/s */
    capacity: 600
  });

  const LIMITS = Object.freeze({
    count: [10, 600],
    temperature: [50, 1200],
    boxWidth: [40, 100],
    radius: [0.35, 1.0],
    timeScale: [0.5, 4]
  });

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* Box–Muller, one standard normal per call (the second is discarded for
     simplicity; this runs a few hundred times per reset, not per frame). */
  function gaussian(rng) {
    let u = 0;
    while (u === 0) u = rng();
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* A small seedable generator (mulberry32) so the node tests are
     repeatable. The browser passes Math.random. */
  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---- the gas ------------------------------------------------------------ */

  function createGas(options) {
    const o = Object.assign({}, DEFAULTS, options || {});
    const cap = o.capacity;
    const gas = {
      rng: o.rng || Math.random,
      W: o.boxWidth,
      H: o.boxHeight,
      pistonTarget: o.boxWidth,
      pistonU: 0,             /* the wall's velocity this step, units/s */
      N: 0,
      cap,
      r: o.radius,
      x: new Float64Array(cap),
      y: new Float64Array(cap),
      vx: new Float64Array(cap),
      vy: new Float64Array(cap),
      targetT: o.temperature,
      thermostat: o.thermostat,
      collisions: o.collisions,
      thermostatTau: o.thermostatTau,
      pistonSpeed: o.pistonSpeed,
      time: 0,
      /* momentum handed to each wall since the last flush, and the hit count */
      impulse: { left: 0, right: 0, top: 0, bottom: 0 },
      hits: 0,
      /* per-wall "glow" for the renderer: momentum in the last frame */
      wallFlash: { left: 0, right: 0, top: 0, bottom: 0 },
      pEma: 0,
      hitsEma: 0,
      emaTau: o.emaTau,
      emaPrimed: false,
      /* a measurement window for the guided experiments */
      window: null,
      /* collision grid, rebuilt each substep */
      grid: { cell: 1, nx: 1, ny: 1, head: new Int32Array(1), next: new Int32Array(cap) }
    };
    addParticles(gas, o.count, o.temperature);
    return gas;
  }

  function area(gas) { return gas.W * gas.H; }
  function perimeter(gas) { return 2 * (gas.W + gas.H); }

  /* Temperature from the kinetic energy actually present. */
  function temperature(gas) {
    if (gas.N === 0) return 0;
    let s = 0;
    for (let i = 0; i < gas.N; i++) s += gas.vx[i] * gas.vx[i] + gas.vy[i] * gas.vy[i];
    return s / (gas.N * DOF);
  }

  function kineticEnergy(gas) {
    let s = 0;
    for (let i = 0; i < gas.N; i++) s += gas.vx[i] * gas.vx[i] + gas.vy[i] * gas.vy[i];
    return 0.5 * s;
  }

  function maxSpeed(gas) {
    let m = 0;
    for (let i = 0; i < gas.N; i++) {
      const s = gas.vx[i] * gas.vx[i] + gas.vy[i] * gas.vy[i];
      if (s > m) m = s;
    }
    return Math.sqrt(m);
  }

  /* The prediction under test. */
  function idealPressure(N, T, A) { return A > 0 ? (N * T) / A : 0; }

  /* Place n new particles at random non-overlapping positions, with speeds
     drawn from the 2D Maxwell distribution at temperature T (each velocity
     component is Gaussian with variance T when m = k_B = 1). */
  function addParticles(gas, n, T) {
    const want = Math.min(gas.cap, gas.N + n);
    const r = gas.r;
    const twoR2 = (2 * r) * (2 * r);
    const temp = T === undefined ? gas.targetT : T;
    let attempts = 0;
    while (gas.N < want && attempts < 20000) {
      attempts++;
      const px = r + gas.rng() * (gas.W - 2 * r);
      const py = r + gas.rng() * (gas.H - 2 * r);
      let ok = true;
      if (gas.collisions) {
        for (let j = 0; j < gas.N; j++) {
          const dx = gas.x[j] - px, dy = gas.y[j] - py;
          if (dx * dx + dy * dy < twoR2) { ok = false; break; }
        }
      }
      if (!ok) continue;
      const i = gas.N++;
      gas.x[i] = px; gas.y[i] = py;
      const s = Math.sqrt(temp);
      gas.vx[i] = gaussian(gas.rng) * s;
      gas.vy[i] = gaussian(gas.rng) * s;
    }
    return gas.N;
  }

  function removeParticles(gas, n) {
    gas.N = Math.max(0, gas.N - n);
    return gas.N;
  }

  function setCount(gas, n) {
    n = Math.round(clamp(n, LIMITS.count[0], Math.min(LIMITS.count[1], gas.cap)));
    if (n > gas.N) addParticles(gas, n - gas.N, gas.thermostat ? gas.targetT : temperature(gas));
    else if (n < gas.N) removeParticles(gas, gas.N - n);
    return gas.N;
  }

  /* Scale every velocity so the measured temperature equals T exactly. This
     keeps the SHAPE of the speed distribution and changes only its width. */
  function rescaleTo(gas, T) {
    const now = temperature(gas);
    if (now <= 0 || gas.N === 0) return;
    const k = Math.sqrt(T / now);
    for (let i = 0; i < gas.N; i++) { gas.vx[i] *= k; gas.vy[i] *= k; }
  }

  function setTemperature(gas, T, immediate) {
    gas.targetT = clamp(T, LIMITS.temperature[0], LIMITS.temperature[1]);
    if (immediate) rescaleTo(gas, gas.targetT);
  }

  function setRadius(gas, r) {
    gas.r = clamp(r, LIMITS.radius[0], LIMITS.radius[1]);
    /* Growing the discs can leave some overlapping; a few silent relaxation
       passes push them apart before the next visible step. */
    if (gas.collisions) for (let k = 0; k < 6; k++) resolvePairs(gas, true);
    keepInside(gas);
  }

  function setBoxWidth(gas, W) {
    gas.pistonTarget = clamp(W, LIMITS.boxWidth[0], LIMITS.boxWidth[1]);
  }

  /* Any particle left outside the box (a fast piston move, a radius change)
     is put back just inside; velocity untouched. */
  function keepInside(gas) {
    const r = gas.r;
    for (let i = 0; i < gas.N; i++) {
      if (gas.x[i] < r) gas.x[i] = r;
      if (gas.x[i] > gas.W - r) gas.x[i] = gas.W - r;
      if (gas.y[i] < r) gas.y[i] = r;
      if (gas.y[i] > gas.H - r) gas.y[i] = gas.H - r;
    }
  }

  /* ---- one substep ---------------------------------------------------------- */

  function movePiston(gas, dt) {
    const gap = gas.pistonTarget - gas.W;
    if (Math.abs(gap) < 1e-9) { gas.pistonU = 0; return; }
    const step = Math.sign(gap) * Math.min(Math.abs(gap), gas.pistonSpeed * dt);
    gas.W += step;
    gas.pistonU = step / dt;
    if (Math.abs(gas.pistonTarget - gas.W) < 1e-9) gas.W = gas.pistonTarget;
  }

  /* Walls. Each reflection REFLECTS the position about the wall rather than
     clamping it — a clamp would shorten the path and inject energy. The
     right wall may be moving at pistonU: in the wall's frame the particle
     reflects normally, which in the lab frame is vx' = -vx + 2u. That is the
     whole mechanism of adiabatic heating: a wall moving inward hands energy
     to every particle that bounces off it. The momentum the wall receives is
     |vx' - vx|, which is 2|vx| for a wall at rest. */
  function reflectWalls(gas) {
    const r = gas.r, W = gas.W, H = gas.H, u = gas.pistonU;
    const x = gas.x, y = gas.y, vx = gas.vx, vy = gas.vy;
    const imp = gas.impulse;
    for (let i = 0; i < gas.N; i++) {
      if (x[i] < r) {
        x[i] = 2 * r - x[i];
        if (vx[i] < 0) { imp.left += 2 * -vx[i]; vx[i] = -vx[i]; gas.hits++; }
      } else if (x[i] > W - r) {
        x[i] = 2 * (W - r) - x[i];
        if (vx[i] > u) {
          const after = -vx[i] + 2 * u;
          imp.right += Math.abs(after - vx[i]);
          vx[i] = after;
          gas.hits++;
        }
        if (x[i] > W - r) x[i] = W - r;
        if (x[i] < r) x[i] = r;
      }
      if (y[i] < r) {
        y[i] = 2 * r - y[i];
        if (vy[i] < 0) { imp.bottom += 2 * -vy[i]; vy[i] = -vy[i]; gas.hits++; }
      } else if (y[i] > H - r) {
        y[i] = 2 * (H - r) - y[i];
        if (vy[i] > 0) { imp.top += 2 * vy[i]; vy[i] = -vy[i]; gas.hits++; }
      }
    }
  }

  /* Elastic disc–disc collisions through a uniform grid. Equal masses, so
     the two particles simply exchange the components of velocity along the
     line of centres; that conserves momentum and kinetic energy exactly.
     Overlap is removed by moving positions apart, which touches no velocity.
     With positionsOnly set, the velocity exchange is skipped (used to relax
     overlaps after a radius change without a spurious kick). */
  function resolvePairs(gas, positionsOnly) {
    const r = gas.r, N = gas.N;
    if (N < 2) return;
    const g = gas.grid;
    const cell = Math.max(2 * r * 1.05, 1e-6);
    const nx = Math.max(1, Math.ceil(gas.W / cell));
    const ny = Math.max(1, Math.ceil(gas.H / cell));
    if (g.head.length < nx * ny) g.head = new Int32Array(nx * ny);
    g.head.fill(-1, 0, nx * ny);
    const head = g.head, next = g.next;
    const x = gas.x, y = gas.y, vx = gas.vx, vy = gas.vy;
    for (let i = 0; i < N; i++) {
      const cx = clamp(Math.floor(x[i] / cell), 0, nx - 1);
      const cy = clamp(Math.floor(y[i] / cell), 0, ny - 1);
      const c = cy * nx + cx;
      next[i] = head[c];
      head[c] = i;
    }
    const twoR = 2 * r, twoR2 = twoR * twoR;
    for (let cy = 0; cy < ny; cy++) {
      for (let cx = 0; cx < nx; cx++) {
        for (let i = head[cy * nx + cx]; i !== -1; i = next[i]) {
          for (let oy = -1; oy <= 1; oy++) {
            const yy = cy + oy;
            if (yy < 0 || yy >= ny) continue;
            for (let ox = -1; ox <= 1; ox++) {
              const xx = cx + ox;
              if (xx < 0 || xx >= nx) continue;
              for (let j = head[yy * nx + xx]; j !== -1; j = next[j]) {
                if (j <= i) continue;
                const dx = x[j] - x[i], dy = y[j] - y[i];
                const d2 = dx * dx + dy * dy;
                if (d2 >= twoR2 || d2 === 0) continue;
                const d = Math.sqrt(d2);
                const nxu = dx / d, nyu = dy / d;
                if (!positionsOnly) {
                  const vn = (vx[i] - vx[j]) * nxu + (vy[i] - vy[j]) * nyu;
                  if (vn > 0) {
                    vx[i] -= vn * nxu; vy[i] -= vn * nyu;
                    vx[j] += vn * nxu; vy[j] += vn * nyu;
                  }
                }
                const push = (twoR - d) / 2 + 1e-6;
                x[i] -= push * nxu; y[i] -= push * nyu;
                x[j] += push * nxu; y[j] += push * nyu;
              }
            }
          }
        }
      }
    }
  }

  /* The thermostat: pull the measured temperature toward the target by
     rescaling every velocity a little each step. It changes the width of the
     speed distribution and nothing else. */
  function thermostatStep(gas, dt) {
    const now = temperature(gas);
    if (now <= 0) return;
    const lambda = 1 - Math.exp(-dt / gas.thermostatTau);
    const k = Math.sqrt(1 + lambda * (gas.targetT / now - 1));
    for (let i = 0; i < gas.N; i++) { gas.vx[i] *= k; gas.vy[i] *= k; }
  }

  function substep(gas, dt) {
    movePiston(gas, dt);
    const x = gas.x, y = gas.y, vx = gas.vx, vy = gas.vy;
    for (let i = 0; i < gas.N; i++) { x[i] += vx[i] * dt; y[i] += vy[i] * dt; }
    reflectWalls(gas);
    if (gas.collisions) resolvePairs(gas, false);
    if (gas.thermostat) thermostatStep(gas, dt);
    gas.time += dt;
  }

  /* Advance by one frame of simulated time, in enough substeps that no
     particle moves more than about one radius per substep (so disc–disc
     collisions are not tunnelled through). Wall reflections are exact for
     any overshoot, so the substep count is about pair collisions only.
     Returns the frame's measurements and flushes the wall accumulators. */
  function advance(gas, simDt) {
    simDt = clamp(simDt, 0, 0.25);
    const vmax = Math.max(maxSpeed(gas), Math.abs(gas.pistonU), 1e-6);
    const n = clamp(Math.ceil((vmax * simDt) / gas.r), 1, 40);
    const dt = simDt / n;
    for (let k = 0; k < n; k++) substep(gas, dt);
    return flushFrame(gas, simDt);
  }

  /* Pressure this frame = momentum delivered to all four walls, divided by
     the frame's duration and by the total wall length. The exponential moving
     average is what the readout shows; the raw number is kept too because the
     noise is honest evidence of how a gauge on a finite gas behaves. */
  function flushFrame(gas, simDt) {
    const imp = gas.impulse;
    const total = imp.left + imp.right + imp.top + imp.bottom;
    const per = perimeter(gas);
    const pInst = simDt > 0 ? total / (simDt * per) : 0;
    const hitRate = simDt > 0 ? gas.hits / simDt : 0;
    if (!gas.emaPrimed) { gas.pEma = pInst; gas.hitsEma = hitRate; gas.emaPrimed = true; }
    else {
      const a = 1 - Math.exp(-simDt / gas.emaTau);
      gas.pEma += a * (pInst - gas.pEma);
      gas.hitsEma += a * (hitRate - gas.hitsEma);
    }
    if (gas.window) {
      const w = gas.window;
      w.impulse += total;
      w.hits += gas.hits;
      w.seconds += simDt;
      w.tSum += temperature(gas) * simDt;
      w.aSum += area(gas) * simDt;
      w.perSum += per * simDt;
      w.nSum += gas.N * simDt;
    }
    gas.wallFlash = { left: imp.left, right: imp.right, top: imp.top, bottom: imp.bottom };
    const hits = gas.hits;
    imp.left = imp.right = imp.top = imp.bottom = 0;
    gas.hits = 0;
    const T = temperature(gas);
    const A = area(gas);
    return {
      time: gas.time,
      N: gas.N,
      T,
      A,
      pInst,
      pEma: gas.pEma,
      pIdeal: idealPressure(gas.N, T, A),
      hitsPerSecond: gas.hitsEma,
      hitsThisFrame: hits,
      kineticEnergy: kineticEnergy(gas),
      pistonMoving: gas.pistonU !== 0
    };
  }

  /* ---- measurement windows (the guided experiments) ------------------------- */

  function beginWindow(gas) {
    gas.window = { impulse: 0, hits: 0, seconds: 0, tSum: 0, aSum: 0, perSum: 0, nSum: 0 };
  }

  /* Close the window and report the time-averaged pressure over it, with a
     rough uncertainty. The uncertainty is REASONED, not measured: with H wall
     hits counted, the relative scatter of the total is about 1/sqrt(H) (a
     Poisson count with some extra spread from the hit-to-hit momentum
     variation), so the band shown is P/sqrt(H). It is a guide to how far to
     trust the last digit, not a confidence interval. */
  function endWindow(gas) {
    const w = gas.window;
    gas.window = null;
    if (!w || w.seconds <= 0) return null;
    const per = w.perSum / w.seconds;
    const P = w.impulse / (w.seconds * per);
    const T = w.tSum / w.seconds;
    const A = w.aSum / w.seconds;
    const N = w.nSum / w.seconds;
    const pIdeal = idealPressure(N, T, A);
    return {
      P, T, A, N, pIdeal,
      hits: w.hits,
      seconds: w.seconds,
      uncertainty: w.hits > 0 ? P / Math.sqrt(w.hits) : Infinity,
      ratio: pIdeal > 0 ? P / pIdeal : NaN
    };
  }

  /* ---- theory the page draws alongside the measurements -------------------- */

  /* 2D Maxwell (Rayleigh) speed distribution at temperature T, m = k_B = 1:
     f(v) = (v / T) · exp(-v² / 2T). Integrates to 1 over v ≥ 0. */
  function maxwellSpeedPdf(v, T) {
    if (T <= 0 || v < 0) return 0;
    return (v / T) * Math.exp(-(v * v) / (2 * T));
  }

  function meanSpeed(T) { return Math.sqrt((Math.PI * T) / 2); }
  function rmsSpeed(T) { return Math.sqrt(DOF * T); }

  function speedHistogram(gas, bins, vMax) {
    const counts = new Array(bins).fill(0);
    const w = vMax / bins;
    for (let i = 0; i < gas.N; i++) {
      const v = Math.hypot(gas.vx[i], gas.vy[i]);
      const b = Math.min(bins - 1, Math.floor(v / w));
      counts[b]++;
    }
    return { counts, binWidth: w };
  }

  /* Packing fraction: how much of the box the discs themselves cover. */
  function packingFraction(N, r, A) { return A > 0 ? (N * Math.PI * r * r) / A : 0; }

  /* A first-order excluded-area estimate of how far above the ideal law the
     measured pressure should sit. Two discs of radius r cannot bring their
     centres closer than 2r, so each pair excludes a disc of area π(2r)² =
     4πr²; sharing that between the two gives b = 2πr² of "room lost" per
     particle. The free area is then about A − N·b, and P ≈ N·T / (A − N·b),
     so Z = P·A/(N·T) ≈ 1 / (1 − 2η) with η the packing fraction. This is the
     leading term only and overstates Z at higher packing; it is offered as a
     REASONED estimate of direction and rough size, not a fitted law. */
  function excludedAreaZ(N, r, A) {
    const eta = packingFraction(N, r, A);
    const denom = 1 - 2 * eta;
    return denom > 0.05 ? 1 / denom : Infinity;
  }

  /* Expected wall-hit rate for an ideal gas at (N, T, A), used by the guide
     to say how steady a reading to expect: hits per second per unit wall =
     (N/A) · <|v_perp|> / 2, and <|v_perp|> = sqrt(2T/π) for a Gaussian
     component of variance T. Multiply by the perimeter for the total. */
  function expectedHitRate(N, T, W, H) {
    return 2 * (W + H) * (N / (W * H)) * Math.sqrt((2 * T) / Math.PI) / 2;
  }

  return Object.freeze({
    DOF, DEFAULTS, LIMITS, clamp, seeded,
    createGas, area, perimeter, temperature, kineticEnergy, maxSpeed,
    idealPressure, addParticles, removeParticles, setCount, rescaleTo,
    setTemperature, setRadius, setBoxWidth, keepInside, advance,
    beginWindow, endWindow,
    maxwellSpeedPdf, meanSpeed, rmsSpeed, speedHistogram,
    packingFraction, excludedAreaZ, expectedHitRate
  });
})();

if (typeof module !== 'undefined' && module.exports) module.exports = IdealGasModel;
