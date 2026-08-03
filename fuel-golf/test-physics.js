/* Fuel Golf — physics playtest harness.
   Runs against the SHIPPED game code (game.js exports its physics core).
   node test-physics.js
*/
'use strict';
const G = require('./game.js');
const { DT, LEVELS, elements, step, startState, propagate, timeToApsis, burnDir, applyBurn } = G;

let failures = 0;
function check(name, cond, detail) {
  console.log((cond ? '  PASS ' : '  FAIL ') + name + (detail ? '  [' + detail + ']' : ''));
  if (!cond) failures++;
}
const clone = (s) => ({ t: s.t, x: s.x, y: s.y, vx: s.vx, vy: s.vy, ax: undefined, ay: undefined });

function advance(lvl, s, T, dt = DT) {
  const steps = Math.ceil(T / dt);
  const d = T / steps;
  for (let i = 0; i < steps; i++) step(lvl, s, d);
  return s;
}

/* does the craft escape (planet-relative eps>0 AND r>escapeR) within maxT? */
function escapes(lvl, s0, maxT) {
  const s = clone(s0);
  const dt = DT * 2;
  const steps = Math.ceil(maxT / dt);
  for (let i = 0; i < steps; i++) {
    step(lvl, s, dt);
    const r = Math.hypot(s.x, s.y);
    if (r < lvl.planetR) return false; // crash
    if (i % 8 === 0) {
      const el = elements(lvl, s);
      if (el.eps > 0 && r > lvl.escapeR) return true;
    }
  }
  return false;
}

/* minimal prograde dv at the craft's CURRENT position that escapes, by bisection */
function minEscapeDv(lvl, s0, lo = 0, hi = 16, maxT = 1500) {
  const test = (dv) => {
    const s = clone(s0);
    const d = burnDir(s, 'prograde', 0);
    applyBurn(s, d.x * dv, d.y * dv);
    return escapes(lvl, s, maxT);
  };
  if (!test(hi)) return Infinity;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (test(mid)) hi = mid; else lo = mid;
  }
  return hi;
}

/* ============ 1. integrator stability: unburned orbit stays closed ============ */
console.log('\n[1] Integrator stability (level 1 start orbit, 50 periods)');
{
  const lvl = LEVELS[0];
  const s = startState(lvl);
  const el0 = elements(lvl, s);
  const T = 2 * Math.PI * Math.sqrt(Math.pow(el0.a, 3) / lvl.mu);
  let rMin = Infinity, rMax = -Infinity;
  const steps = Math.ceil(50 * T / DT);
  for (let i = 0; i < steps; i++) {
    step(lvl, s, DT);
    const r = Math.hypot(s.x, s.y);
    if (r < rMin) rMin = r;
    if (r > rMax) rMax = r;
  }
  const el1 = elements(lvl, s);
  const eDrift = Math.abs((el1.eps - el0.eps) / el0.eps);
  check('energy drift < 1e-6 over 50 periods', eDrift < 1e-6, 'drift=' + eDrift.toExponential(2));
  check('periapsis stays within 0.5% of ' + el0.rp.toFixed(1), Math.abs(rMin - el0.rp) / el0.rp < 0.005, 'rMin=' + rMin.toFixed(2));
  check('apoapsis stays within 0.5% of ' + el0.ra.toFixed(1), Math.abs(rMax - el0.ra) / el0.ra < 0.005, 'rMax=' + rMax.toFixed(2));
  check('eccentricity preserved', Math.abs(el1.e - el0.e) < 1e-4, 'e0=' + el0.e.toFixed(6) + ' e1=' + el1.e.toFixed(6));
}

/* ============ 2. Oberth: the whole point ============ */
console.log('\n[2] Level 3 "Escape Artist": periapsis burn must crush apoapsis burn');
let dvPeri, dvApo;
{
  const lvl = LEVELS[2];
  const par = lvl.par;

  const sP = startState(lvl);
  const tP = timeToApsis(lvl, sP, 'pe');
  advance(lvl, sP, tP);
  const elP = elements(lvl, sP);
  dvPeri = minEscapeDv(lvl, sP);

  const sA = startState(lvl); // spawns at apoapsis already
  const elA = elements(lvl, sA);
  dvApo = minEscapeDv(lvl, sA);

  console.log('    v at periapsis = ' + elP.v.toFixed(2) + ', v at apoapsis = ' + elA.v.toFixed(2));
  console.log('    min escape dv: periapsis = ' + dvPeri.toFixed(3) + ', apoapsis = ' + dvApo.toFixed(3) + ', par = ' + par);
  check('simulated periapsis dv matches theory (vesc - vp)', Math.abs(dvPeri - (Math.sqrt(2 * lvl.mu / elP.r) - elP.v)) < 0.15,
        'theory=' + (Math.sqrt(2 * lvl.mu / elP.r) - elP.v).toFixed(3));
  check('periapsis beats apoapsis by a wide margin (>2x)', dvApo / dvPeri > 2, 'ratio=' + (dvApo / dvPeri).toFixed(2) + 'x');
  check('par achievable at periapsis (dvPeri <= par - 0.3)', dvPeri <= par - 0.3);
  check('par IMPOSSIBLE from apoapsis (dvApo > par + 3)', dvApo > par + 3);
  check('equal-dv comparison: par-sized burn escapes at Pe, not at Ap', (() => {
    const a = clone(startState(lvl)); const tp = timeToApsis(lvl, a, 'pe'); advance(lvl, a, tp);
    const d1 = burnDir(a, 'prograde', 0); applyBurn(a, d1.x * par, d1.y * par);
    const b = startState(lvl);
    const d2 = burnDir(b, 'prograde', 0); applyBurn(b, d2.x * par, d2.y * par);
    return escapes(lvl, a, 1500) && !escapes(lvl, b, 1500);
  })());
  check('tank (13) allows the wasteful apoapsis strategy to still escape', dvApo < lvl.fuel, 'so students can discover the difference');
}

/* ============ 3. pars for levels 1, 2, 4 ============ */
console.log('\n[3] Par sanity on levels 1, 2, 4 (ideal strategy must fit under par)');
{
  // L1: circularize at apoapsis
  const lvl = LEVELS[0];
  const s = startState(lvl); // at apoapsis
  const el = elements(lvl, s);
  const dvNeed = Math.sqrt(lvl.mu / el.r) - el.v;
  const d = burnDir(s, 'prograde', 0); applyBurn(s, d.x * dvNeed, d.y * dvNeed);
  const el2 = elements(lvl, s);
  const g = lvl.goal;
  check('L1 ideal circularization dv=' + dvNeed.toFixed(2) + ' <= par-0.3 (' + lvl.par + ')', dvNeed <= lvl.par - 0.3);
  check('L1 goal check passes after ideal burn', el2.e <= g.emax && Math.abs(el2.a - g.a) <= g.band,
        'e=' + el2.e.toFixed(4) + ' a=' + el2.a.toFixed(1));
}
{
  // L2: raise apoapsis from circular orbit
  const lvl = LEVELS[1];
  const s = startState(lvl);
  const el = elements(lvl, s);
  const target = (lvl.goal.min + lvl.goal.max) / 2;
  const aT = (el.r + target) / 2;
  const vNew = Math.sqrt(lvl.mu * (2 / el.r - 1 / aT));
  const dvNeed = vNew - el.v;
  const d = burnDir(s, 'prograde', 0); applyBurn(s, d.x * dvNeed, d.y * dvNeed);
  const el2 = elements(lvl, s);
  check('L2 ideal raise dv=' + dvNeed.toFixed(2) + ' <= par-0.3 (' + lvl.par + ')', dvNeed <= lvl.par - 0.3);
  check('L2 goal check passes after ideal burn', el2.ra >= lvl.goal.min && el2.ra <= lvl.goal.max, 'ra=' + el2.ra.toFixed(1));
}
{
  // L4: Hohmann transfer, both burns simulated through the integrator
  const lvl = LEVELS[3];
  const s = startState(lvl);
  const el = elements(lvl, s);
  const target = lvl.goal.a;
  const aT = (el.r + target) / 2;
  const dv1 = Math.sqrt(lvl.mu * (2 / el.r - 1 / aT)) - el.v;
  let d = burnDir(s, 'prograde', 0); applyBurn(s, d.x * dv1, d.y * dv1);
  const tA = timeToApsis(lvl, s, 'ap');
  advance(lvl, s, tA);
  const elA = elements(lvl, s);
  const dv2 = Math.sqrt(lvl.mu / elA.r) - elA.v;
  d = burnDir(s, 'prograde', 0); applyBurn(s, d.x * dv2, d.y * dv2);
  const el2 = elements(lvl, s);
  const total = dv1 + dv2;
  console.log('    Hohmann via sim: dv1=' + dv1.toFixed(2) + ' dv2=' + dv2.toFixed(2) + ' total=' + total.toFixed(2) + ' par=' + lvl.par);
  check('L4 Hohmann total <= par-0.3', total <= lvl.par - 0.3);
  check('L4 goal check passes after both burns', el2.e <= lvl.goal.emax && Math.abs(el2.a - lvl.goal.a) <= lvl.goal.band,
        'e=' + el2.e.toFixed(3) + ' a=' + el2.a.toFixed(1));
}

/* ============ 4. Level 5 powered flyby ============ */
console.log('\n[4] Level 5 "Powered Flyby": assist must beat par; direct escape must not');
{
  const lvl = LEVELS[4];
  // direct escape cost from the starting circular orbit (ignore assist)
  const s0 = startState(lvl);
  const el0 = elements(lvl, s0);
  const direct = (Math.sqrt(2) - 1) * el0.v;
  console.log('    direct (no-assist, analytic) escape dv = ' + direct.toFixed(2) + ', par = ' + lvl.par);
  check('L5 direct escape is OVER par (forces using the moon)', direct > lvl.par + 0.5);

  // grid search: single prograde burn at time t0, magnitude dv — does the moon assist get us out?
  const Tsyn = 34; // synodic-ish window
  let best = Infinity, bestT = 0;
  for (let t0 = 0; t0 <= Tsyn; t0 += 0.5) {
    const s = advance(lvl, clone(s0), Math.max(t0, 1e-9));
    for (let dv = 6.6; dv <= lvl.par + 0.01; dv += 0.1) {
      if (dv >= best) break;
      const c = clone(s);
      const d = burnDir(c, 'prograde', 0); applyBurn(c, d.x * dv, d.y * dv);
      if (escapes(lvl, c, 900)) { if (dv < best) { best = dv; bestT = t0; } break; }
    }
  }
  console.log('    best single-burn assist escape found: dv=' + (best === Infinity ? 'none' : best.toFixed(2)) + ' at t0=' + bestT);
  check('L5 par beatable with a moon assist (found dv <= par - 0.3)', best <= lvl.par - 0.3, 'best=' + best.toFixed(2));
  check('L5 assist genuinely cheaper than direct', best < direct - 1.5, 'saving=' + (direct - best).toFixed(2));
}

/* ============ 4b. finite-thrust levels 6 & 7 ============ */
console.log('\n[4b] Finite thrust: centered burns (L6) and perigee kicks (L7)');
{
  const { rk4Step } = G;
  const burnUntilEscape = (lvl, s, a, tMax = 800) => {
    const thr = { mode: 'prograde', angle: 0, a };
    let t = 0;
    while (t < tMax) {
      rk4Step(lvl, s, DT, thr); t += DT;
      if (Math.hypot(s.x, s.y) < lvl.planetR) return null;
      if (elements(lvl, s).eps > 0) return a * t;
    }
    return null;
  };
  const burnFor = (lvl, s, a, T) => {
    const thr = { mode: 'prograde', angle: 0, a };
    const n = Math.ceil(T / DT), d = T / n;
    for (let i = 0; i < n; i++) { rk4Step(lvl, s, d, thr); if (elements(lvl, s).eps > 0) return a * d * (i + 1); }
    return a * T;
  };
  const escCostWithLead = (lvl, lead) => {
    const s = startState(lvl);
    const tPe = timeToApsis(lvl, s, 'pe');
    if (tPe - lead <= 0) return null;
    advance(lvl, s, tPe - lead);
    return burnUntilEscape(lvl, s, lvl.engine);
  };

  // L6 (engine 0.35): centered burn must make par; lighting at Pe must miss it
  const lvl6 = LEVELS[5];
  check('L6 has finite engine', isFinite(lvl6.engine) && lvl6.engine === 0.35);
  let bestCentered = Infinity, bestLead = 0;
  for (let lead = 0; lead <= 20; lead += 2) {
    const dv = escCostWithLead(lvl6, lead);
    if (dv !== null && dv < bestCentered) { bestCentered = dv; bestLead = lead; }
  }
  const atPe = escCostWithLead(lvl6, 0);
  console.log('    L6: centered=' + bestCentered.toFixed(2) + ' (lead ' + bestLead + 's), lit-at-Pe=' + atPe.toFixed(2) + ', par=' + lvl6.par + ', impulsive ideal=4.18');
  check('L6 centered burn makes par (<= par - 0.3)', bestCentered <= lvl6.par - 0.3);
  check('L6 burn lit AT periapsis misses par (>= par + 0.4)', atPe >= lvl6.par + 0.4);
  check('L6 finite thrust costs more than the impulsive ideal (gravity loss is real)', bestCentered > 4.3);
  check('L6 tank covers the naive strategy so students can compare', atPe < lvl6.fuel);

  // L7 (engine 0.08): kicks must make par; a single centered burn must not
  const lvl7 = LEVELS[6];
  check('L7 has weak engine', isFinite(lvl7.engine) && lvl7.engine === 0.08);
  let single = Infinity;
  for (let lead = 0; lead <= 60; lead += 4) {
    const dv = escCostWithLead(lvl7, lead);
    if (dv !== null && dv < single) single = dv;
  }
  let kicks = Infinity, kickN = 0;
  {
    const w = 10; // 10s kicks centered on Pe
    const s = startState(lvl7);
    let total = 0, n = 0, ok = false;
    for (let orbit = 0; orbit < 15; orbit++) {
      const tPe = timeToApsis(lvl7, s, 'pe');
      if (tPe === null) break;
      if (tPe - w / 2 > 0) advance(lvl7, s, tPe - w / 2);
      total += burnFor(lvl7, s, lvl7.engine, w); n++;
      if (elements(lvl7, s).eps > 0) { ok = true; break; }
      if (total > 12) break;
    }
    if (ok) { kicks = total; kickN = n; }
  }
  console.log('    L7: kicks=' + kicks.toFixed(2) + ' (' + kickN + ' passes), single-centered=' + single.toFixed(2) + ', par=' + lvl7.par);
  check('L7 perigee kicks make par (<= par - 0.3)', kicks <= lvl7.par - 0.3);
  check('L7 single centered burn CANNOT make par (> par + 3)', single > lvl7.par + 3);
  check('L7 kicks beat the single burn by a wide margin (>1.8x)', single / kicks > 1.8, 'ratio=' + (single / kicks).toFixed(2) + 'x');
  check('L7 tank covers the single-burn strategy for comparison', single < lvl7.fuel);
}

/* ============ 5. helpers the UI depends on ============ */
console.log('\n[5] UI helper sanity');
{
  const lvl = LEVELS[0];
  const s = startState(lvl);
  const tP = timeToApsis(lvl, s, 'pe');
  const tA = timeToApsis(lvl, s, 'ap');
  const el = elements(lvl, s);
  const T = 2 * Math.PI * Math.sqrt(Math.pow(el.a, 3) / lvl.mu);
  check('timeToApsis: from apoapsis, periapsis is ~T/2 away', Math.abs(tP - T / 2) < T * 0.02, 'tP=' + tP.toFixed(1) + ' T/2=' + (T / 2).toFixed(1));
  check('timeToApsis: from apoapsis, next apoapsis is ~T away', Math.abs(tA - T) < T * 0.03, 'tA=' + tA.toFixed(1) + ' T=' + T.toFixed(1));
  const sP = advance(lvl, clone(s), tP);
  const elP = elements(lvl, sP);
  check('warping to Pe actually lands near periapsis radius', Math.abs(elP.r - el.rp) / el.rp < 0.01, 'r=' + elP.r.toFixed(1) + ' rp=' + el.rp.toFixed(1));
  // Oberth readout: dε/dΔv along prograde equals v
  const eps0 = elements(lvl, sP).eps;
  const d = burnDir(sP, 'prograde', 0);
  const h = 0.001;
  applyBurn(sP, d.x * h, d.y * h);
  const eps1 = elements(lvl, sP).eps;
  check('HUD claim dε/dΔv = v holds numerically', Math.abs((eps1 - eps0) / h - elP.v) < 0.01,
        'num=' + ((eps1 - eps0) / h).toFixed(3) + ' v=' + elP.v.toFixed(3));
}

console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'ALL CHECKS PASSED') + '\n');
process.exit(failures ? 1 : 0);
