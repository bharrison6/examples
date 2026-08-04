/* =====================================================================
   FUEL GOLF — orbital mechanics golf for the classroom
   Physics: planet-centred Newtonian gravity (+ optional moon, restricted
   three-body with indirect term), integrated with velocity Verlet at a
   fixed substep. Burns are impulsive Δv. Nothing is scripted: the Oberth
   advantage emerges from the integrator.
   The physics + level definitions are exported for Node so the test
   harness (test-physics.js) exercises EXACTLY the shipped code.
   ===================================================================== */
'use strict';

/* ---------------- physics core (pure, DOM-free) ---------------- */

const DT = 1 / 60;           // integrator substep (sim-time units)
const TIME_SCALE = 4;        // sim-time units per real second at 1x warp

/* ---- real-world unit mapping (display only; the sim is scale-free) ----
   The planet IS Earth: radius 6371 km, mu = 398,600 km^3/s^2.
   With the planet drawn at 40 world units, that fixes the length unit,
   and matching mu fixes the time unit. Every displayed number is real. */
const MU_KM = 398600;                                  // km^3/s^2 (Earth)
const KM_PER_U = 6371 / 40;                            // 159.275 km per world unit
const SEC_PER_TU = Math.sqrt(100000 * Math.pow(KM_PER_U, 3) / MU_KM); // ~1007 s per sim-second
const KMS_PER_VU = KM_PER_U / SEC_PER_TU;              // ~0.1582 km/s per speed unit
const MS_PER_VU = KMS_PER_VU * 1000;                   // ~158.2 m/s per speed unit
const EPS_KM = KMS_PER_VU * KMS_PER_VU;                // km^2/s^2 per energy unit
const MS2_PER_AU = MS_PER_VU / SEC_PER_TU;             // ~0.157 m/s^2 per accel unit

function moonPos(lvl, t) {
  const m = lvl.moon;
  const n = Math.sqrt(lvl.mu / (m.R * m.R * m.R)); // circular orbit rate
  const a = m.a0 + n * t;
  return { x: m.R * Math.cos(a), y: m.R * Math.sin(a), n };
}

function accel(lvl, t, x, y) {
  const r2 = x * x + y * y;
  const r = Math.sqrt(r2);
  const k = -lvl.mu / (r2 * r);
  let ax = k * x, ay = k * y;
  if (lvl.moon) {
    const mp = moonPos(lvl, t);
    const dx = mp.x - x, dy = mp.y - y;
    const d2 = dx * dx + dy * dy, d = Math.sqrt(d2);
    const km = lvl.moon.mu / (d2 * d);
    ax += km * dx; ay += km * dy;
    // indirect term: planet frame is non-inertial (moon pulls the planet)
    const R2 = mp.x * mp.x + mp.y * mp.y, R = Math.sqrt(R2);
    const ki = -lvl.moon.mu / (R2 * R);
    ax += ki * mp.x; ay += ki * mp.y;
  }
  return { ax, ay };
}

/* one velocity-Verlet substep; mutates s = {t,x,y,vx,vy,ax,ay} */
function step(lvl, s, dt) {
  if (s.ax === undefined) { const a0 = accel(lvl, s.t, s.x, s.y); s.ax = a0.ax; s.ay = a0.ay; }
  s.x += s.vx * dt + 0.5 * s.ax * dt * dt;
  s.y += s.vy * dt + 0.5 * s.ay * dt * dt;
  const a1 = accel(lvl, s.t + dt, s.x, s.y);
  s.vx += 0.5 * (s.ax + a1.ax) * dt;
  s.vy += 0.5 * (s.ay + a1.ay) * dt;
  s.ax = a1.ax; s.ay = a1.ay;
  s.t += dt;
}

/* osculating elements wrt the planet (two-body; moon ignored) */
function elements(lvl, s) {
  const r = Math.hypot(s.x, s.y);
  const v2 = s.vx * s.vx + s.vy * s.vy;
  const v = Math.sqrt(v2);
  const eps = v2 / 2 - lvl.mu / r;                 // specific orbital energy
  const h = s.x * s.vy - s.y * s.vx;               // specific ang. momentum (z)
  const rv = s.x * s.vx + s.y * s.vy;
  const ex = ((v2 - lvl.mu / r) * s.x - rv * s.vx) / lvl.mu;
  const ey = ((v2 - lvl.mu / r) * s.y - rv * s.vy) / lvl.mu;
  const e = Math.hypot(ex, ey);
  const a = -lvl.mu / (2 * eps);                   // <0 if hyperbolic
  const bound = eps < 0;
  const rp = bound ? a * (1 - e) : (h * h / lvl.mu) / (1 + e);
  const ra = bound ? a * (1 + e) : Infinity;
  return { r, v, eps, h, e, ex, ey, a, rp, ra, bound, rv };
}

function applyBurn(s, dvx, dvy) { s.vx += dvx; s.vy += dvy; s.ax = undefined; }

/* burn direction unit vector for a mode + free angle (rad, CCW from prograde) */
function burnDir(s, mode, angle) {
  const v = Math.hypot(s.vx, s.vy) || 1e-9;
  const px = s.vx / v, py = s.vy / v;              // prograde
  const r = Math.hypot(s.x, s.y) || 1e-9;
  const rx = s.x / r, ry = s.y / r;                // radial out
  switch (mode) {
    case 'prograde':  return { x: px, y: py };
    case 'retrograde':return { x: -px, y: -py };
    case 'radialout': return { x: rx, y: ry };
    case 'radialin':  return { x: -rx, y: -ry };
    case 'free': {
      const c = Math.cos(angle), sn = Math.sin(angle);
      return { x: px * c - py * sn, y: px * sn + py * c };
    }
  }
}

/* one RK4 step, optionally with engine thrust of acceleration thr.a along
   the commanded direction (thr = {mode, angle, a}); direction tracks the
   instantaneous velocity/radius frame — steering losses are ignored.
   Used during finite burns: thrust makes acceleration velocity-dependent,
   which velocity Verlet does not handle; coast phases stay on Verlet. */
function rk4Step(lvl, s, dt, thr) {
  const deriv = (t, x, y, vx, vy) => {
    const g = accel(lvl, t, x, y);
    let ax = g.ax, ay = g.ay;
    if (thr) {
      const d = burnDir({ x, y, vx, vy }, thr.mode, thr.angle);
      ax += d.x * thr.a; ay += d.y * thr.a;
    }
    return [vx, vy, ax, ay];
  };
  const h = dt, h2 = dt / 2;
  const k1 = deriv(s.t, s.x, s.y, s.vx, s.vy);
  const k2 = deriv(s.t + h2, s.x + k1[0] * h2, s.y + k1[1] * h2, s.vx + k1[2] * h2, s.vy + k1[3] * h2);
  const k3 = deriv(s.t + h2, s.x + k2[0] * h2, s.y + k2[1] * h2, s.vx + k2[2] * h2, s.vy + k2[3] * h2);
  const k4 = deriv(s.t + h, s.x + k3[0] * h, s.y + k3[1] * h, s.vx + k3[2] * h, s.vy + k3[3] * h);
  s.x += h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
  s.y += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  s.vx += h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
  s.vy += h / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
  s.t += h;
  s.ax = undefined; s.ay = undefined;
}

/* build a starting state from a level's start spec (placed at apoapsis,
   or anywhere on a circular orbit), prograde CCW */
function startState(lvl) {
  const st = lvl.start;
  let r, vmag;
  if (st.circular) { r = st.r; vmag = Math.sqrt(lvl.mu / r); }
  else { // ellipse from rp/ra, spawn at apoapsis
    const a = (st.rp + st.ra) / 2;
    r = st.ra;
    vmag = Math.sqrt(lvl.mu * (2 / r - 1 / a));
  }
  const th = (st.angle !== undefined ? st.angle : Math.PI * 0.75);
  const x = r * Math.cos(th), y = r * Math.sin(th);
  // velocity perpendicular to radius, CCW
  const vx = -vmag * Math.sin(th), vy = vmag * Math.cos(th);
  return { t: 0, x, y, vx, vy, ax: undefined, ay: undefined };
}

/* integrate a copy forward; cb(state) each step may return true to stop */
function propagate(lvl, s0, dt, maxSteps, cb) {
  const s = { t: s0.t, x: s0.x, y: s0.y, vx: s0.vx, vy: s0.vy, ax: undefined, ay: undefined };
  for (let i = 0; i < maxSteps; i++) {
    step(lvl, s, dt);
    if (cb && cb(s, i)) break;
  }
  return s;
}

/* time (from now) to next periapsis/apoapsis, by watching radial velocity
   sign change in a coarse propagation. Returns sim-time dt or null. */
function timeToApsis(lvl, s0, which) {
  const dt = DT * 4;
  let prev = s0.x * s0.vx + s0.y * s0.vy;
  let found = null;
  propagate(lvl, s0, dt, 300000, (s) => {
    const rv = s.x * s.vx + s.y * s.vy;
    const hit = which === 'pe' ? (prev < 0 && rv >= 0) : (prev > 0 && rv <= 0);
    prev = rv;
    if (hit) { found = s.t - s0.t; return true; }
    return false;
  });
  return found;
}

/* ---------------- level definitions ---------------- */
/* mu is the planet's gravitational parameter in world units (px, sim-s). */

const LEVELS = [
  {
    id: 1, name: 'Orbit School', subtitle: 'Circularize your orbit',
    mu: 100000, planetR: 40, escapeR: 2200, fuel: 8, par: 4.5,
    start: { rp: 150, ra: 350 },
    goal: { type: 'circular', a: 350, band: 25, emax: 0.06 },
    view: 900,
    hint: 'Your orbit is an ellipse. Make it a circle matching the green ring. Tip: warp to apoapsis (→ Ap) — the top of your orbit — and burn prograde until the dotted preview looks circular. Watch the preview before you commit!',
    debriefIdeal: 'Circularizing costs least with a single prograde burn exactly at apoapsis.',
  },
  {
    id: 2, name: 'Reach Higher', subtitle: 'Raise apoapsis to the target ring',
    mu: 100000, planetR: 40, escapeR: 2200, fuel: 12, par: 7.0,
    start: { circular: true, r: 150 },
    goal: { type: 'apoapsis', min: 460, max: 540 },
    view: 1250,
    hint: 'Swing your apoapsis — the yellow Ap dot — into the yellow ring. You do NOT need to circularize: the mission completes the moment your orbit\'s high point falls inside the band. A prograde burn raises the opposite side of your orbit. Where on the orbit does one unit of Δv move apoapsis the most?',
    debriefIdeal: 'A prograde burn low and fast raises the opposite side of the orbit most per unit of Δv.',
  },
  {
    id: 3, name: 'Escape Artist', subtitle: 'Escape the planet — for par',
    mu: 100000, planetR: 40, escapeR: 1500, fuel: 13, par: 5.0,
    start: { rp: 110, ra: 480 },
    goal: { type: 'escape' },
    view: 1400,
    hint: 'Break free of Earth. Escaping means orbital energy ε > 0 — a giant ellipse still falls back, no matter how far it flies! Watch the ORBIT chip up top (or ε in the HUD). You have 2,057 m/s in the tank but par is only 791. Where does each m/s of Δv buy the most energy?',
    debriefIdeal: 'Escape is cheapest at periapsis: ΔKE = v·Δv + ½Δv², and v is largest at the bottom of the well. This is the Oberth effect.',
  },
  {
    id: 4, name: 'Transfer Window', subtitle: 'Move to the outer circular orbit',
    mu: 100000, planetR: 40, escapeR: 2600, fuel: 18, par: 11.5,
    start: { circular: true, r: 140 },
    goal: { type: 'transfer', a: 420, band: 30, emax: 0.08 },
    view: 1150,
    hint: 'Get into a circular orbit at the outer ring. Two burns needed: one to stretch your orbit out to the ring, one to circularize when you get there. This two-burn path has a name — you are about to rediscover the Hohmann transfer.',
    debriefIdeal: 'The cheap route is a Hohmann transfer: prograde burn to raise apoapsis to the ring, coast half an orbit, prograde burn at apoapsis to circularize.',
  },
  {
    id: 5, name: 'Powered Flyby', subtitle: 'Slingshot past the moon and escape',
    mu: 100000, planetR: 40, escapeR: 1800, fuel: 14, par: 9.0,
    start: { circular: true, r: 130, angle: Math.PI * 0.75 },
    moon: { R: 520, mu: 3500, r: 14, a0: 2.4 },
    goal: { type: 'escape' },
    view: 1600,
    hint: 'Direct escape from here costs ~1,820 m/s — well over par (1,424). But there is a moon. Raise your apoapsis so you sweep close behind it and let its gravity fling you. Time your transfer burn so you and the moon arrive at the same place together.',
    debriefIdeal: 'A gravity assist trades the moon\'s orbital motion for your speed; pairing it with a burn deep in a gravity well is the powered-flyby (Oberth) strategy real missions use.',
  },
  {
    id: 6, name: 'Ignition Window', subtitle: 'Finite thrust — center your burn on periapsis',
    mu: 100000, planetR: 40, escapeR: 1500, fuel: 13, par: 5.3,
    engine: 0.35,
    start: { rp: 110, ra: 480 },
    goal: { type: 'escape' },
    view: 1400,
    hint: 'Same escape as Level 3 — but now your engine is real: it takes TIME to deliver Δv. A full burn lasts a noticeable arc of your orbit. If you light the engine AT periapsis, half your burn happens after the fast point. Start early, so the burn straddles periapsis.',
    debriefIdeal: 'With finite thrust, the cheapest burn is centered on periapsis — half before, half after — so every second of thrust happens as fast as possible.',
  },
  {
    id: 7, name: 'Perigee Kicks', subtitle: 'Weak engine — escape takes several passes',
    mu: 100000, planetR: 40, escapeR: 1500, fuel: 15, par: 5.2,
    engine: 0.08,
    start: { rp: 110, ra: 480 },
    goal: { type: 'escape' },
    view: 1400,
    hint: 'Your engine is now so weak that burning all the Δv at once would smear the burn around most of the orbit — expensive. Real upper stages solve this with perigee kicks: short burns centered on each periapsis pass, over several orbits. Kick, coast, repeat.',
    debriefIdeal: 'Splitting a weak-engine burn into short kicks at successive periapsis passes keeps every unit of Δv near maximum speed. This is exactly how real low-thrust upper stages raise orbits and escape.',
  },
  {
    id: 8, name: 'Sandbox', subtitle: 'Free play — no goal, big tank',
    mu: 100000, planetR: 40, escapeR: 3200, fuel: 200, par: Infinity,
    engineChoices: [Infinity, 0.35, 0.08],
    start: { rp: 160, ra: 420 },
    moon: { R: 700, mu: 4000, r: 16, a0: 0.8 },
    goal: { type: 'sandbox' },
    view: 1700,
    hint: 'No mission. Break orbits, chase the moon, see how cheaply you can escape, or how low you can skim the planet. Swap engines in the burn planner to compare impulsive vs finite thrust. The HUD is your lab bench.',
    debriefIdeal: '',
  },
];

/* ---------------- exports for the Node test harness ---------------- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DT, LEVELS, accel, step, rk4Step, elements, applyBurn, burnDir, startState, propagate, timeToApsis, moonPos };
}

/* =====================================================================
   BROWSER GAME — everything below only runs with a DOM
   ===================================================================== */
if (typeof document !== 'undefined') (() => {

const $ = (id) => document.getElementById(id);
const canvas = $('space');
const ctx = canvas.getContext('2d');

/* ---------- real-unit display formatters ---------- */
const uMS = (vu) => Math.round(vu * MS_PER_VU);                       // Δv, m/s
const uKMS = (vu) => (vu * KMS_PER_VU);                               // speed, km/s
const uKM = (u) => Math.round(u * KM_PER_U);                          // distance, km
const uEPS = (eu) => (eu * EPS_KM);                                   // ε, km²/s²
const fmtKm = (u) => uKM(u).toLocaleString('en-US') + ' km';
const fmtMS = (vu) => uMS(vu).toLocaleString('en-US') + ' m/s';
const fmtDur = (tu) => {
  const s = tu * SEC_PER_TU;
  if (s < 5400) return Math.round(s / 60) + ' min';
  if (s < 172800) return (s / 3600).toFixed(1) + ' h';
  return (s / 86400).toFixed(1) + ' d';
};

/* ---------- persistence (guarded: falls back to memory) ---------- */
const store = (() => {
  let mem = {};
  let ok = false;
  try { localStorage.setItem('__fg', '1'); localStorage.removeItem('__fg'); ok = true; } catch (e) { ok = false; }
  return {
    get(k, d) { try { if (ok) { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } } catch (e) {} return (k in mem) ? mem[k] : d; },
    set(k, v) { try { if (ok) { localStorage.setItem(k, JSON.stringify(v)); return; } } catch (e) {} mem[k] = v; },
    del(k) { try { if (ok) localStorage.removeItem(k); } catch (e) {} delete mem[k]; },
  };
})();
const LB_KEY = (id) => 'fuelgolf_lb_' + id;

/* ---------- small UI helpers ---------- */
function toast(msg, ms) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2200);
}
function showHint(text, ms) {
  const el = $('hintText');
  if (!el) return;                       // defensive: never let a banner update break the sim
  el.textContent = text;
  $('hint').classList.add('show');
  if (ms) setTimeout(() => { if (el.textContent === text) $('hint').classList.remove('show'); }, ms);
}
function anyModalOpen() { return !!document.querySelector('.modal.show'); }

/* ---------- game state ---------- */
let lvl = null;            // current level object
let S = null;              // craft state {t,x,y,vx,vy,ax,ay}
let warp = 1;
let fuel = 0, dvUsed = 0;
let phase = 'fly';         // fly | planning | done | crashed
let trail = [];
let energyLog = [];        // {t, eps}
let burnLog = [];          // {t, dv, r, v, mode}
let lastELog = -Infinity;
let zoom = 1, targetZoom = 1;
let pendingWarpTo = null;  // sim time remaining to fast-forward
let stars = [];
let plan = { mode: 'prograde', angle: 0, dv: 2 };
let predPath = null;       // predicted polyline for pending burn
let curPath = null;        // current-orbit polyline (recomputed after burns)
let succeededAt = null;
let engine = Infinity;     // current engine accel limit (Infinity = impulsive)
let activeBurn = null;     // {mode, angle, a, dvRemaining, entry} while thrusting
let burnPathTick = 0;
let warnedFallback = false; // one warning per boundary crossing while bound
let orbitChipState = '';
let epsStart = 0;          // ε at level start, anchor for the energy ledger
let undoStack = [];        // snapshots taken immediately before each committed burn
let camX = 0, camY = 0;    // camera centre in world coords
let follow = true;         // camera tracks the craft
let dragging = null;       // {mode:'pan'|'aim', ...} active pointer gesture
let toastTimer = null;
const PROG_KEY = 'fuelgolf_progress';

function resize() {
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  layoutPanels();
}
/* keep the HUD clear of the top bar however many rows it wraps to */
function layoutPanels() {
  const tb = $('topbar');
  if (!tb) return;
  // phones dock the HUD to the bottom via CSS; wider screens sit it under the bar
  $('hud').style.top = window.innerWidth <= 700 ? '' : (tb.offsetHeight + 8) + 'px';
}
window.addEventListener('resize', resize); resize();

function makeStars() {
  stars = [];
  for (let i = 0; i < 260; i++) {
    stars.push({ x: Math.random(), y: Math.random(), s: Math.random() * 1.4 + 0.3, a: Math.random() * 0.5 + 0.15, g: Math.random() < 0.09 });
  }
}
makeStars();

/* ---------- level lifecycle ---------- */
function loadLevel(i) {
  lvl = LEVELS[i];
  S = startState(lvl);
  fuel = lvl.fuel; dvUsed = 0;
  phase = 'fly'; warp = 1; pendingWarpTo = null;
  trail = []; energyLog = []; burnLog = []; lastELog = -Infinity;
  succeededAt = null;
  predPath = null;
  engine = lvl.engine !== undefined ? lvl.engine : (lvl.engineChoices ? lvl.engineChoices[0] : Infinity);
  activeBurn = null;
  warnedFallback = false; orbitChipState = '';
  $('btnCut').style.display = 'none';
  syncEngineRow();
  plan = { mode: 'prograde', angle: 0, dv: Math.min(2, fuel) };
  targetZoom = zoom = Math.min(window.innerWidth, window.innerHeight) / lvl.view;
  epsStart = elements(lvl, S).eps;
  undoStack = [];
  // start framed on the whole system (Earth centred) — follow is an opt-in tool
  camX = 0; camY = 0; setFollow(false);
  syncUndoBtn();
  computeCurPath();
  logEnergy(true);
  syncTop(); syncWarpButtons(); hidePlanner();
  showHint(lvl.hint, 16000);
  closeModal('levelsModal'); closeModal('debriefModal'); closeModal('crashModal');
}

function computeCurPath() {
  apsisCache.t = -1; // orbit changed → countdowns are stale
  // one-orbit polyline of the current (unburned) trajectory, incl. moon effects
  const el = elements(lvl, S);
  const period = el.bound ? 2 * Math.PI * Math.sqrt(Math.pow(el.a, 3) / lvl.mu) : 0;
  const horizon = el.bound ? Math.min(period * 1.02, 4000) : 300;
  const dt = Math.max(DT * 2, horizon / 2600);
  const pts = [];
  propagate(lvl, S, dt, Math.ceil(horizon / dt), (s, i) => {
    if (i % 2 === 0) pts.push([s.x, s.y]);
    return Math.hypot(s.x, s.y) > lvl.escapeR * 1.4;
  });
  curPath = pts;
}

function computePredPath() {
  let s0, burnPts = null, crashInBurn = false;
  if (isFinite(engine) && plan.dv > 0.001) {
    // finite thrust: simulate the powered arc first
    const thr = { mode: plan.mode, angle: plan.angle * Math.PI / 180, a: engine };
    s0 = { t: S.t, x: S.x, y: S.y, vx: S.vx, vy: S.vy, ax: undefined };
    const tBurn = plan.dv / engine;
    const n = Math.max(2, Math.ceil(tBurn / (DT * 2)));
    const dtb = tBurn / n;
    burnPts = [[s0.x, s0.y]];
    for (let i = 0; i < n; i++) {
      rk4Step(lvl, s0, dtb, thr);
      if ((i & 3) === 0) burnPts.push([s0.x, s0.y]);
      if (Math.hypot(s0.x, s0.y) < lvl.planetR) { crashInBurn = true; break; }
    }
    burnPts.push([s0.x, s0.y]);
  } else {
    const dir = burnDir(S, plan.mode, plan.angle * Math.PI / 180);
    s0 = { t: S.t, x: S.x, y: S.y, vx: S.vx + dir.x * plan.dv, vy: S.vy + dir.y * plan.dv, ax: undefined };
  }
  const el = elements(lvl, s0);
  const period = el.bound ? 2 * Math.PI * Math.sqrt(Math.pow(el.a, 3) / lvl.mu) : 0;
  const horizon = el.bound ? Math.min(period * 1.02, 5000) : 500;
  const dt = Math.max(DT * 2, horizon / 3000);
  const pts = [];
  let crash = crashInBurn;
  if (!crashInBurn) propagate(lvl, s0, dt, Math.ceil(horizon / dt), (s, i) => {
    if (i % 2 === 0) pts.push([s.x, s.y]);
    if (Math.hypot(s.x, s.y) < lvl.planetR) { crash = true; return true; }
    return Math.hypot(s.x, s.y) > lvl.escapeR * 1.5;
  });
  predPath = { pts, crash, el, burnPts };
  // planner verdict: what does this burn actually buy?
  const pi = $('predinfo');
  if (crash) {
    pi.innerHTML = '<span style="color:var(--bad)">Predicted: impacts the planet 💥</span>';
  } else if (el.eps > 0) {
    pi.innerHTML = '<span style="color:var(--good)">Predicted: ESCAPE trajectory (ε = +' + uEPS(el.eps).toFixed(2) + ' km²/s²) — leaves and never returns</span>';
  } else {
    let t = 'Predicted orbit: Pe ' + fmtKm(el.rp - lvl.planetR) + ' · Ap ' + fmtKm(el.ra - lvl.planetR) + ' · ε = ' + uEPS(el.eps).toFixed(2) + ' km²/s²';
    if (lvl.goal.type === 'escape') t += ' — <span style="color:var(--warn)">still bound: it will fall back</span>';
    pi.innerHTML = t;
  }
}

/* ---------- undo (rewind to the instant before a burn was committed) ---------- */
function snapshot() {
  return {
    S: { t: S.t, x: S.x, y: S.y, vx: S.vx, vy: S.vy, ax: undefined, ay: undefined },
    fuel, dvUsed,
    burnLog: burnLog.map(b => Object.assign({}, b)),
    energyLog: energyLog.slice(),
    trail: trail.slice(),
    lastELog, warnedFallback, engine,
  };
}
function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 12) undoStack.shift();
  syncUndoBtn();
}
function undoBurn() {
  if (!undoStack.length) return;
  const s = undoStack.pop();
  S = s.S; fuel = s.fuel; dvUsed = s.dvUsed;
  burnLog = s.burnLog; energyLog = s.energyLog; trail = s.trail;
  lastELog = s.lastELog; warnedFallback = s.warnedFallback; engine = s.engine;
  activeBurn = null; pendingWarpTo = null; predPath = null;
  phase = 'fly'; warp = 0; orbitChipState = '';
  $('btnCut').style.display = 'none';
  closeModal('crashModal'); closeModal('debriefModal');
  hidePlanner();
  warp = 0; syncWarpButtons();
  computeCurPath(); syncTop(); syncEngineRow(); syncUndoBtn();
  toast('↶ Rewound to before that burn — paused');
}
function syncUndoBtn() { $('btnUndo').disabled = undoStack.length === 0; }

/* ---------- burns ---------- */
function commitBurn() {
  const dv = Math.min(plan.dv, fuel);
  if (dv <= 0.001) return;
  pushUndo();
  const el0 = elements(lvl, S);
  if (isFinite(engine)) {
    // finite thrust: burn executes over time in the main loop
    const entry = { t: S.t, dv: 0, r: el0.r, v: el0.v, vSum: 0, mode: plan.mode,
                    finite: true, aEng: engine, eps0: el0.eps };
    burnLog.push(entry);
    activeBurn = { mode: plan.mode, angle: plan.angle * Math.PI / 180, a: engine, dvRemaining: dv, entry };
    hidePlanner();
    warp = 1; pendingWarpTo = null; syncWarpButtons();
    $('btnCut').style.display = '';
    return;
  }
  const dir = burnDir(S, plan.mode, plan.angle * Math.PI / 180);
  const vDotDv = S.vx * dir.x * dv + S.vy * dir.y * dv; // v⃗·Δv⃗ before the kick
  applyBurn(S, dir.x * dv, dir.y * dv);
  fuel -= dv; dvUsed += dv;
  const el1 = elements(lvl, S);
  burnLog.push({ t: S.t, dv, r: el0.r, v: el0.v, mode: plan.mode,
                 finite: false, vDotDv, eps0: el0.eps, eps1: el1.eps, h1: el1.h });
  logEnergy(true);
  computeCurPath();
  hidePlanner();
  syncTop();
}

function endBurn() {
  if (!activeBurn) return;
  const e = activeBurn.entry;
  if (e.dv > 1e-9) e.v = e.vSum / e.dv; // Δv-weighted average speed during the burn
  const el1 = elements(lvl, S);
  e.eps1 = el1.eps; e.h1 = el1.h; e.dur = S.t - e.t;
  activeBurn = null;
  $('btnCut').style.display = 'none';
  logEnergy(true);
  computeCurPath();
  syncTop();
}

/* ---------- goal / fail detection ---------- */
function checkGoal() {
  if (phase !== 'fly') return;
  const el = elements(lvl, S);
  if (el.r < lvl.planetR + 2) { crashed('planet'); return; }
  if (lvl.moon) {
    const mp = moonPos(lvl, S.t);
    if (Math.hypot(S.x - mp.x, S.y - mp.y) < lvl.moon.r + 2) { crashed('moon'); return; }
  }
  const g = lvl.goal;
  let done = false;
  if (g.type === 'circular') done = el.bound && el.e <= g.emax && Math.abs(el.a - g.a) <= g.band;
  else if (g.type === 'apoapsis') done = el.bound && el.ra >= g.min && el.ra <= g.max && el.rp > lvl.planetR + 10;
  else if (g.type === 'escape') {
    done = el.eps > 0 && el.r > lvl.escapeR;
    // crossed the edge while still bound: explain why it doesn't count
    if (!done && el.eps <= 0 && el.r > lvl.escapeR && !warnedFallback) {
      warnedFallback = true;
      showHint('You crossed the system edge — but your orbital energy is still negative (ε = ' +
        uEPS(el.eps).toFixed(2) + ' km²/s²), so this is just a very tall ellipse: gravity will pull you back. ' +
        'Escape needs ε > 0. More speed — cheapest at periapsis.', 12000);
    }
    if (el.r < lvl.escapeR * 0.9) warnedFallback = false;
  }
  else if (g.type === 'transfer') done = el.bound && el.e <= g.emax && Math.abs(el.a - g.a) <= g.band;
  if (done) succeed();
}

/* ORBIT chip: live bound/escaping state on escape levels */
function syncOrbitChip() {
  const chip = $('orbitChip');
  if (lvl.goal.type !== 'escape') { if (orbitChipState !== 'off') { chip.style.display = 'none'; orbitChipState = 'off'; } return; }
  const el = elements(lvl, S);
  const stateKey = el.eps > 0 ? 'free' : 'bound';
  if (stateKey !== orbitChipState) {
    orbitChipState = stateKey;
    chip.style.display = '';
    if (el.eps > 0) {
      chip.innerHTML = 'ORBIT: <b style="color:var(--good)">ESCAPING (ε &gt; 0)</b>';
    } else {
      chip.innerHTML = 'ORBIT: <b style="color:var(--warn)">BOUND — will fall back</b>';
    }
  }
}

function crashed(what) {
  phase = 'crashed'; pendingWarpTo = null; activeBurn = null;
  $('btnCut').style.display = 'none';
  $('crashMsg').textContent = what === 'moon'
    ? 'Your spacecraft hit the moon. Gravity assists want a close pass — not that close.'
    : 'Your spacecraft hit Earth. In this class, that’s a lab incident report.';
  $('crashUndo').style.display = undoStack.length ? '' : 'none';
  openModal('crashModal');
}

function succeed() {
  phase = 'done'; pendingWarpTo = null; activeBurn = null;
  $('btnCut').style.display = 'none';
  succeededAt = S.t;
  markComplete(lvl.id, dvUsed, lvl.par);
  showDebrief();
}

/* ---------- energy log ---------- */
function logEnergy(force) {
  if (!force && S.t - lastELog < 0.25) return;
  lastELog = S.t;
  const el = elements(lvl, S);
  energyLog.push({ t: S.t, eps: el.eps });
  if (energyLog.length > 6000) energyLog = energyLog.filter((_, i) => i % 2 === 0);
}

/* ---------- debrief ---------- */
function debriefSentence() {
  const el = elements(lvl, S);
  const overPar = dvUsed > lvl.par + 0.05;
  if (!burnLog.length) return 'No burns — a free ride.';
  const main = burnLog.reduce((a, b) => (b.dv > a.dv ? b : a));
  const vmax = Math.max(...burnLog.map(b => b.v), el.v);
  const highSpeedFrac = main.v / vmax;
  let s = '';
  if (!overPar) {
    s = `Under par with ${fmtMS(dvUsed)}. Your biggest burn (${fmtMS(main.dv)}) came at ${uKMS(main.v).toFixed(2)} km/s — `;
    s += highSpeedFrac > 0.75
      ? 'deep and fast in the gravity well, so the v·Δv term of ΔKE = v·Δv + ½Δv² did most of the work. Textbook Oberth.'
      : 'and the mission geometry let you get away with it. Try the same mission burning only at periapsis and watch the margin grow.';
  } else {
    s = `Over par (${fmtMS(dvUsed)} vs ${fmtMS(lvl.par)}). Your biggest burn happened at ${uKMS(main.v).toFixed(2)} km/s while this orbit peaks near ${uKMS(vmax).toFixed(2)} km/s at periapsis — `;
    s += highSpeedFrac < 0.75
      ? 'burning where you were slow means each m/s of Δv bought little energy (ΔKE = v·Δv + ½Δv²). The same burn at periapsis buys far more.'
      : 'the direction or timing spent energy fighting your own orbit. Preview burns with the dotted line and spend Δv in as few, well-placed burns as possible.';
  }
  return s + (lvl.debriefIdeal ? ' ' + lvl.debriefIdeal : '');
}

/* ---------- "show the math" proof panel ---------- */
function orbitFromEpsH(mu, eps, h) {
  // shape of the conic determined purely by (ε, h): e = √(1 + 2εh²/μ²)
  const e = Math.sqrt(Math.max(0, 1 + 2 * eps * h * h / (mu * mu)));
  if (eps >= 0) return { e, hyper: true, vinf: Math.sqrt(2 * eps) };
  const a = -mu / (2 * eps);
  return { e, hyper: false, a, rp: a * (1 - e), ra: a * (1 + e) };
}
function renderMathProof() {
  const mu = lvl.mu;
  // everything below is shown in real units: km, km/s, km²/s² (per unit mass)
  const V = (vu) => uKMS(vu).toFixed(3);          // speed / Δv, km/s
  const E = (eu) => uEPS(eu).toFixed(2);          // ε, km²/s²
  const Es = (eu) => (eu >= 0 ? '+' : '') + uEPS(eu).toFixed(2);
  const R = (u) => uKM(u).toLocaleString('en-US');
  let html = `<div class="mathcard"><div class="mhead">Setup — real Earth numbers</div>
    μ = 398,600 km³/s² (Earth) · specific orbital energy ε = v²/2 − μ/r in km²/s² (per kg) ·
    a burn of Δv changes it by <b>Δε = v⃗·Δv⃗ + ½Δv²</b><br>
    <span class="dim">Starting orbit: ε₀ = ${E(epsStart)} km²/s². Everything below uses only your recorded inputs — the sim never gets a vote it can't justify.</span></div>`;

  let sumBurnEps = 0;
  burnLog.forEach((b, i) => {
    if (b.eps1 === undefined) return; // burn still in progress (shouldn't happen at debrief)
    const dEpsMeasured = b.eps1 - b.eps0;
    sumBurnEps += dEpsMeasured;
    if (!b.finite) {
      const cosT = b.dv > 1e-9 ? Math.max(-1, Math.min(1, b.vDotDv / (b.v * b.dv))) : 1;
      const theta = Math.round(Math.acos(cosT) * 180 / Math.PI);
      const dKE = b.vDotDv + 0.5 * b.dv * b.dv;
      const predicted = b.eps0 + dKE;
      const match = Math.abs(predicted - b.eps1) <= Math.max(0.5, Math.abs(b.eps1) * 0.02);
      const o = orbitFromEpsH(mu, b.eps1, b.h1);
      const orbitLine = o.hyper
        ? `ε′ &gt; 0 → <b>hyperbolic escape</b>, leftover speed at infinity v<sub>∞</sub> = √(2ε′) = ${V(o.vinf)} km/s`
        : `a′ = −μ/2ε′ = ${R(o.a)} km · e′ = √(1 + 2ε′h′²/μ²) = ${o.e.toFixed(3)} → Pe ${R(o.rp - lvl.planetR)} / Ap ${R(o.ra - lvl.planetR)} km alt`;
      html += `<div class="mathcard"><div class="mhead">Burn ${i + 1} — ${b.mode.toUpperCase()}, Δv = ${fmtMS(b.dv)} at r = ${R(b.r)} km (T+${fmtDur(b.t)})</div>
        <span class="mono">before: v = ${V(b.v)} km/s, ε = ${V(b.v)}²/2 − 398600/${R(b.r)} = ${E(b.eps0)} km²/s²</span><br>
        <span class="mono">Δε = v·Δv·cos θ + ½Δv² = ${V(b.v)}·${V(b.dv)}·cos ${theta}° + ½·${V(b.dv)}² = ${Es(b.vDotDv)} ${Es(0.5 * b.dv * b.dv)} = <b>${Es(dKE)} km²/s²</b></span><br>
        <span class="mono">predicted ε′ = ${E(b.eps0)} ${Es(dKE)} = ${E(predicted)} · integrator measured ε′ = ${E(b.eps1)} ${match ? '<span class="ok">✓ matches</span>' : '<span class="warnc">(Δ ' + E(predicted - b.eps1) + ')</span>'}</span><br>
        <span class="mono">new orbit: ${orbitLine}</span></div>`;
    } else {
      const perDv = b.dv > 1e-9 ? dEpsMeasured / b.dv : 0;
      const approx = b.v * b.dv;
      const o = orbitFromEpsH(mu, b.eps1, b.h1);
      const orbitLine = o.hyper
        ? `ε′ &gt; 0 → <b>hyperbolic escape</b>, v<sub>∞</sub> = √(2ε′) = ${V(o.vinf)} km/s`
        : `a′ = −μ/2ε′ = ${R(o.a)} km, e′ = ${o.e.toFixed(3)} → Pe ${R(o.rp - lvl.planetR)} / Ap ${R(o.ra - lvl.planetR)} km alt`;
      html += `<div class="mathcard"><div class="mhead">Burn ${i + 1} — ${b.mode.toUpperCase()} (finite thrust ${(b.aEng * MS2_PER_AU).toFixed(3)} m/s²), Δv = ${fmtMS(b.dv)} over ${fmtDur(b.dur || 0)}</div>
        <span class="mono">Δv-weighted average speed during burn: v̄ = ${V(b.v)} km/s</span><br>
        <span class="mono">Δε ≈ v̄·Δv = ${V(b.v)}·${V(b.dv)} = ${Es(approx)} · integrator measured ${Es(dEpsMeasured)} km²/s² ${Math.abs(approx - dEpsMeasured) <= Math.max(1.5, Math.abs(dEpsMeasured) * 0.05) ? '<span class="ok">✓</span>' : ''}</span><br>
        <span class="dim">(≈ because a spread-out burn buys each slice of Δv at whatever speed you had at that instant — that's the gravity loss)</span><br>
        <span class="mono">energy bought per km/s of Δv: ${(perDv * KMS_PER_VU).toFixed(2)} km²/s² — compare v at periapsis</span><br>
        <span class="mono">new orbit: ${orbitLine}</span></div>`;
    }
  });

  // energy ledger start → finish
  const elF = elements(lvl, S);
  const residual = elF.eps - epsStart - sumBurnEps;
  const hasMoon = !!lvl.moon;
  let ledger = `<span class="mono">ε start ${Es(epsStart)}</span><br>`;
  burnLog.forEach((b, i) => { if (b.eps1 !== undefined) ledger += `<span class="mono">+ burn ${i + 1} ${Es(b.eps1 - b.eps0)}</span><br>`; });
  if (Math.abs(uEPS(residual)) > 0.02 && hasMoon)
    ledger += `<span class="mono">+ moon gravity assist ${Es(residual)} <span class="ok">(cost: 0 fuel!)</span></span><br>`;
  else if (Math.abs(uEPS(residual)) > 0.02)
    ledger += `<span class="mono">+ unmodelled drift ${Es(residual)}</span><br>`;
  ledger += `<span class="mono">= ε final <b>${Es(elF.eps)} km²/s²</b> <span class="dim">(coasting never changes ε — gravity is conservative${hasMoon ? ', except the moon\'s tug' : ''})</span></span><br>`;

  // goal proof
  const g = lvl.goal;
  let proof = '';
  if (g.type === 'escape') {
    proof = `ε final = ${Es(elF.eps)} &gt; 0 and r = ${R(elF.r)} km &gt; system edge ${R(lvl.escapeR)} km → <b>escaped Earth</b> with v<sub>∞</sub> = ${V(Math.sqrt(2 * Math.max(0, elF.eps)))} km/s`;
  } else if (g.type === 'apoapsis') {
    proof = `Ap = a(1+e) = ${R(elF.ra)} km, target band [${R(g.min)}, ${R(g.max)}] km → <b>${elF.ra >= g.min && elF.ra <= g.max ? 'inside ✓' : 'outside'}</b>`;
  } else if (g.type === 'circular' || g.type === 'transfer') {
    proof = `a = ${R(elF.a)} km (target ${R(g.a)} ± ${R(g.band)} km) and e = ${elF.e.toFixed(3)} (≤ ${g.emax}) → <b>${Math.abs(elF.a - g.a) <= g.band && elF.e <= g.emax ? 'inside ✓' : 'outside'}</b>`;
  }
  html += `<div class="mathcard ledger"><div class="mhead">Energy ledger → outcome</div>${ledger}
    <span class="mono">total Δv spent = ${fmtMS(dvUsed)} vs par ${lvl.par === Infinity ? '—' : fmtMS(lvl.par)}</span><br>
    <span class="mono">goal check: ${proof}</span></div>`;

  $('dbMath').innerHTML = html;
}

function showDebrief() {
  const madePar = lvl.par !== Infinity && dvUsed <= lvl.par;
  $('dbEyebrow').textContent = lvl.par === Infinity ? 'Sandbox flight' : (madePar ? '🏆 Par achieved' : 'Mission complete — over par');
  $('debriefTitle').textContent = `Level ${lvl.id}: ${lvl.name}`;
  $('dbDv').textContent = fmtMS(dvUsed);
  $('dbPar').textContent = lvl.par === Infinity ? '—' : fmtMS(lvl.par);
  $('dbBurns').textContent = burnLog.length;
  const diff = dvUsed - lvl.par;
  $('dbScore').textContent = lvl.par === Infinity ? '—' : (diff <= 0 ? uMS(diff).toLocaleString('en-US') + ' m/s 🏆' : '+' + fmtMS(diff));
  $('dbNext').style.display = LEVELS.indexOf(lvl) < LEVELS.length - 1 ? '' : 'none';
  const v = $('dbVerdict');
  v.textContent = debriefSentence();
  v.className = 'verdict' + (dvUsed > lvl.par + 0.05 ? ' bad' : '');
  drawEnergyPlot();
  renderMathProof();
  $('dbSaved').style.display = 'none';
  $('dbName').value = store.get('fuelgolf_name', '');
  renderLb('dbLb', lvl.id);
  openModal('debriefModal');
}

function drawEnergyPlot() {
  const c = $('debriefPlot');
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  if (energyLog.length < 2) return;
  const t0 = energyLog[0].t, t1 = energyLog[energyLog.length - 1].t;
  let eMin = Infinity, eMax = -Infinity;
  for (const p of energyLog) { eMin = Math.min(eMin, p.eps); eMax = Math.max(eMax, p.eps); }
  const pad = (eMax - eMin) * 0.12 + 1e-9;
  eMin -= pad; eMax += pad;
  const X = (t) => 46 + (t - t0) / (t1 - t0 || 1) * (W - 60);
  const Y = (e) => H - 24 - (e - eMin) / (eMax - eMin) * (H - 44);
  // axes
  g.strokeStyle = '#10406e'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(46, 8); g.lineTo(46, H - 24); g.lineTo(W - 12, H - 24); g.stroke();
  // zero-energy line (escape threshold)
  if (eMin < 0 && eMax > 0) {
    g.strokeStyle = 'rgba(255,69,0,0.6)'; g.setLineDash([5, 4]);
    g.beginPath(); g.moveTo(46, Y(0)); g.lineTo(W - 12, Y(0)); g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#FF4500'; g.font = '10px system-ui';
    g.fillText('ε = 0 (escape)', W - 92, Y(0) - 4);
  }
  // labels
  g.fillStyle = '#8fa0bc'; g.font = '10px system-ui';
  g.fillText('ε (km²/s²)', 12, 14);
  g.fillText('time →', W - 48, H - 8);
  g.fillText(uEPS(eMax).toFixed(1), 6, 26);
  g.fillText(uEPS(eMin).toFixed(1), 6, H - 30);
  // energy curve
  g.strokeStyle = '#00A4E3'; g.lineWidth = 2.2;
  g.beginPath();
  energyLog.forEach((p, i) => { const x = X(p.t), y = Y(p.eps); if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); });
  g.stroke();
  // burn markers
  for (const b of burnLog) {
    const x = X(b.t);
    g.fillStyle = '#ECAC00';
    g.beginPath(); g.moveTo(x, H - 24); g.lineTo(x - 5, H - 14); g.lineTo(x + 5, H - 14); g.closePath(); g.fill();
    g.fillStyle = '#8fa0bc'; g.font = '9px system-ui';
    g.fillText(uMS(b.dv) + '', x - 10, H - 4);
  }
}

/* ---------- leaderboard ---------- */
function renderLb(tbodyId, levelId, highlight) {
  const tb = $(tbodyId);
  const rows = store.get(LB_KEY(levelId), []);
  tb.innerHTML = '';
  if (!rows.length) { tb.innerHTML = '<tr><td colspan="3" style="color:var(--muted)">No scores yet — be first.</td></tr>'; return; }
  let marked = false;
  rows.slice(0, 10).forEach((r, i) => {
    const tr = document.createElement('tr');
    if (!marked && highlight && Math.abs(r.dv - highlight.dv) < 1e-6 && r.name === highlight.name) { tr.className = 'you'; marked = true; }
    tr.innerHTML = `<td>${i + 1}</td><td></td><td class="dv">${fmtMS(r.dv)}</td>`;
    tr.children[1].textContent = r.name;
    tb.appendChild(tr);
  });
}
$('dbSave').addEventListener('click', () => {
  const name = ($('dbName').value || 'anon').trim().slice(0, 16);
  store.set('fuelgolf_name', name);
  const rows = store.get(LB_KEY(lvl.id), []);
  rows.push({ name, dv: +dvUsed.toFixed(3) });
  rows.sort((a, b) => a.dv - b.dv);
  store.set(LB_KEY(lvl.id), rows.slice(0, 25));
  const entry = { name, dv: +dvUsed.toFixed(3) };
  renderLb('dbLb', lvl.id, entry);
  $('dbSaved').style.display = 'inline';
  const rank = store.get(LB_KEY(lvl.id), []).findIndex(r => r.name === entry.name && Math.abs(r.dv - entry.dv) < 1e-6) + 1;
  if (rank === 1) toast('🏆 New class best on this level!');
});

/* ---------- modals ---------- */
function openModal(id) { $(id).classList.add('show'); }
function closeModal(id) { $(id).classList.remove('show'); }
$('dbRetry').addEventListener('click', () => loadLevel(LEVELS.indexOf(lvl)));
$('dbNext').addEventListener('click', () => loadLevel(Math.min(LEVELS.indexOf(lvl) + 1, LEVELS.length - 1)));
$('dbClose').addEventListener('click', () => closeModal('debriefModal'));
$('crashRetry').addEventListener('click', () => loadLevel(LEVELS.indexOf(lvl)));
$('btnRestart').addEventListener('click', () => loadLevel(LEVELS.indexOf(lvl)));
$('btnHelp').addEventListener('click', () => openModal('helpModal'));
$('closeHelp').addEventListener('click', () => closeModal('helpModal'));

/* levels modal */
/* ---------- progress ---------- */
function getProgress() { return store.get(PROG_KEY, {}); }
function markComplete(levelId, dv, par) {
  const p = getProgress();
  const prev = p[levelId];
  const rec = { done: true, best: (prev && prev.best < dv) ? prev.best : dv, par: par !== Infinity };
  rec.underPar = (par !== Infinity && rec.best <= par + 1e-9) || (prev && prev.underPar);
  p[levelId] = rec;
  store.set(PROG_KEY, p);
}
function renderLevelGrid() {
  const grid = $('levelGrid');
  const prog = getProgress();
  grid.innerHTML = '';
  let done = 0, underPar = 0, scored = 0;
  LEVELS.forEach((L, i) => {
    const best = (store.get(LB_KEY(L.id), [])[0] || null);
    const pr = prog[L.id];
    if (pr && pr.done) { done++; if (L.par !== Infinity) { scored++; if (pr.underPar) underPar++; } }
    const card = document.createElement('div');
    card.className = 'levelcard' + (pr && pr.done ? ' done' : '') + (lvl && lvl.id === L.id ? ' current' : '');
    const badge = pr && pr.done
      ? (pr.underPar ? '<span class="badge par" title="Made par">🏆</span>' : '<span class="badge" title="Completed">✓</span>')
      : '';
    card.innerHTML = `${badge}<h4>${L.id}. ${L.name}</h4><div class="meta">${L.subtitle}</div>
      <div class="meta">Par ${L.par === Infinity ? '—' : fmtMS(L.par)} · Tank ${L.fuel === 200 ? '∞' : fmtMS(L.fuel)}${isFinite(L.engine) ? ' · ' + (L.engine * MS2_PER_AU).toFixed(3) + ' m/s²' : ''}</div>
      ${pr && pr.done ? `<div class="best">Your best: ${fmtMS(pr.best)}</div>` : ''}
      ${best ? `<div class="meta">Class best: ${fmtMS(best.dv)} (${best.name})</div>` : ''}`;
    card.addEventListener('click', () => loadLevel(i));
    grid.appendChild(card);
  });
  const pct = Math.round(done / LEVELS.length * 100);
  $('progFill').style.width = pct + '%';
  $('progText').innerHTML = `<b style="color:var(--text)">${done} of ${LEVELS.length}</b> missions flown · <b style="color:var(--msu-gold)">${underPar}</b> of ${scored || LEVELS.length - 1} scored missions at or under par`;
}

/* ---------- mission briefing ---------- */
const GOAL_TEXT = {
  circular: (g) => `Settle into a circular orbit inside the green ring — semi-major axis within ${fmtKm(g.band)} of ${fmtKm(g.a)}, eccentricity at or below ${g.emax}.`,
  transfer: (g) => `Reach a circular orbit on the green ring — semi-major axis within ${fmtKm(g.band)} of ${fmtKm(g.a)}, eccentricity at or below ${g.emax}. Two burns are the efficient route.`,
  apoapsis: (g) => `Raise your apoapsis — the high point of your orbit, marked Ap — into the gold band between ${fmtKm(g.min)} and ${fmtKm(g.max)}. You do NOT need to circularize; the mission ends the moment Ap enters the band.`,
  escape: () => `Escape Earth. That means specific orbital energy ε above zero AND crossing the system edge. A tall ellipse that crosses the edge with ε still negative will fall back — watch the ORBIT chip.`,
  sandbox: () => `No objective. Fly anything you like: skim the atmosphere, chase the moon, or hunt the cheapest possible escape. Swap engines in the burn planner to compare impulsive against finite thrust.`,
};
function showMission() {
  $('msTitle').textContent = `Level ${lvl.id}: ${lvl.name}`;
  $('msSubtitle').textContent = lvl.subtitle;
  $('msPar').textContent = lvl.par === Infinity ? '—' : fmtMS(lvl.par);
  $('msTank').textContent = lvl.fuel === 200 ? '∞' : fmtMS(lvl.fuel);
  $('msEngine').textContent = isFinite(engine) ? (engine * MS2_PER_AU).toFixed(3) + ' m/s²' : 'impulsive';
  $('msGoal').textContent = (GOAL_TEXT[lvl.goal.type] || (() => ''))(lvl.goal);
  $('msHint').textContent = lvl.hint;
  openModal('missionModal');
}
$('btnMission').addEventListener('click', showMission);
$('msClose').addEventListener('click', () => closeModal('missionModal'));
$('hintClose').addEventListener('click', () => $('hint').classList.remove('show'));
$('btnLevels').addEventListener('click', () => { renderLevelGrid(); openModal('levelsModal'); });
$('closeLevels').addEventListener('click', () => closeModal('levelsModal'));

/* teacher modal */
$('btnTeacher').addEventListener('click', () => openModal('teacherModal'));
$('closeTeacher').addEventListener('click', () => closeModal('teacherModal'));
$('tgProjector').addEventListener('click', () => {
  const on = document.body.classList.toggle('projector');
  $('tgProjector').textContent = on ? 'On' : 'Off';
  store.set('fuelgolf_projector', on);
});
$('tgReset').addEventListener('click', () => { $('resetConfirmRow').style.display = 'flex'; });
$('tgResetNo').addEventListener('click', () => { $('resetConfirmRow').style.display = 'none'; });
$('tgResetYes').addEventListener('click', () => {
  LEVELS.forEach(L => store.del(LB_KEY(L.id)));
  $('resetConfirmRow').style.display = 'none';
});
if (store.get('fuelgolf_projector', false)) { document.body.classList.add('projector'); $('tgProjector').textContent = 'On'; }

/* HUD toggle */
$('btnHud').addEventListener('click', () => {
  $('hud').classList.toggle('show');
  $('btnHud').classList.toggle('active');
});

/* ---------- warp & apsis controls ---------- */
function syncWarpButtons() {
  document.querySelectorAll('#warpGroup [data-warp]').forEach(b => {
    b.classList.toggle('active', +b.dataset.warp === warp);
  });
}
document.querySelectorAll('#warpGroup [data-warp]').forEach(b => {
  b.addEventListener('click', () => { warp = +b.dataset.warp; pendingWarpTo = null; syncWarpButtons(); });
});
function leadSeconds() {
  const v = parseFloat($('leadInput').value);
  return (isFinite(v) && v > 0) ? v * 60 / SEC_PER_TU : 0; // minutes -> sim-time units
}
function warpToApsis(which) {
  if (activeBurn) return; // no apsis-jumping while the engine is lit
  if (phase !== 'fly' && phase !== 'planning') return;
  let dt = timeToApsis(lvl, S, which);
  if (dt === null) { toast('No ' + (which === 'pe' ? 'periapsis' : 'apoapsis') + ' ahead on this trajectory'); return; }
  const lead = leadSeconds();
  if (lead > 0) {
    dt -= lead;
    if (dt <= 0.05) {
      // already inside the lead window — go round once more if the orbit is closed
      const el = elements(lvl, S);
      if (el.bound) dt += 2 * Math.PI * Math.sqrt(Math.pow(el.a, 3) / lvl.mu);
      else { toast('Lead is longer than the time remaining'); return; }
    }
    toast('Warping to ' + (which === 'pe' ? 'Pe' : 'Ap') + ' − ' + $('leadInput').value + ' min');
  }
  if (dt > 0.05) { pendingWarpTo = dt; if (phase === 'planning') hidePlanner(); }
}
$('btnToPe').addEventListener('click', () => warpToApsis('pe'));
$('btnToAp').addEventListener('click', () => warpToApsis('ap'));
$('leadInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('leadInput').blur(); } });

/* ---------- zoom / pan / follow ---------- */
function setFollow(on) {
  follow = on;
  $('btnFollow').classList.toggle('active', on);
  if (on && S) { camX = S.x; camY = S.y; }
}
$('btnFollow').addEventListener('click', () => setFollow(!follow));
$('zoomIn').addEventListener('click', () => targetZoom *= 1.35);
$('zoomOut').addEventListener('click', () => targetZoom /= 1.35);
$('zoomFit').addEventListener('click', () => {
  targetZoom = Math.min(window.innerWidth, window.innerHeight) / lvl.view;
  camX = 0; camY = 0; setFollow(false);
});
canvas.addEventListener('wheel', (e) => { e.preventDefault(); targetZoom *= e.deltaY < 0 ? 1.12 : 1 / 1.12; }, { passive: false });

/* pointer gestures: drag = pan, or aim the burn while the planner is open */
function screenToWorld(px, py) {
  return { x: camX + (px - window.innerWidth / 2) / zoom, y: camY + (py - window.innerHeight / 2) / zoom };
}
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' && e.isPrimary === false) return;
  canvas.setPointerCapture(e.pointerId);
  if (phase === 'planning') {
    dragging = { mode: 'aim' };
    aimAt(e.clientX, e.clientY);
  } else {
    dragging = { mode: 'pan', px: e.clientX, py: e.clientY, moved: false };
    canvas.classList.add('grabbing');
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  if (dragging.mode === 'aim') { aimAt(e.clientX, e.clientY); return; }
  const dx = (e.clientX - dragging.px) / zoom, dy = (e.clientY - dragging.py) / zoom;
  if (Math.abs(e.clientX - dragging.px) + Math.abs(e.clientY - dragging.py) > 3) {
    if (!dragging.moved) { dragging.moved = true; setFollow(false); }
    camX -= dx; camY -= dy;
    dragging.px = e.clientX; dragging.py = e.clientY;
  }
});
function endDrag(e) {
  if (!dragging) return;
  dragging = null;
  canvas.classList.remove('grabbing');
  try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

/* aim: point the burn from the craft toward the cursor (free-angle mode) */
function aimAt(px, py) {
  const w = screenToWorld(px, py);
  const dx = w.x - S.x, dy = w.y - S.y;
  if (Math.hypot(dx, dy) < 1e-6) return;
  const vAng = Math.atan2(S.vy, S.vx);
  let rel = Math.atan2(dy, dx) - vAng;
  while (rel > Math.PI) rel -= 2 * Math.PI;
  while (rel < -Math.PI) rel += 2 * Math.PI;
  plan.mode = 'free';
  plan.angle = Math.round(rel * 180 / Math.PI);
  document.querySelectorAll('.modes [data-mode]').forEach(x => x.classList.toggle('active', x.dataset.mode === 'free'));
  $('angleRow').style.display = 'flex';
  $('angleSlider').value = plan.angle;
  syncPlanner(); computePredPath();
}

/* pinch zoom (two-finger) */
let pinch = null;
canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 2) { pinch = dist2(e.touches); dragging = null; } }, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && pinch) { const d = dist2(e.touches); targetZoom *= d / pinch; pinch = d; }
}, { passive: true });
canvas.addEventListener('touchend', () => pinch = null);
function dist2(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }

/* ---------- burn planner UI ---------- */
function showPlanner() {
  if (phase === 'done' || phase === 'crashed' || activeBurn) return;
  phase = 'planning'; warp = 0; syncWarpButtons();
  $('planner').classList.add('show');
  $('dvSlider').max = Math.max(0.5, Math.min(15, fuel)).toFixed(2);
  if (plan.dv > fuel) plan.dv = Math.max(0, fuel);
  syncPlanner();
  computePredPath();
}
function hidePlanner() {
  $('planner').classList.remove('show');
  if (phase === 'planning') { phase = 'fly'; warp = 1; syncWarpButtons(); }
  predPath = null;
}
$('btnPlanBurn').addEventListener('click', () => { $('planner').classList.contains('show') ? hidePlanner() : showPlanner(); });
$('btnCancelBurn').addEventListener('click', hidePlanner);
$('btnCommitBurn').addEventListener('click', () => { if (phase === 'planning') { commitBurn(); checkGoal(); } });
document.querySelectorAll('.modes [data-mode]').forEach(b => {
  b.addEventListener('click', () => {
    plan.mode = b.dataset.mode;
    document.querySelectorAll('.modes [data-mode]').forEach(x => x.classList.toggle('active', x === b));
    $('angleRow').style.display = plan.mode === 'free' ? 'flex' : 'none';
    if (phase === 'planning') computePredPath();
  });
});
$('angleSlider').addEventListener('input', () => { plan.angle = +$('angleSlider').value; syncPlanner(); if (phase === 'planning') computePredPath(); });
$('dvSlider').addEventListener('input', () => { plan.dv = +$('dvSlider').value; syncPlanner(); if (phase === 'planning') computePredPath(); });
document.querySelectorAll('[data-fine]').forEach(b => {
  b.addEventListener('click', () => {
    plan.dv = Math.max(0, Math.min(fuel, plan.dv + (+b.dataset.fine) / MS_PER_VU)); // buttons are in m/s
    syncPlanner(); if (phase === 'planning') computePredPath();
  });
});
function syncPlanner() {
  $('dvSlider').value = plan.dv;
  $('dvOut').textContent = uMS(plan.dv).toLocaleString('en-US');
  $('angleOut').textContent = plan.angle + '°';
  const el = elements(lvl, S);
  const gain = el.v * plan.dv + 0.5 * plan.dv * plan.dv;
  let txt = `Tank after burn: <b>${fmtMS(Math.max(0, fuel - plan.dv))}</b> · Energy this burn adds if prograde: <b>${uEPS(gain).toFixed(2)} km²/s²</b> (v·Δv + ½Δv², v = ${uKMS(el.v).toFixed(2)} km/s)`;
  if (isFinite(engine)) {
    const tBurn = plan.dv / engine;
    const T = el.bound ? 2 * Math.PI * Math.sqrt(Math.pow(el.a, 3) / lvl.mu) : Infinity;
    const frac = T === Infinity ? 0 : tBurn / T;
    txt += `<br>⏱ Burn duration: <b>${fmtDur(tBurn)}</b>` +
      (T !== Infinity ? ` — <b>${(frac * 100).toFixed(0)}%</b> of your ${fmtDur(T)} orbit` : '') +
      `. The burn starts when you commit — start <i>before</i> periapsis so it straddles the fast point.` +
      (frac > 0.30 ? ' <b style="color:var(--warn)">Too long for one pass — consider splitting into kicks.</b>' : '');
  }
  $('burncost').innerHTML = txt;
}

/* ---------- keyboard ---------- */
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  // Esc closes whatever is on top
  if (k === 'escape') {
    const open = document.querySelector('.modal.show');
    if (open) { closeModal(open.id); return; }
    if (phase === 'planning') { hidePlanner(); return; }
    return;
  }
  if (anyModalOpen()) return; // don't fly the ship while a dialog is up
  if (k === 'enter') { if (phase === 'planning') { e.preventDefault(); commitBurn(); checkGoal(); } }
  else if (k === ' ') { e.preventDefault(); warp = warp === 0 ? 1 : 0; pendingWarpTo = null; syncWarpButtons(); }
  else if (k === 'b') { $('planner').classList.contains('show') ? hidePlanner() : showPlanner(); }
  else if (k === '.') { const ws = [0, 1, 10, 50, 200]; warp = ws[Math.min(ws.indexOf(warp) + 1, ws.length - 1)]; pendingWarpTo = null; syncWarpButtons(); }
  else if (k === ',') { const ws = [0, 1, 10, 50, 200]; warp = ws[Math.max(ws.indexOf(warp) - 1, 0)]; pendingWarpTo = null; syncWarpButtons(); }
  else if (k === 'h') { $('hud').classList.toggle('show'); $('btnHud').classList.toggle('active'); }
  else if (k === 'x') { endBurn(); }
  else if (k === 'z') { undoBurn(); }
  else if (k === 'f') { setFollow(!follow); }
  else if (k === 'm') { showMission(); }
  else if (k === 'p') { warpToApsis('pe'); }
  else if (k === 'a') { warpToApsis('ap'); }
  else if (k === 'r') { loadLevel(LEVELS.indexOf(lvl)); }
});

/* new top-bar + modal wiring */
$('btnUndo').addEventListener('click', undoBurn);
$('crashUndo').addEventListener('click', undoBurn);
$('mathToggle').addEventListener('click', () => {
  const m = $('dbMath');
  const hidden = m.classList.toggle('collapsed');
  $('mathToggle').textContent = (hidden ? '▶ Show' : '▼ Hide') + ' the math — proving the outcome from your inputs';
});
$('tgResetProg').addEventListener('click', () => {
  store.del(PROG_KEY);
  renderLevelGrid();
  toast('Mission progress cleared');
});

/* ---------- top bar ---------- */
function syncTop() {
  $('levelChip').textContent = `Level ${lvl.id}: ${lvl.name}`;
  $('parChip').textContent = lvl.par === Infinity ? '—' : fmtMS(lvl.par);
  $('dvChip').textContent = fmtMS(dvUsed);
  $('fuelChip').textContent = lvl.fuel === 200 ? '∞' : fmtMS(fuel);
  $('fuelfill').style.width = (lvl.fuel === 200 ? 100 : Math.max(0, fuel / lvl.fuel * 100)) + '%';
  $('engChip').textContent = isFinite(engine) ? (engine * MS2_PER_AU).toFixed(3) + ' m/s²' : 'impulsive';
}

/* engine selector (sandbox only) */
function syncEngineRow() {
  $('leadWrap').classList.toggle('show', isFinite(engine));
  const row = $('engineRow');
  if (!lvl.engineChoices) { row.style.display = 'none'; return; }
  row.style.display = 'grid';
  row.querySelectorAll('button').forEach(b => {
    const val = b.dataset.eng === 'inf' ? Infinity : +b.dataset.eng;
    b.classList.toggle('active', val === engine);
  });
}
document.querySelectorAll('#engineRow button').forEach(b => {
  b.addEventListener('click', () => {
    if (activeBurn) return;
    engine = b.dataset.eng === 'inf' ? Infinity : +b.dataset.eng;
    syncEngineRow(); syncTop(); syncPlanner();
    if (phase === 'planning') computePredPath();
  });
});
$('btnCut').addEventListener('click', endBurn);

/* ---------- HUD ---------- */
let vSeen = { min: Infinity, max: -Infinity };
var apsisCache = { t: -1, pe: null, ap: null };
function apsisCountdowns() {
  // recompute at most a few times a second of sim time — propagation is not free
  if (Math.abs(S.t - apsisCache.t) > 0.4 || apsisCache.t < 0) {
    apsisCache = { t: S.t, pe: timeToApsis(lvl, S, 'pe'), ap: timeToApsis(lvl, S, 'ap') };
  }
  return apsisCache;
}
function syncHud() {
  if (!$('hud').classList.contains('show')) return;
  const ap = apsisCountdowns();
  $('hudTPe').textContent = ap.pe === null ? '—' : fmtDur(ap.pe);
  $('hudTAp').textContent = ap.ap === null ? '—' : fmtDur(ap.ap);
  if (isFinite(engine)) {
    $('hudBurnRow').style.display = 'flex';
    $('hudBurnT').textContent = fmtDur(fuel / engine);
  } else {
    $('hudBurnRow').style.display = 'none';
  }
  const el = elements(lvl, S);
  vSeen.min = Math.min(vSeen.min, el.v); vSeen.max = Math.max(vSeen.max, el.v);
  $('hudV').textContent = uKMS(el.v).toFixed(2) + ' km/s';
  $('hudAlt').textContent = fmtKm(el.r - lvl.planetR);
  $('hudE').textContent = uEPS(el.eps).toFixed(2) + ' km²/s²' + (el.eps >= 0 ? ' (unbound!)' : '');
  $('hudPe').textContent = el.rp > 0 ? fmtKm(el.rp - lvl.planetR) : '—';
  $('hudAp').textContent = el.bound ? fmtKm(el.ra - lvl.planetR) : '∞';
  $('hudOberth').textContent = uKMS(el.v).toFixed(2) + ' km/s';
  const span = Math.max(1e-6, vSeen.max - vSeen.min);
  $('oberthfill').style.width = Math.max(4, Math.min(100, (el.v - vSeen.min) / span * 100)) + '%';
}

/* ---------- main loop ---------- */
let lastFrame = performance.now();
function frame(now) {
  const dtReal = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  if ((phase === 'fly') && !anyModalOpen() && (warp > 0 || pendingWarpTo !== null)) {
    let simDt;
    if (pendingWarpTo !== null) {
      simDt = Math.min(pendingWarpTo, TIME_SCALE * 400 * dtReal);
      pendingWarpTo -= simDt;
      if (pendingWarpTo <= 1e-6) { pendingWarpTo = null; warp = 0; syncWarpButtons(); }
    } else {
      const effWarp = activeBurn ? Math.min(warp, 10) : warp; // cap warp while thrusting
      simDt = TIME_SCALE * effWarp * dtReal;
    }
    let steps = Math.ceil(simDt / DT);
    steps = Math.min(steps, 30000);
    const dt = simDt / steps;
    const trailEvery = Math.max(1, Math.ceil(steps / 24));
    for (let i = 0; i < steps; i++) {
      if (activeBurn) {
        const dvStep = Math.min(activeBurn.a * dt, activeBurn.dvRemaining, fuel);
        const dtThrust = dvStep / activeBurn.a;
        const vNow = Math.hypot(S.vx, S.vy);
        rk4Step(lvl, S, dtThrust, activeBurn);
        if (dtThrust < dt - 1e-12) step(lvl, S, dt - dtThrust);
        fuel -= dvStep; dvUsed += dvStep;
        activeBurn.dvRemaining -= dvStep;
        activeBurn.entry.dv += dvStep;
        activeBurn.entry.vSum += vNow * dvStep;
        if (activeBurn.dvRemaining <= 1e-9 || fuel <= 1e-9) { endBurn(); }
      } else {
        step(lvl, S, dt);
      }
      if (i % trailEvery === 0) trail.push([S.x, S.y]);
      if ((i & 15) === 0) {
        const r2 = S.x * S.x + S.y * S.y;
        if (r2 < lvl.planetR * lvl.planetR) break;
      }
    }
    trail.push([S.x, S.y]);
    if (trail.length > 2400) trail.splice(0, trail.length - 2400);
    if (activeBurn) { syncTop(); if (++burnPathTick % 20 === 0) computeCurPath(); }
    logEnergy(false);
    checkGoal();
  }

  zoom += (targetZoom - zoom) * Math.min(1, dtReal * 8);
  if (follow) {
    const k = Math.min(1, dtReal * 6);
    camX += (S.x - camX) * k; camY += (S.y - camY) * k;
  }
  draw();
  syncHud();
  syncOrbitChip();
  $('clockChip').textContent = 'T+ ' + fmtDur(S.t);
  requestAnimationFrame(frame);
}

/* ---------- rendering ---------- */
function W2S(x, y) {
  return [window.innerWidth / 2 + (x - camX) * zoom, window.innerHeight / 2 + (y - camY) * zoom];
}
function draw() {
  const w = window.innerWidth, h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);
  // deep-space backdrop (MSU navy vignette)
  const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
  bg.addColorStop(0, '#00203f');
  bg.addColorStop(1, '#000710');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // stars (slow parallax against the camera so panning feels physical)
  const pxOff = (camX * zoom * 0.02) % w, pyOff = (camY * zoom * 0.02) % h;
  for (const st of stars) {
    ctx.globalAlpha = st.a;
    ctx.fillStyle = st.g ? '#ECAC00' : '#cfe0f5';
    let sx = (st.x * w - pxOff + w) % w, sy = (st.y * h - pyOff + h) % h;
    ctx.fillRect(sx, sy, st.s, st.s);
  }
  ctx.globalAlpha = 1;

  // goal ring(s)
  const g = lvl.goal;
  if (g.type === 'circular' || g.type === 'transfer')
    drawRing(g.a - g.band, g.a + g.band, 'rgba(74,222,128,0.14)', '#4ade80', 'TARGET ORBIT — circularize inside this ring');
  if (g.type === 'apoapsis')
    drawRing(g.min, g.max, 'rgba(236,172,0,0.13)', '#ECAC00', 'TARGET Ap BAND — get your apoapsis (Ap) in here; no need to circularize');
  if (g.type === 'escape') {
    const [cx, cy] = W2S(0, 0);
    const free = elements(lvl, S).eps > 0;
    const col = free ? '74,222,128' : '255,69,0';
    ctx.strokeStyle = `rgba(${col},0.55)`; ctx.setLineDash([8, 8]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, lvl.escapeR * zoom, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(${col},0.9)`; ctx.font = '600 12px system-ui';
    ctx.fillText(free ? 'SYSTEM EDGE — escape trajectory! cross to finish' : 'SYSTEM EDGE — only counts with ε > 0 (else you fall back)',
                 cx + lvl.escapeR * zoom * 0.71, cy - lvl.escapeR * zoom * 0.71);
  }

  // moon orbit + moon
  if (lvl.moon) {
    const [cx, cy] = W2S(0, 0);
    ctx.strokeStyle = 'rgba(0,164,227,0.28)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, lvl.moon.R * zoom, 0, Math.PI * 2); ctx.stroke();
    const mp = moonPos(lvl, S.t);
    const [mx, my] = W2S(mp.x, mp.y);
    const mr = Math.max(3, lvl.moon.r * zoom);
    const mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.2, mx, my, mr);
    mg.addColorStop(0, '#c8d2e4'); mg.addColorStop(1, '#5d6a88');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6b7a9c';
    ctx.beginPath(); ctx.arc(mx - mr * 0.25, my + mr * 0.15, mr * 0.3, 0, Math.PI * 2); ctx.fill();
  }

  // trail
  if (trail.length > 1) {
    ctx.strokeStyle = 'rgba(0,164,227,0.4)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    trail.forEach((p, i) => { const [x, y] = W2S(p[0], p[1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();
  }

  // current orbit path
  if (curPath && curPath.length > 1) {
    ctx.strokeStyle = 'rgba(232,240,251,0.32)'; ctx.lineWidth = 1;
    ctx.beginPath();
    curPath.forEach((p, i) => { const [x, y] = W2S(p[0], p[1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();
  }

  // predicted burn path (dotted; powered arc drawn solid orange)
  if (phase === 'planning' && predPath) {
    if (predPath.burnPts && predPath.burnPts.length > 1) {
      ctx.strokeStyle = 'rgba(251,146,60,0.95)'; ctx.lineWidth = 3;
      ctx.beginPath();
      predPath.burnPts.forEach((p, i) => { const [x, y] = W2S(p[0], p[1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke();
    }
    if (predPath.pts.length > 1) {
      ctx.strokeStyle = predPath.crash ? 'rgba(255,69,0,0.95)' : 'rgba(74,222,128,0.95)';
      ctx.lineWidth = 2; ctx.setLineDash([3, 7]);
      ctx.beginPath();
      predPath.pts.forEach((p, i) => { const [x, y] = W2S(p[0], p[1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // hollow markers: where the NEW apsides will sit
    const pe = predPath.el;
    if (!predPath.crash && pe && pe.bound && pe.e > 1e-4) {
      const th = Math.atan2(pe.ey, pe.ex);
      drawApsis(pe.rp * Math.cos(th), pe.rp * Math.sin(th), 'Pe′', '#4ade80', true);
      drawApsis(-pe.ra * Math.cos(th), -pe.ra * Math.sin(th), 'Ap′', '#ECAC00', true);
    }
  }

  // Earth
  {
    const [cx, cy] = W2S(0, 0);
    const pr = Math.max(4, lvl.planetR * zoom);
    // atmosphere glow
    const ag = ctx.createRadialGradient(cx, cy, pr, cx, cy, pr * 1.28);
    ag.addColorStop(0, 'rgba(0,164,227,0.34)'); ag.addColorStop(1, 'rgba(0,164,227,0)');
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(cx, cy, pr * 1.28, 0, Math.PI * 2); ctx.fill();
    const pg = ctx.createRadialGradient(cx - pr * 0.35, cy - pr * 0.38, pr * 0.12, cx, cy, pr);
    pg.addColorStop(0, '#4fc3f7'); pg.addColorStop(0.45, '#00A4E3'); pg.addColorStop(1, '#002144');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,164,227,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.stroke();
    if (pr > 22) {
      ctx.save();
      ctx.fillStyle = 'rgba(236,172,0,0.85)'; ctx.font = '600 10px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('EARTH', cx, cy + 3);
      ctx.restore();
    }
  }

  // craft
  {
    const [x, y] = W2S(S.x, S.y);
    const ang = Math.atan2(S.vy, S.vx);
    const sz = 7;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    if (activeBurn) { // engine plume opposite the thrust direction
      const d = burnDir(S, activeBurn.mode, activeBurn.angle);
      const pAng = Math.atan2(d.y, d.x) - ang;
      ctx.save(); ctx.rotate(pAng + Math.PI);
      const fl = sz * (1.8 + Math.random() * 0.9);
      const grad = ctx.createLinearGradient(0, 0, fl, 0);
      grad.addColorStop(0, 'rgba(251,191,36,0.95)'); grad.addColorStop(1, 'rgba(248,113,113,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(sz * 0.2, 0); ctx.lineTo(fl, sz * 0.45); ctx.lineTo(fl, -sz * 0.45); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // Racer gold craft
    ctx.fillStyle = '#ECAC00';
    ctx.strokeStyle = '#fff3d0'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.7, sz * 0.6); ctx.lineTo(-sz * 0.4, 0); ctx.lineTo(-sz * 0.7, -sz * 0.6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();

    // live thrust-vector arrow while planning (direction + relative magnitude)
    if (phase === 'planning' && plan.dv > 0.001) {
      const d = burnDir(S, plan.mode, plan.angle * Math.PI / 180);
      const frac = Math.min(1, plan.dv / Math.max(0.001, lvl.fuel));
      const len = 26 + 52 * frac;
      const ax = x + d.x * len, ay = y + d.y * len;
      const col = { prograde: '#4ade80', retrograde: '#fb923c', radialout: '#22d3ee', radialin: '#22d3ee', free: '#00A4E3' }[plan.mode];
      ctx.save();
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(0,7,16,0.9)'; ctx.shadowBlur = 5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ax, ay); ctx.stroke();
      const a = Math.atan2(d.y, d.x);
      ctx.beginPath();
      ctx.moveTo(ax + Math.cos(a) * 9, ay + Math.sin(a) * 9);
      ctx.lineTo(ax + Math.cos(a + 2.5) * 8, ay + Math.sin(a + 2.5) * 8);
      ctx.lineTo(ax + Math.cos(a - 2.5) * 8, ay + Math.sin(a - 2.5) * 8);
      ctx.closePath(); ctx.fill();
      ctx.font = '600 11px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(fmtMS(plan.dv), ax + Math.cos(a) * 22, ay + Math.sin(a) * 22 + 4);
      ctx.restore();
      ctx.textAlign = 'left';
    }

    // apsis markers on current orbit
    const el = elements(lvl, S);
    if (el.bound && el.e > 1e-4) {
      const th = Math.atan2(el.ey, el.ex); // periapsis direction
      drawApsis(el.rp * Math.cos(th), el.rp * Math.sin(th), 'Pe', '#4ade80');
      drawApsis(-el.ra * Math.cos(th), -el.ra * Math.sin(th), 'Ap', '#ECAC00');
    }
    // off-screen: point to the craft from the screen edge
    const m = 42;
    if (x < m || y < m || x > w - m || y > h - m) drawOffscreenPointer(x, y, w, h, m);
  }
}

function drawOffscreenPointer(x, y, w, h, m) {
  const cx = w / 2, cy = h / 2;
  const dx = x - cx, dy = y - cy;
  const ang = Math.atan2(dy, dx);
  // clamp onto the inset rectangle
  const t = Math.min(
    Math.abs((w / 2 - m) / (dx || 1e-6)),
    Math.abs((h / 2 - m) / (dy || 1e-6))
  );
  const px = cx + dx * t, py = cy + dy * t;
  ctx.save();
  ctx.translate(px, py); ctx.rotate(ang);
  ctx.fillStyle = '#ECAC00';
  ctx.shadowColor = 'rgba(0,7,16,0.9)'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-7, 8); ctx.lineTo(-7, -8); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = '#ECAC00'; ctx.font = '600 10px system-ui'; ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,7,16,0.95)'; ctx.shadowBlur = 5;
  ctx.fillText('CRAFT', px - Math.cos(ang) * 20, py - Math.sin(ang) * 20 + 3);
  ctx.restore();
  ctx.textAlign = 'left';
}
function drawApsis(wx, wy, label, color, hollow) {
  const [x, y] = W2S(wx, wy);
  ctx.beginPath(); ctx.arc(x, y, hollow ? 4.5 : 3.5, 0, Math.PI * 2);
  if (hollow) { ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.stroke(); }
  else { ctx.fillStyle = color; ctx.fill(); }
  ctx.save();
  ctx.fillStyle = color; ctx.font = '600 11px system-ui';
  ctx.shadowColor = 'rgba(0,7,16,0.95)'; ctx.shadowBlur = 4;
  ctx.fillText(label, x + 7, y + 4);
  ctx.restore();
}
function drawRing(rIn, rOut, fill, edge, label) {
  const [cx, cy] = W2S(0, 0);
  ctx.beginPath();
  ctx.arc(cx, cy, rOut * zoom, 0, Math.PI * 2);
  ctx.arc(cx, cy, rIn * zoom, 0, Math.PI * 2, true);
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = edge; ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, rOut * zoom, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, rIn * zoom, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
  if (label) {
    ctx.save();
    ctx.fillStyle = edge; ctx.font = '600 12px system-ui'; ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 6;
    ctx.fillText(label, cx, cy - ((rIn + rOut) / 2) * zoom + 4);
    ctx.restore();
    ctx.textAlign = 'left';
  }
}

/* ---------- boot ---------- */
loadLevel(0);
openModal('helpModal');
requestAnimationFrame(frame);

})();
