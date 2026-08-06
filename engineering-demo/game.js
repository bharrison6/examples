/* Bridge Works — game shell: rendering, interaction, test flow, teaching tools.
   All of the structural mathematics lives in physics.js; this file only asks it
   questions and draws the answers. */
'use strict';
(function () {

var P = window.BW, LV = window.BWLEVELS;
var GRID = LV.GRID, MAXLEN = LV.MAX_MEMBER_LEN;
var DEFL = 45;                 // deflections are drawn this many times life size
var MAX_DRAWN_SAG = 1.3;       // m — cap so a near-failure design stays on screen
var $ = function (id) { return document.getElementById(id); };
var cv = $('cv'), ctx = cv.getContext('2d');

/* ------------------------------------------------------------------ state */
var S = {
  li: 0, L: null,
  nodes: [], members: [],
  tool: 'build', phase: 'build',
  xray: true, nums: false, selfWeight: false,
  big: false, showPar: true, keyboard: false,
  undo: [], analysis: null, sel: -1, drag: null, hover: null,
  test: null, coll: null, debris: [], shake: 0, ver: 0, foldC: null, unbraced: [],
  vehKey: null, lastDebrief: null, name: '', kcur: null, kstart: null
};
var V = { s: 30, ox: 0, oy: 0 };

/* --------------------------------------------------------------- storage */
function ls(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function ss(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
var BOARD_K = 'bw.board.v1', DESIGN_K = 'bw.design.v1', PREF_K = 'bw.prefs.v1', PROG_K = 'bw.progress.v1';

function savePrefs() {
  var p = ls(PREF_K, {});
  p.big = S.big; p.showPar = S.showPar; p.xray = S.xray; p.nums = S.nums;
  p.selfWeight = S.selfWeight; p.li = S.li; p.name = S.name; p.overload = S.overload;
  p.keyboard = S.keyboard;
  ss(PREF_K, p);
}
function saveDesign() {
  var all = ls(DESIGN_K, {});
  all[S.L.id] = {
    nodes: S.nodes.map(function (n) { return [n.x, n.y, n.anchor ? 1 : 0]; }),
    members: S.members.map(function (m) { return [m.a, m.b]; }),
    veh: S.vehKey
  };
  ss(DESIGN_K, all);
}

/* ----------------------------------------------------------------- level */
function worldBox(L) {
  var span = L.gap.x1 - L.gap.x0, mx = Math.max(2.5, span * 0.16);
  return {
    x0: L.gap.x0 - mx, x1: L.gap.x1 + mx,
    y0: Math.min(L.build.ymin, L.deckY, L.pier ? L.pier.bottom + 1 : 0) - 2.4,
    y1: Math.max(L.build.ymax, L.deckY) + 1.3
  };
}
function loadLevel(i, fresh) {
  S.li = i; S.L = LV.LEVELS[i];
  S.L.world = worldBox(S.L);
  S.phase = 'build'; S.test = null; S.coll = null; S.debris = []; S.sel = -1; S.undo = [];
  S.vehKey = S.L.vehicle;
  S.nodes = []; S.members = [];
  for (var a = 0; a < S.L.anchors.length; a++) {
    var an = S.L.anchors[a];
    S.nodes.push({ x: an.x, y: an.y, anchor: true, type: an.type || 'pin',
                   fixX: (an.type === 'roller') ? 0 : 1, fixY: 1 });
  }
  var saved = ls(DESIGN_K, {})[S.L.id];
  if (saved && !fresh) {
    S.nodes = saved.nodes.map(function (n, k) {
      var base = k < S.L.anchors.length ? S.L.anchors[k] : null;
      return { x: n[0], y: n[1], anchor: !!n[2], type: base ? (base.type || 'pin') : 'pin',
               fixX: n[2] ? (base && base.type === 'roller' ? 0 : 1) : 0, fixY: n[2] ? 1 : 0 };
    });
    S.members = saved.members.map(function (m) { return { a: m[0], b: m[1], broken: false }; });
    if (saved.veh) S.vehKey = saved.veh;
  } else if (S.L.starter === 'ladder' && !ls(DESIGN_K, {})[S.L.id]) {
    applyDesign(LV.ladderStarter(S.L), true);
  }
  mergeCoincident(); cleanup();
  S.kcur = { x: S.L.gap.x0, y: S.L.deckY }; S.kstart = null;
  computeView(); renderVehSel(); refresh(); renderLevelChip();
}

function applyDesign(d, silent) {
  if (!silent) pushUndo();
  var anchors = S.nodes.filter(function (n) { return n.anchor; });
  var nn = anchors.slice(), map = [];
  function findOrAdd(p) {
    for (var i = 0; i < nn.length; i++)
      if (Math.abs(nn[i].x - p.x) < 1e-6 && Math.abs(nn[i].y - p.y) < 1e-6) return i;
    nn.push({ x: p.x, y: p.y, anchor: false, fixX: 0, fixY: 0 });
    return nn.length - 1;
  }
  for (var i = 0; i < d.nodes.length; i++) map[i] = findOrAdd(d.nodes[i]);
  var mm = [];
  for (i = 0; i < d.members.length; i++) {
    var a = map[d.members[i][0]], b = map[d.members[i][1]];
    if (a !== b) mm.push({ a: a, b: b, broken: false });
  }
  S.nodes = nn; S.members = mm;
  weldAll();
  refresh();
}

/* ------------------------------------------------------------------ cost */
function mlen(m) {
  var a = S.nodes[m.a], b = S.nodes[m.b];
  return Math.hypot(b.x - a.x, b.y - a.y);
}
/* Steel is bought by the metre; every joint the student places is a fabricated
   connection and is charged for. Abutment bearings come with the level. */
function costParts() {
  var steelM = 0, i;
  for (i = 0; i < S.members.length; i++) steelM += mlen(S.members[i]);
  var jn = 0;
  for (i = 0; i < S.nodes.length; i++) if (!S.nodes[i].anchor) jn++;
  return { steelM: steelM, steel: steelM * P.MAT.costPerMetre,
           joints: jn, jointTotal: P.jointCost(jn), total: P.designCost(steelM, jn) };
}
function totalCost() { return costParts().total; }
function money(v) { return '$' + Math.round(v).toLocaleString(); }

/* --------------------------------------------------------------- solving */
function vehicle() { return LV.VEHICLES[S.vehKey] || LV.VEHICLES[S.L.vehicle]; }
function model(loads) {
  return { nodes: S.nodes, members: S.members, loads: loads, selfWeight: S.selfWeight };
}
function xrayLoads() {
  var v = vehicle(), wb = LV.vehicleLength(v);
  var mid = (S.L.gap.x0 + S.L.gap.x1) / 2;
  return P.wheelLoads(S.nodes, S.members, null, S.L.deckY, v, mid + wb / 2).loads;
}
function refresh() {
  S.analysis = null; S.ver++; S.foldC = null;
  if (S.phase === 'build') {
    if (S.members.length) {
      var loads = S.xray ? xrayLoads() : new Float64Array(S.nodes.length * 2);
      S.analysis = P.analyse(model(loads));
    }
    saveDesign();
  }
  var cp = costParts(), c = cp.total, par = S.L.par;
  $('costVal').textContent = money(c);
  $('costVal').className = (par && S.showPar) ? (c > par ? 'over' : 'under') : '';
  $('costBreak').textContent = cp.steelM > 0
    ? 'steel ' + money(cp.steel) + ' · ' + cp.joints + ' joint' + (cp.joints === 1 ? '' : 's') +
      ' ' + money(cp.jointTotal)
    : '';
  $('parVal').textContent = (par && S.showPar) ? 'par ' + money(par) : (S.L.sandbox ? 'sandbox' : '');
  var cov = P.deckCoverage(S.nodes, S.members, null, S.L.deckY, S.L.gap.x0, S.L.gap.x1);
  $('btnTest').disabled = !cov.ok;
  S.unbraced = unbracedDeckJoints();
  if (!cov.ok) {
    setStatus('The roadway must run unbroken along the deck line before you can test.', 'warn');
  } else if (S.unbraced.length) {
    var u0 = S.nodes[S.unbraced[0]];
    setStatus(S.unbraced.length === 1
      ? 'The joint at (' + u0.x + ', ' + u0.y + ') has nothing bracing it — a wheel there will push straight through.'
      : S.unbraced.length + ' roadway joints have nothing bracing them — a wheel on any of them will push straight through.',
      'err');
  } else setStatus('');
  $('btnUndo').disabled = !S.undo.length;
  $('hint').innerHTML = S.phase === 'build'
    ? '<b>' + S.L.name + '</b> — ' + S.L.blurb + (S.L.hint ? ' <span style="opacity:.8">' + S.L.hint + '</span>' : '')
    : '';
  $('hint').classList.toggle('hidden', S.phase !== 'build');
  setToolHint();
}
var TOOLHINT = {
  build: 'Drag from one grid point to another to lay a member',
  erase: 'Tap a member or a joint to remove it',
  inspect: 'Tap any joint to see every force meeting there — they add to zero'
};
function setToolHint() { $('toolHint').textContent = TOOLHINT[S.tool] || ''; }
function setStatus(t, cls) { var e = $('statusMsg'); e.textContent = t; e.className = cls || ''; }

/* ------------------------------------------------------------------ undo */
function snapshot() {
  return JSON.stringify({ n: S.nodes.map(function (n) { return [n.x, n.y, n.anchor ? 1 : 0, n.fixX, n.fixY]; }),
                          m: S.members.map(function (m) { return [m.a, m.b]; }) });
}
function pushUndo() { S.undo.push(snapshot()); if (S.undo.length > 120) S.undo.shift(); }
function undo() {
  if (!S.undo.length) return;
  var st = JSON.parse(S.undo.pop());
  S.nodes = st.n.map(function (n, k) {
    var base = k < S.L.anchors.length ? S.L.anchors[k] : null;
    return { x: n[0], y: n[1], anchor: !!n[2], type: base ? (base.type || 'pin') : 'pin', fixX: n[3], fixY: n[4] };
  });
  S.members = st.m.map(function (m) { return { a: m[0], b: m[1], broken: false }; });
  refresh();
}

/* ------------------------------------------------------------------ view */
function computeView() {
  if (!S.L) return;
  var w = S.L.world, W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return;
  var s = Math.min(W / (w.x1 - w.x0), H / (w.y1 - w.y0));
  V.s = s;
  V.ox = (W - s * (w.x1 - w.x0)) / 2 - s * w.x0;
  V.oy = H - (H - s * (w.y1 - w.y0)) / 2 + s * w.y0;
}
function SX(x) { return V.s * x + V.ox; }
function SY(y) { return V.oy - V.s * y; }
function WX(px) { return (px - V.ox) / V.s; }
function WY(py) { return (V.oy - py) / V.s; }
function resize() {
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  computeView();
}
window.addEventListener('resize', resize);
/* the canvas also changes size when projector mode alters the toolbar height,
   or a phone rotates — watch the element itself rather than guessing a delay */
if (window.ResizeObserver) new ResizeObserver(function () { resize(); }).observe(cv);

/* -------------------------------------------------------- drawn geometry */
/* returns the on-screen (possibly deflected / collapsing) position of a node */
function deflScale() {
  var a = S.analysis;
  if (!a || !a.maxDisp) return DEFL;
  return (a.maxDisp * DEFL > MAX_DRAWN_SAG) ? MAX_DRAWN_SAG / a.maxDisp : DEFL;
}
function np(i) {
  if (S.coll) return { x: S.coll.p[i].x, y: S.coll.p[i].y };
  var n = S.nodes[i], a = S.analysis;
  if (a && a.u && !a.mechanism) {
    var d = deflScale();
    return { x: n.x + a.u[2 * i] * d, y: n.y + a.u[2 * i + 1] * d };
  }
  return { x: n.x, y: n.y };
}
function isLive(i) {
  if (S.test && S.test.live) return !!S.test.live[i];
  return !S.members[i].broken;
}

/* --------------------------------------------------------------- drawing */
function memberStyle(i) {
  var a = S.analysis;
  if (!a || a.mechanism || !S.showForces()) return { c: '#7d97b4', glow: 0 };
  if (a.zeroForce && a.zeroForce[i]) return { c: '#3d5a7a', glow: 0 };
  var f = a.force[i], u = Math.min(1.35, a.util[i] || 0);
  if (Math.abs(f) < 300) return { c: '#4a6c92', glow: 0 };
  /* Murray State accents: Red Orange for tension, Lite Blue for compression */
  var hue = f > 0 ? 14 : 197;
  var sat = Math.round(55 + 45 * Math.min(1, u));
  var lig = Math.round(67 - 21 * Math.min(1, u));
  return { c: 'hsl(' + hue + ' ' + sat + '% ' + lig + '%)', glow: u > 0.85 ? (u - 0.85) / 0.5 : 0 };
}
S.showForces = function () { return (S.phase === 'build' && S.xray) || S.phase === 'test'; };

function draw(t) {
  var W = cv.clientWidth, H = cv.clientHeight, L = S.L;
  ctx.save();
  if (S.shake > 0.01) {
    ctx.translate((Math.random() - 0.5) * S.shake * 14, (Math.random() - 0.5) * S.shake * 14);
    S.shake *= 0.9;
  }
  /* sky */
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#001127'); g.addColorStop(1, '#00294f');
  ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);

  drawTerrain(W, H);
  drawGrid();

  /* members */
  var lw = Math.max(3, V.s * 0.11) * (S.big ? 1.25 : 1);
  for (var i = 0; i < S.members.length; i++) {
    if (!isLive(i)) continue;
    var m = S.members[i], a = np(m.a), b = np(m.b), st = memberStyle(i);
    if (st.glow > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.22 + 0.3 * Math.abs(Math.sin(t / 110))) * Math.min(1, st.glow) + ')';
      ctx.lineWidth = lw + 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(SX(a.x), SY(a.y)); ctx.lineTo(SX(b.x), SY(b.y)); ctx.stroke();
    }
    ctx.strokeStyle = st.c; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(SX(a.x), SY(a.y)); ctx.lineTo(SX(b.x), SY(b.y)); ctx.stroke();
  }
  drawDebris();

  /* joints */
  var r = Math.max(3, V.s * 0.075) * (S.big ? 1.2 : 1);
  for (i = 0; i < S.nodes.length; i++) {
    var n = S.nodes[i], p = np(i);
    if (n.anchor) { drawAnchor(n, p, r); continue; }
    ctx.fillStyle = (S.sel === i) ? '#ECAC00' : '#cfdcea';
    ctx.beginPath(); ctx.arc(SX(p.x), SY(p.y), r, 0, 7); ctx.fill();
  }

  if (S.phase === 'test' || S.coll) drawVehicle();
  if (S.nums && S.showForces() && S.analysis && !S.analysis.mechanism) drawNumbers(lw);
  if (S.drag) drawDragPreview(lw);
  if (S.tool === 'inspect' && S.sel >= 0) drawFBD();
  if (S.phase === 'build' && S.unbraced && S.unbraced.length) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,69,0,' + (0.55 + 0.4 * Math.abs(Math.sin(t / 260))) + ')';
    ctx.lineWidth = 3;
    for (var ub = 0; ub < S.unbraced.length; ub++) {
      var un = np(S.unbraced[ub]);
      ctx.beginPath(); ctx.arc(SX(un.x), SY(un.y), Math.max(9, V.s * 0.19), 0, 7); ctx.stroke();
    }
    ctx.restore();
  }
  if (S.hover != null && S.phase === 'build' && S.tool === 'build') {
    ctx.fillStyle = 'rgba(236,172,0,.6)';
    ctx.beginPath(); ctx.arc(SX(S.hover.x), SY(S.hover.y), r * 0.75, 0, 7); ctx.fill();
  }
  if (S.keyboard && S.phase === 'build' && document.activeElement === cv && S.kcur) {
    ctx.save(); ctx.strokeStyle = '#ECAC00'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(SX(S.kcur.x), SY(S.kcur.y), Math.max(8, r * 1.7), 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = '#ECAC00'; ctx.font = '700 11px system-ui';
    ctx.fillText('KEYBOARD CURSOR', SX(S.kcur.x) + 10, SY(S.kcur.y) - 10); ctx.restore();
  }
  if (S.analysis && S.analysis.mechanism && S.phase === 'build' && S.xray && S.members.length) {
    /* nothing tied into the supports: there is no fold to show, because there
       is no structure yet. Say that, rather than claiming a mechanism mode we
       do not have. */
    if (!S.analysis.mode && !(S.analysis.modes && S.analysis.modes.length)) {
      banner('NOTHING IS HOLDING THE LOAD UP', '#ffb347',
        S.analysis.empty
          ? 'every member you have drawn is a free-hanging stub — none of them ties back to an abutment'
          : 'connect the roadway to the abutments');
      ctx.restore();
      return;
    }
    drawFoldGhost(t);
    var nz = S.analysis.nullity || 1;
    var pl = S.foldC;
    var sub = (pl && pl.disp > 0.15 && S.foldErr < 0.005)
      ? 'every member stays exactly its built length (max change ' +
        (S.foldErr * 100).toFixed(2) + '%) — nothing stretches, it just folds'
      : 'zero stiffness here: it can only move by stretching members, so it sags before it resists';
    banner(nz === 1
      ? 'MECHANISM · one way it can fold'
      : 'MECHANISM · ' + nz + ' independent ways it can fold — showing ' +
        (foldIndex(t) + 1) + ' of ' + nz, '#ffb347', sub);
  }
  if (S.phase === 'test') {
    banner('LOAD TEST — sag shown ×' + Math.round(deflScale()), '#7fd0ff');
  }
  ctx.restore();
}

/* Draw the structure displaced along the solver's null-space vector, rocking
   back and forth. This is not an illustration of a fold — it IS the fold: the
   exact displacement pattern that strains no member, which is why K is
   singular. Seeing it is usually the moment the penny drops. */
function foldIndex(t) {
  var a = S.analysis;
  if (!a.modes || a.modes.length < 2) return 0;
  return Math.floor(t / 2600) % a.modes.length;
}
/* Pick, once per design, the largest amplitude at which this fold can still be
   drawn with every member at its exact built length. */
function foldPlan(t) {
  var a = S.analysis, idx = foldIndex(t), key = S.ver + '|' + idx;
  if (S.foldC && S.foldC.key === key) return S.foldC;
  var mode = (a.modes && a.modes.length) ? a.modes[idx] : a.mode;
  if (!mode) return null;
  var best = null, target = 0;
  var ladder = [1.4, 2.2, 3.2, 4.5];
  for (var i = 0; i < ladder.length; i++) {
    var f = P.foldShape(S.nodes, S.members, null, mode, ladder[i], 100);
    if (f.err > 0.005) break;           // would need stretching — do not draw it
    best = f; target = ladder[i];
    if (f.disp > 0.95) break;
  }
  if (!best) {                          // no length-exact path: show the tangent, small
    best = P.foldShape(S.nodes, S.members, null, mode, 0.3, 100);
    target = 0.3;
  }
  S.foldC = { key: key, mode: mode, target: target, err: best.err, disp: best.disp };
  return S.foldC;
}
function drawFoldGhost(t) {
  var c = foldPlan(t), i;
  if (!c) return;
  var dwell = 0.5 - 0.5 * Math.cos((t % 2600) / 2600 * Math.PI * 2);
  var f = P.foldShape(S.nodes, S.members, null, c.mode, c.target * dwell, 55);
  var pts = f.pts;
  var mx = 0;
  for (i = 0; i < S.nodes.length; i++)
    mx = Math.max(mx, Math.hypot(pts[i].x - S.nodes[i].x, pts[i].y - S.nodes[i].y));
  var lw = Math.max(3, V.s * 0.11) * (S.big ? 1.25 : 1);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,179,71,.5)';
  ctx.lineWidth = lw * 0.85; ctx.lineCap = 'round'; ctx.setLineDash([7, 8]);
  for (i = 0; i < S.members.length; i++) {
    if (!isLive(i)) continue;
    var m = S.members[i];
    ctx.beginPath();
    ctx.moveTo(SX(pts[m.a].x), SY(pts[m.a].y));
    ctx.lineTo(SX(pts[m.b].x), SY(pts[m.b].y));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  /* Mark where every joint ENDS UP. Without this the dashed members just stop
     in mid-air next to a stationary support glyph, which reads as a member
     changing length when in fact the support has slid along its bearing. */
  var r = Math.max(3, V.s * 0.075) * (S.big ? 1.2 : 1);
  for (i = 0; i < S.nodes.length; i++) {
    var moved = Math.hypot(pts[i].x - S.nodes[i].x, pts[i].y - S.nodes[i].y);
    if (S.nodes[i].anchor) {
      if (moved > 0.01) {
        drawAnchor(S.nodes[i], pts[i], r, true);      // a roller running along its bearing
        ctx.strokeStyle = 'rgba(255,179,71,.85)';
        ctx.lineWidth = 2; ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(SX(S.nodes[i].x), SY(S.nodes[i].y));
        ctx.lineTo(SX(pts[i].x), SY(pts[i].y));
        ctx.stroke(); ctx.setLineDash([]);
      }
      continue;
    }
    ctx.fillStyle = 'rgba(255,201,120,.95)';
    ctx.beginPath(); ctx.arc(SX(pts[i].x), SY(pts[i].y), r * 0.9, 0, 7); ctx.fill();
  }
  /* ring the big movers on top */
  ctx.strokeStyle = 'rgba(255,179,71,.95)'; ctx.lineWidth = 2;
  for (i = 0; i < S.nodes.length; i++) {
    if (mx < 1e-6) break;
    if (Math.hypot(pts[i].x - S.nodes[i].x, pts[i].y - S.nodes[i].y) < mx * 0.3) continue;
    ctx.beginPath();
    ctx.arc(SX(pts[i].x), SY(pts[i].y), Math.max(7, V.s * 0.14), 0, 7);
    ctx.stroke();
  }
  ctx.restore();
  S.foldErr = f.err;
  S.ghost = pts;   // exposed so ui-smoke can measure what was actually drawn
}

function banner(text, colour, sub) {
  var W = cv.clientWidth, fs = S.big ? 20 : 15, sfs = S.big ? 15 : 11.5;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 ' + fs + 'px system-ui,sans-serif';
  var w = ctx.measureText(text).width;
  if (sub) {
    ctx.font = sfs + 'px system-ui,sans-serif';
    w = Math.max(w, ctx.measureText(sub).width);
  }
  w += 28;
  var h = (S.big ? 38 : 30) + (sub ? sfs + 6 : 0);
  ctx.fillStyle = 'rgba(0,17,36,.88)';
  roundRect(W / 2 - w / 2, 12, w, h, 8); ctx.fill();
  ctx.font = '600 ' + fs + 'px system-ui,sans-serif';
  ctx.fillStyle = colour;
  ctx.fillText(text, W / 2, 12 + (S.big ? 38 : 30) / 2 + 1);
  if (sub) {
    ctx.font = sfs + 'px system-ui,sans-serif';
    ctx.fillStyle = 'rgba(232,236,244,.72)';
    ctx.fillText(sub, W / 2, 12 + (S.big ? 38 : 30) + sfs / 2 - 1);
  }
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawTerrain(W, H) {
  var L = S.L, w = L.world, dy = L.deckY;
  var yTop = SY(dy), yBot = SY(w.y0) + 40;
  /* water in the canyon */
  var wl = dy - (L.id === 'clearance' ? 1.2 : 3.4);
  ctx.fillStyle = '#012e4d';
  ctx.fillRect(SX(L.gap.x0) - 2, SY(wl), SX(L.gap.x1) - SX(L.gap.x0) + 4, yBot - SY(wl));
  ctx.fillStyle = 'rgba(0,164,227,.20)';
  ctx.fillRect(SX(L.gap.x0) - 2, SY(wl), SX(L.gap.x1) - SX(L.gap.x0) + 4, Math.max(2, V.s * .12));
  /* banks */
  ctx.fillStyle = '#0b2b4c';
  ctx.fillRect(SX(w.x0) - 40, yTop, SX(L.gap.x0) - SX(w.x0) + 40, yBot - yTop);
  ctx.fillRect(SX(L.gap.x1), yTop, SX(w.x1) - SX(L.gap.x1) + 40, yBot - yTop);
  ctx.fillStyle = '#17466f';
  ctx.fillRect(SX(w.x0) - 40, yTop, SX(L.gap.x0) - SX(w.x0) + 40, Math.max(3, V.s * .16));
  ctx.fillRect(SX(L.gap.x1), yTop, SX(w.x1) - SX(L.gap.x1) + 40, Math.max(3, V.s * .16));
  /* road markings on the banks */
  ctx.strokeStyle = 'rgba(236,172,0,.35)'; ctx.lineWidth = 2; ctx.setLineDash([10, 12]);
  ctx.beginPath();
  ctx.moveTo(SX(w.x0), yTop - 1); ctx.lineTo(SX(L.gap.x0), yTop - 1);
  ctx.moveTo(SX(L.gap.x1), yTop - 1); ctx.lineTo(SX(w.x1), yTop - 1);
  ctx.stroke(); ctx.setLineDash([]);
  /* pier */
  if (L.pier) {
    ctx.fillStyle = '#0b2b4c';
    ctx.fillRect(SX(L.pier.x - L.pier.w / 2), SY(L.pier.top), V.s * L.pier.w, SY(L.pier.bottom) - SY(L.pier.top));
    ctx.fillStyle = '#17466f';
    ctx.fillRect(SX(L.pier.x - L.pier.w / 2), SY(L.pier.top), V.s * L.pier.w, Math.max(3, V.s * .16));
  }
  /* forbidden-zone shading below the deck */
  if (L.build.ymin >= L.deckY) {
    ctx.fillStyle = 'rgba(255,69,0,.07)';
    ctx.fillRect(SX(L.gap.x0), yTop, SX(L.gap.x1) - SX(L.gap.x0), SY(wl) - yTop);
    ctx.font = (S.big ? 15 : 12) + 'px system-ui'; ctx.fillStyle = 'rgba(255,120,70,.65)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('NO BUILDING BELOW THE DECK', (SX(L.gap.x0) + SX(L.gap.x1)) / 2, yTop + 10);
  }
}

function drawGrid() {
  if (S.phase !== 'build') return;
  var b = S.L.build;
  ctx.fillStyle = 'rgba(255,255,255,.10)';
  var r = Math.max(1, V.s * 0.02);
  for (var x = b.xmin; x <= b.xmax + 1e-9; x += GRID)
    for (var y = b.ymin; y <= b.ymax + 1e-9; y += GRID) {
      ctx.beginPath(); ctx.arc(SX(x), SY(y), r, 0, 7); ctx.fill();
    }
  /* deck line */
  ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.moveTo(SX(b.xmin), SY(S.L.deckY)); ctx.lineTo(SX(b.xmax), SY(S.L.deckY));
  ctx.stroke(); ctx.setLineDash([]);
}

function drawAnchor(n, p, r, ghost) {
  var x = SX(p.x), y = SY(p.y), s = r * 2.3;
  if (ghost) ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#ECAC00';
  ctx.beginPath(); ctx.arc(x, y, r * 1.25, 0, 7); ctx.fill();
  ctx.beginPath();
  if (n.type === 'roller') {
    ctx.moveTo(x, y); ctx.lineTo(x - s, y + s * 1.15); ctx.lineTo(x + s, y + s * 1.15); ctx.closePath();
    ctx.fillStyle = 'rgba(236,172,0,.75)'; ctx.fill();
    ctx.fillStyle = '#ECAC00';
    ctx.beginPath(); ctx.arc(x - s * .5, y + s * 1.5, s * .34, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + s * .5, y + s * 1.5, s * .34, 0, 7); ctx.fill();
  } else {
    ctx.moveTo(x, y); ctx.lineTo(x - s, y + s * 1.5); ctx.lineTo(x + s, y + s * 1.5); ctx.closePath();
    ctx.fillStyle = 'rgba(236,172,0,.75)'; ctx.fill();
    ctx.strokeStyle = '#ECAC00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - s * 1.25, y + s * 1.55); ctx.lineTo(x + s * 1.25, y + s * 1.55); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawNumbers(lw) {
  var a = S.analysis;
  ctx.font = (S.big ? 14 : 11) + 'px ui-monospace,SFMono-Regular,Menlo,monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (var i = 0; i < S.members.length; i++) {
    if (!isLive(i)) continue;
    var f = a.force[i];
    if (Math.abs(f) < 400) continue;
    var m = S.members[i], p1 = np(m.a), p2 = np(m.b);
    var x = (SX(p1.x) + SX(p2.x)) / 2, y = (SY(p1.y) + SY(p2.y)) / 2;
    var txt = (Math.abs(f) / 1000).toFixed(0);
    var w = ctx.measureText(txt).width + 8;
    ctx.fillStyle = 'rgba(0,17,36,.85)'; roundRect(x - w / 2, y - 8, w, 16, 4); ctx.fill();
    ctx.fillStyle = f > 0 ? '#ff9878' : '#7ad4f5';
    ctx.fillText(txt, x, y + 1);
  }
}

/* -------------------------------------------------------- free body panel */
function drawFBD() {
  var a = S.analysis, i = S.sel;
  if (!a || i < 0) { $('fbd').classList.add('hidden'); return; }
  /* A mechanism has no equilibrium to report, but silently showing nothing is
     what made this tool look broken. Say why, and say what to do about it. */
  var unb = S.unbraced && S.unbraced.indexOf(i) >= 0;
  if (a.mechanism || unb) {
    var deg = 0, dirs = [];
    for (var q = 0; q < S.members.length; q++) {
      if (!isLive(q) || (S.members[q].a !== i && S.members[q].b !== i)) continue;
      deg++;
      var oq = S.members[q].a === i ? S.members[q].b : S.members[q].a;
      var ang = Math.atan2(S.nodes[oq].y - S.nodes[i].y, S.nodes[oq].x - S.nodes[i].x);
      dirs.push(((ang * 180 / Math.PI) + 360) % 180);   // line direction, 0-180
    }
    var pm = np(i);
    ctx.save();
    ctx.strokeStyle = unb ? 'rgba(255,69,0,.95)' : 'rgba(236,172,0,.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(SX(pm.x), SY(pm.y), Math.max(8, V.s * 0.15), 0, 7); ctx.stroke();
    ctx.restore();
    var e2 = $('fbd');
    var body2;
    if (unb) {
      /* the confusing case: several members meet, yet the joint is flagged.
         Say the actual reason — they all run along one line. */
      var uniq = [];
      for (q = 0; q < dirs.length; q++) {
        var seenDir = false;
        for (var w = 0; w < uniq.length; w++)
          if (Math.abs(dirs[q] - uniq[w]) < 0.1 || Math.abs(dirs[q] - uniq[w] - 180) < 0.1) seenDir = true;
        if (!seenDir) uniq.push(dirs[q]);
      }
      body2 = '<div style="line-height:1.5"><b>' + deg + ' member' + (deg === 1 ? '' : 's') +
        ' meet here, but they all lie along the same straight line</b>' +
        (uniq.length ? ' (' + uniq.map(function (d) { return d.toFixed(0) + '°'; }).join(' and ') + ')' : '') +
        '. A member only resists being stretched or squashed along its own axis, so nothing here can ' +
        'push back against a wheel pressing <i>across</i> that line. Run a diagonal or a post from this ' +
        'joint to somewhere off the line — or erase the joint and let the roadway run straight through.</div>';
    } else {
      body2 = '<div style="line-height:1.5">' + deg + ' member' + (deg === 1 ? '' : 's') +
        ' meet here, but there are <b>no forces to show yet</b>: this structure can still fold, so it never ' +
        'reaches equilibrium. Brace it until the mechanism warning clears and the force arrows will appear.</div>';
    }
    var html2 = '<h4>Joint ' + i + (S.nodes[i].anchor ? ' (support)' : '') +
      (unb ? ' — nothing bracing it' : '') + '</h4>' + body2;
    if (e2.dataset.key !== html2) { e2.dataset.key = html2; e2.innerHTML = html2; }
    e2.style.maxWidth = '22em';
    e2.classList.remove('hidden');
    e2.style.left = Math.min(cv.clientWidth - e2.offsetWidth - 12, Math.max(8, SX(pm.x) + 22)) + 'px';
    e2.style.top = Math.min(cv.clientHeight - e2.offsetHeight - 12, Math.max(8, SY(pm.y) - 30)) + 'px';
    return;
  }
  var p = np(i), px = SX(p.x), py = SY(p.y);
  var rows = [], sx = 0, sy = 0, maxF = 1;
  for (var k = 0; k < S.members.length; k++) {
    if (!isLive(k)) continue;
    var m = S.members[k];
    if (m.a !== i && m.b !== i) continue;
    var o = m.a === i ? m.b : m.a;
    /* directions come from the UNDEFLECTED geometry — that is the frame the
       linear solve refers its forces to, and it is what makes ΣF come out zero */
    var dx = S.nodes[o].x - S.nodes[i].x, dy = S.nodes[o].y - S.nodes[i].y;
    var l = Math.hypot(dx, dy) || 1;
    var f = a.force[k];                         // + tension pulls the joint toward the far end
    rows.push({ k: k, fx: f * dx / l, fy: f * dy / l, f: f, o: o });
    sx += f * dx / l; sy += f * dy / l;
    maxF = Math.max(maxF, Math.abs(f));
  }
  var lv = a.loadVec;
  if (lv && (Math.abs(lv[2 * i]) > 1 || Math.abs(lv[2 * i + 1]) > 1)) {
    rows.push({ k: -1, fx: lv[2 * i], fy: lv[2 * i + 1], f: 0, label: 'applied load' });
    sx += lv[2 * i]; sy += lv[2 * i + 1];
    maxF = Math.max(maxF, Math.hypot(lv[2 * i], lv[2 * i + 1]));
  }
  for (k = 0; k < a.reactions.length; k++) if (a.reactions[k].node === i) {
    rows.push({ k: -2, fx: a.reactions[k].fx, fy: a.reactions[k].fy, f: 0, label: 'support reaction' });
    sx += a.reactions[k].fx; sy += a.reactions[k].fy;
    maxF = Math.max(maxF, Math.hypot(a.reactions[k].fx, a.reactions[k].fy));
  }

  var scale = (V.s * 2.1) / maxF;
  for (k = 0; k < rows.length; k++) {
    var r = rows[k];
    var col = r.k === -1 ? '#ECAC00' : r.k === -2 ? '#3fbf86' : (r.f > 0 ? '#ff6a45' : '#33bff0');
    arrow(px, py, px + r.fx * scale, py - r.fy * scale, col);
  }
  ctx.fillStyle = '#ECAC00';
  ctx.beginPath(); ctx.arc(px, py, 6, 0, 7); ctx.fill();

  var html = '<h4>Joint ' + i + (S.nodes[i].anchor ? ' (support)' : '') + '</h4><table>';
  for (k = 0; k < rows.length; k++) {
    var rr = rows[k];
    var nm = rr.k === -1 ? '⬇ applied load' : rr.k === -2 ? '⬆ support reaction'
      : 'member to joint ' + rr.o + ' <span style="color:' + (rr.f > 0 ? '#ff9878' : '#7ad4f5') + '">('
        + (rr.f > 0 ? 'T' : 'C') + ')</span>';
    html += '<tr><td>' + nm + '</td><td>' + kN(rr.fx) + ', ' + kN(rr.fy) + '</td></tr>';
  }
  html += '</table><div class="sum">Σ = ' + kN(sx) + ', ' + kN(sy) + ' kN &nbsp;— the joint is in equilibrium</div>';
  var e = $('fbd');
  if (e.dataset.key !== html) { e.dataset.key = html; e.innerHTML = html; }
  e.style.maxWidth = '';
  e.classList.remove('hidden');
  e.style.left = Math.min(cv.clientWidth - e.offsetWidth - 12, Math.max(8, px + 22)) + 'px';
  e.style.top = Math.min(cv.clientHeight - e.offsetHeight - 12, Math.max(8, py - 30)) + 'px';
}
function kN(v) { return (Math.abs(v) < 50 ? 0 : v / 1000).toFixed(1); }
function arrow(x1, y1, x2, y2, col) {
  var dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy);
  if (l < 4) return;
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  var ux = dx / l, uy = dy / l, h = 10;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * h - uy * h * .5, y2 - uy * h + ux * h * .5);
  ctx.lineTo(x2 - ux * h + uy * h * .5, y2 - uy * h - ux * h * .5);
  ctx.closePath(); ctx.fill();
}

/* --------------------------------------------------------------- vehicle */
function deckYAt(x) {
  var best = S.L.deckY;
  for (var i = 0; i < S.members.length; i++) {
    if (!isLive(i)) continue;
    var m = S.members[i], A = S.nodes[m.a], B = S.nodes[m.b];
    if (Math.abs(A.y - S.L.deckY) > 1e-6 || Math.abs(B.y - S.L.deckY) > 1e-6) continue;
    var lo = Math.min(A.x, B.x), hi = Math.max(A.x, B.x);
    if (x < lo - 1e-6 || x > hi + 1e-6) continue;
    var pa = np(m.a), pb = np(m.b);
    var t = (x - A.x) / (B.x - A.x);
    return pa.y + (pb.y - pa.y) * t;
  }
  return best;
}
function drawVehicle() {
  var v = vehicle(), x = S.test ? S.test.x : (S.coll ? S.coll.vx : 0);
  var yBase = S.coll && S.coll.fall ? S.coll.vy : deckYAt(x);
  var wb = LV.vehicleLength(v), r = Math.max(3, V.s * 0.16);
  var bodyH = v.hgt, back = x - wb - 0.7, front = x + 0.7;  // = vehicleBody(v) long
  var tilt = S.coll ? S.coll.vrot : 0;
  ctx.save();
  ctx.translate(SX((back + front) / 2), SY(yBase));
  ctx.rotate(tilt);
  var w = V.s * (front - back), h = V.s * bodyH;
  ctx.fillStyle = v.colour;
  roundRect(-w / 2, -h - r * .6, w, h, Math.min(10, h * .3)); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.30)';
  roundRect(-w / 2 + w * .12, -h + h * .12, w * .42, h * .42, 4); ctx.fill();
  ctx.fillStyle = '#20262f';
  for (var i = 0; i < v.axles.length; i++) {
    var ax = -w / 2 + V.s * ((x - v.axles[i].dx) - back);
    ctx.beginPath(); ctx.arc(ax, -r * .6, r, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/* --------------------------------------------------------------- debris */
function addDebris(mi) {
  var m = S.members[mi], A = np(m.a), B = np(m.b);
  var mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
  [[A, { x: mx, y: my }], [{ x: mx, y: my }, B]].forEach(function (seg) {
    S.debris.push({
      cx: (seg[0].x + seg[1].x) / 2, cy: (seg[0].y + seg[1].y) / 2,
      len: Math.hypot(seg[1].x - seg[0].x, seg[1].y - seg[0].y),
      ang: Math.atan2(seg[1].y - seg[0].y, seg[1].x - seg[0].x),
      vx: (Math.random() - .5) * 4, vy: 1.5 + Math.random() * 3,
      va: (Math.random() - .5) * 7, life: 1
    });
  });
  for (var s = 0; s < 14; s++)
    S.debris.push({ spark: 1, cx: mx, cy: my, vx: (Math.random() - .5) * 9,
                    vy: Math.random() * 7, life: 1 });
}
function stepDebris(dt) {
  for (var i = S.debris.length - 1; i >= 0; i--) {
    var d = S.debris[i];
    d.vy -= 9.81 * dt; d.cx += d.vx * dt; d.cy += d.vy * dt;
    if (!d.spark) d.ang += d.va * dt;
    d.life -= dt * (d.spark ? 1.7 : 0.45);
    if (d.life <= 0 || d.cy < S.L.world.y0 - 3) S.debris.splice(i, 1);
  }
}
function drawDebris() {
  for (var i = 0; i < S.debris.length; i++) {
    var d = S.debris[i];
    ctx.globalAlpha = Math.max(0, Math.min(1, d.life));
    if (d.spark) {
      ctx.fillStyle = '#ECAC00';
      ctx.beginPath(); ctx.arc(SX(d.cx), SY(d.cy), 2.5, 0, 7); ctx.fill();
    } else {
      ctx.save(); ctx.translate(SX(d.cx), SY(d.cy)); ctx.rotate(-d.ang);
      ctx.strokeStyle = '#7d97b4'; ctx.lineWidth = Math.max(3, V.s * .1); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-V.s * d.len / 2, 0); ctx.lineTo(V.s * d.len / 2, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------ test phase */
function startTest() {
  var v = vehicle();
  var cov = P.deckCoverage(S.nodes, S.members, null, S.L.deckY, S.L.gap.x0, S.L.gap.x1);
  if (!cov.ok) { setStatus('The roadway has a gap at x = ' + cov.gapAt.toFixed(1) + ' m.', 'err'); return; }
  S.phase = 'test'; S.sel = -1; $('fbd').classList.add('hidden');
  var M = S.members.length;
  S.test = {
    x: S.L.gap.x0, endX: S.L.gap.x1 + LV.vehicleLength(v),
    live: new Uint8Array(M).fill(1),
    maxT: new Float64Array(M), maxC: new Float64Array(M),
    maxU: new Float64Array(M), buckLen: new Float64Array(M), broke: [], first: null,
    peakDefl: 0, mechanism: false, speed: Math.max(1.6, (S.L.gap.x1 - S.L.gap.x0) / 5.5)
  };
  S.debris = [];
  refresh();
}
function stepTest(dt) {
  var T = S.test, v = vehicle();
  T.x += T.speed * dt;
  var done = T.x >= T.endX;
  if (done) T.x = T.endX;

  var wl = P.wheelLoads(S.nodes, S.members, T.live, S.L.deckY, v, T.x);
  var out = P.solveWithBreaks({ nodes: S.nodes, members: S.members, live: T.live,
                                loads: wl.loads, selfWeight: S.selfWeight }, 40);
  S.analysis = out.result;
  for (var i = 0; i < S.members.length; i++) {
    if (!T.live[i]) continue;
    var f = out.result.force[i];
    if (f > T.maxT[i]) T.maxT[i] = f;
    if (f < T.maxC[i]) T.maxC[i] = f;
    if (out.result.util[i] > T.maxU[i]) T.maxU[i] = out.result.util[i];
    T.buckLen[i] = out.result.buckLen[i];
  }
  if (out.result.maxDisp > T.peakDefl) T.peakDefl = out.result.maxDisp;

  if (out.broke.length) {
    for (i = 0; i < out.broke.length; i++) {
      var br = out.broke[i], bi = br.member, bf = br.force;
      if (bf > T.maxT[bi]) T.maxT[bi] = bf;
      if (bf < T.maxC[bi]) T.maxC[bi] = bf;
      if (br.util > T.maxU[bi]) T.maxU[bi] = br.util;
      addDebris(out.broke[i].member);
      T.broke.push({ x: T.x, member: out.broke[i].member, util: out.broke[i].util,
                     force: out.broke[i].force });
      if (!T.first) T.first = { x: T.x, member: out.broke[i].member, util: out.broke[i].util,
                                force: out.broke[i].force,
                                mode: out.broke[i].force > 0 ? 'tension' : 'buckling' };
    }
    T.live = out.live;
    S.shake = 1;
  }
  if (out.result.mechanism) {
    T.mechanism = true;
    if (!T.first) T.first = { member: -1, mode: 'mechanism', reason: out.result.reason, x: T.x };
    T.modeVec = out.result.mode;
    startCollapse(out.result);
    return;
  }
  if (done) finishTest();
}

/* ---------------------------------------------------------- the collapse */
/* The solver has already told us the structure is a mechanism and given us the
   null-space direction it moves in. Play that direction first so the class can
   SEE which way it folds, then hand over to a position-based rope simulation
   so the wreckage falls convincingly. */
function startCollapse(res) {
  var p = [], L = S.L;
  for (var i = 0; i < S.nodes.length; i++) {
    var n = S.nodes[i];
    p.push({ x: n.x, y: n.y, ox: n.x, oy: n.y, px: n.x, py: n.y,
             fixX: !!n.fixX, fixY: !!n.fixY });
  }
  var links = [];
  for (i = 0; i < S.members.length; i++) {
    if (!S.test.live[i]) continue;
    var m = S.members[i];
    links.push({ i: i, a: m.a, b: m.b, rest: mlen(m) });
  }
  var mode = chooseCollapseMode(res), amp = 0;
  if (mode) {
    var mx = 0;
    for (i = 0; i < S.nodes.length; i++) mx = Math.max(mx, Math.hypot(mode[2 * i], mode[2 * i + 1]));
    amp = mx > 1e-12 ? 1.1 / mx : 0;
  }
  S.coll = { p: p, links: links, mode: mode, amp: amp, t: 0, fall: false,
             vx: S.test.x, vy: deckYAt(S.test.x), vvy: 0, vrot: 0, done: false };
  S.analysis = null;
  S.shake = 1;
}
/* A rank-deficient frame can expose several valid folds. Prefer a projected
   one that moves the roller along its bearing, so the actual failure shows
   the support constraint instead of an arbitrary stationary-roller basis. */
function chooseCollapseMode(res) {
  var choices = [res.mode].concat(res.modes || []), best = res.mode, bestSlide = -1;
  for (var ci = 0; ci < choices.length; ci++) {
    var candidate = choices[ci];
    if (!candidate) continue;
    var mx = 0;
    for (var ni = 0; ni < S.nodes.length; ni++) mx = Math.max(mx, Math.hypot(candidate[2 * ni], candidate[2 * ni + 1]));
    if (mx < 1e-12) continue;
    var f = P.foldShape(S.nodes, S.members, S.test.live, candidate, 1.1 / mx, 120);
    if (f.err > 0.005) continue;
    var slide = 0;
    for (ni = 0; ni < S.nodes.length; ni++) {
      var n = S.nodes[ni];
      if (!n.fixX && n.fixY) slide = Math.max(slide, Math.abs(f.pts[ni].x - n.x));
    }
    if (slide > bestSlide) { best = candidate; bestSlide = slide; }
  }
  return best;
}
/* The visible phase-one collapse must be a projected finite mechanism, not
   the raw linear null vector (which stretches members at finite amplitude). */
function collapseFrame(C, progress) {
  if (!C.mode) return null;
  return P.foldShape(S.nodes, S.members, S.test.live, C.mode, C.amp * progress, 120);
}
function stepCollapse(dt) {
  var C = S.coll;
  C.t += dt;
  if (!C.fall) {
    /* phase 1 — ride the mechanism mode the solver found */
    var k = Math.min(1, C.t / 0.55), e = k * k;
    var projected = collapseFrame(C, e);
    for (var i = 0; i < C.p.length; i++) {
      var q = C.p[i];
      /* Keep each support coordinate separately: a pin holds x+y, while a
         roller holds y but must follow the projected mechanism in x. */
      q.x = q.fixX ? q.ox : (projected ? projected.pts[i].x : q.ox);
      q.y = q.fixY ? q.oy : (projected ? projected.pts[i].y : q.oy - 1.1 * e);
      q.px = q.x; q.py = q.y;
    }
    C.vy = deckYAt(C.vx) - 0.05;
    if (C.t > 0.55) { C.fall = true; C.t = 0; }
    return;
  }
  /* phase 2 — everything is falling; keep members rigid until they tear */
  var sub = 2, h = dt / sub;
  for (var s = 0; s < sub; s++) {
    for (i = 0; i < C.p.length; i++) {
      var n = C.p[i];
      var vx = n.fixX ? 0 : (n.x - n.px) * 0.995;
      var vy = n.fixY ? 0 : (n.y - n.py) * 0.995;
      n.px = n.x; n.py = n.y;
      n.x = n.fixX ? n.ox : n.x + vx;
      n.y = n.fixY ? n.oy : n.y + vy - 9.81 * h * h;
    }
    for (var it = 0; it < 3; it++) {
      for (var li = C.links.length - 1; li >= 0; li--) {
        var L2 = C.links[li], A = C.p[L2.a], B = C.p[L2.b];
        var dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1e-6;
        var strain = (d - L2.rest) / L2.rest;
        if (Math.abs(strain) > 0.42) { addDebris(L2.i); S.test.live[L2.i] = 0; C.links.splice(li, 1); continue; }
        /* Coordinate-wise position projection: rollers may slide on x while
           their bearing holds y; pins hold both. */
        var ax = A.fixX ? 0 : 1, ay = A.fixY ? 0 : 1;
        var bx = B.fixX ? 0 : 1, by = B.fixY ? 0 : 1;
        var denom = (ax + bx) * dx * dx + (ay + by) * dy * dy;
        if (denom < 1e-12) continue;
        var lambda = (d - L2.rest) / denom;
        if (ax) A.x += dx * lambda;
        if (ay) A.y += dy * lambda;
        if (bx) B.x -= dx * lambda;
        if (by) B.y -= dy * lambda;
      }
    }
  }
  C.vvy -= 9.81 * dt; C.vy += C.vvy * dt; C.vrot += dt * 1.1;
  if (C.t > 2.4 && !C.done) { C.done = true; finishTest(); }
}

/* ---------------------------------------------------------------- finish */
function finishTest() {
  var T = S.test;
  S.phase = 'done';
  var survived = T.broke.length === 0 && !T.mechanism;
  var cp = costParts(), cost = cp.total, par = S.L.par;
  S.lastDebrief = { survived: survived, cost: cost, par: par, T: T, parts: cp };
  if (survived) {
    var prog = ls(PROG_K, {});
    if (!prog[S.L.id] || cost < prog[S.L.id]) { prog[S.L.id] = Math.round(cost); ss(PROG_K, prog); }
  }
  showDebrief();
}

function memberLabel(i) {
  var m = S.members[i], A = S.nodes[m.a], B = S.nodes[m.b];
  return '(' + A.x + ', ' + A.y + ') – (' + B.x + ', ' + B.y + ')';
}

/* the one plain-language sentence */
function plainSentence(d) {
  var T = d.T, n = S.members.length, i;
  if (T.first && T.first.mode === 'mechanism') {
    return 'Nothing was stopping your structure from changing shape — the solver found a way for it to move ' +
      'without stretching a single member. Find the four-sided panel that folded and put a diagonal across it. ' +
      'A triangle is the only shape that cannot change without changing a member\'s length.';
  }
  if (T.first) {
    var mi = T.first.member, L = mlen(S.members[mi]);
    /* one member gone and the whole thing folded = a minimal truss with no spare path */
    if (T.broke.length === 1 && T.mechanism) {
      return 'One member went and the entire bridge followed. That is what a minimal truss does: ' +
        'it has exactly enough members to be rigid, so every single one is critical — lose any of them ' +
        'and what is left is a mechanism. Real bridges are built with spare load paths so that losing ' +
        'one member is survivable, and those spare paths cost money. That trade is the whole job.';
    }
    if (T.first.force < 0) {
      var bl = T.buckLen[mi] || L;
      var cc = P.capC(bl);
      return 'The first thing to go was a ' + bl.toFixed(1) + ' m compression member, and it buckled at only ' +
        (cc / 1000).toFixed(0) + ' kN — the same piece pulled in tension would have held ' +
        (P.capT() / 1000).toFixed(0) + ' kN. Buckling strength falls with the square of length, so either ' +
        'shorten your compression members or turn the truss over so the long members hang in tension.';
    }
    return 'A member tore apart in tension at ' + (P.capT() / 1000).toFixed(0) + ' kN. ' +
      'Tension is the strong direction, so this one was simply carrying too much on its own — ' +
      'deepen the truss (deeper trusses have lower chord forces) or split the load across more members.';
  }
  /* survived */
  var idle = [], idleCost = 0;
  for (i = 0; i < n; i++) if (T.maxU[i] < 0.05) { idle.push(i); idleCost += P.memberCost(mlen(S.members[i])); }
  if (idle.length >= 3) {
    return idle.length + ' of your ' + n + ' members never went above 5% of their limit. They are holding up ' +
      'nothing at all but they cost you ' + money(idleCost) + ' — delete them and test again. ' +
      '(More members does not mean stronger; it means more expensive.)';
  }
  var tL = 0, cL = 0, longC = 0, longCi = -1;
  for (i = 0; i < n; i++) {
    var L2 = mlen(S.members[i]);
    if (T.maxT[i] > -T.maxC[i]) tL += L2 * T.maxU[i]; else {
      cL += L2 * T.maxU[i];
      if (L2 > longC && T.maxU[i] > 0.25) { longC = L2; longCi = i; }
    }
  }
  if (cL > tL * 1.4 && longC > 2.2) {
    return 'Your longest compression members are doing most of the work — the ' + longC.toFixed(1) +
      ' m one buckles at ' + (P.capC(longC) / 1000).toFixed(0) + ' kN, while a member that length in tension ' +
      'would hold ' + (P.capT() / 1000).toFixed(0) + ' kN. Could shorter members carry it, or could you hang ' +
      'the deck from a truss below instead of propping it from above?';
  }
  var peak = 0; for (i = 0; i < n; i++) peak = Math.max(peak, T.maxU[i]);
  if (peak < 0.5) {
    return 'Nothing came close to failing — your busiest member only reached ' + Math.round(peak * 100) +
      '% of its limit. That is strength you paid for and did not use: try a shallower truss, fewer panels, ' +
      'or simply delete members until something starts to look worried.';
  }
  return 'Efficient: your busiest member peaked at ' + Math.round(peak * 100) + '% of its limit, so almost ' +
    'every dollar of steel is doing real work. The only way further down is a different shape, not a thinner one.';
}

function showDebrief() {
  var d = S.lastDebrief, T = d.T, n = S.members.length, i;
  var rows = [];
  for (i = 0; i < n; i++)
    rows.push({ i: i, t: T.maxT[i], c: T.maxC[i], u: T.maxU[i], len: mlen(S.members[i]),
                buck: T.buckLen[i] || mlen(S.members[i]), dead: !T.live[i] });
  rows.sort(function (a, b) { return b.u - a.u; });
  var weak = (rows.length && rows[0].u > 1e-9) ? rows[0].i : -1;
  if (T.first && T.first.member >= 0) weak = T.first.member;

  var over = d.par ? d.cost - d.par : 0;
  var html = '';
  html += '<div class="verdict ' + (d.survived ? 'pass' : 'fail') + '">' +
    (d.survived ? '✔ It held' : '✖ It failed') + '</div>';
  html += '<p class="sub">' + (d.survived
    ? vehicle().name + ' (' + (LV.vehicleWeight(vehicle()) / 1000).toFixed(0) + ' kN) crossed ' +
      (S.L.gap.x1 - S.L.gap.x0) + ' m without losing a single member.'
    : (T.first && T.first.mode === 'mechanism'
        ? 'The structure turned into a mechanism' + (T.broke.length ? ' after ' + T.broke.length + ' member' +
          (T.broke.length > 1 ? 's' : '') + ' snapped' : '') + ' and folded up.'
        : T.broke.length + ' member' + (T.broke.length > 1 ? 's' : '') + ' failed, starting at x = ' +
          T.first.x.toFixed(1) + ' m.')) + '</p>';

  html += '<div class="stats">';
  html += '<div class="stat"><div class="k">Cost</div><div class="v">' + money(d.cost) + '</div></div>';
  html += '<div class="stat"><div class="k">Steel</div><div class="v">' + money(d.parts.steel) +
    '</div><div class="k" style="text-transform:none;letter-spacing:0">' +
    d.parts.steelM.toFixed(1) + ' m · ' + (d.parts.steelM * P.MAT.massPerMetre).toFixed(0) + ' kg</div></div>';
  html += '<div class="stat"><div class="k">Connections</div><div class="v">' + money(d.parts.jointTotal) +
    '</div><div class="k" style="text-transform:none;letter-spacing:0">' + d.parts.joints +
    ' joints @ ' + money(P.MAT.costPerJoint) + '</div></div>';
  if (d.par && S.showPar) {
    html += '<div class="stat"><div class="k">Par</div><div class="v">' + money(d.par) + '</div></div>';
    html += '<div class="stat"><div class="k">Vs par</div><div class="v ' +
      (d.survived ? (over <= 0 ? 'good' : 'bad') : '') + '">' +
      (d.survived ? (over <= 0 ? '−' : '+') + money(Math.abs(over))
                  : '<span class="sub">only counts if it survives</span>') + '</div></div>';
  }
  html += '<div class="stat"><div class="k">Members</div><div class="v">' + n + '</div></div>';
  html += '<div class="stat"><div class="k">Peak sag</div><div class="v">' +
    (T.peakDefl > 1e-9 ? (T.peakDefl * 1000).toFixed(0) + ' mm' : '—') + '</div></div>';
  html += '</div>';

  html += '<div class="plain">' + plainSentence(d) + '</div>';

  /* a pure mechanism never reached equilibrium, so there are no member forces to
     report — what IS informative is the direction the solver found it moving in */
  var anyForce = false;
  for (i = 0; i < n; i++) if (T.maxU[i] > 1e-9) anyForce = true;
  if (!anyForce && T.modeVec) {
    var mv = [];
    for (i = 0; i < S.nodes.length; i++)
      mv.push({ i: i, d: Math.hypot(T.modeVec[2 * i], T.modeVec[2 * i + 1]) });
    mv.sort(function (a, b) { return b.d - a.d; });
    var top = mv.filter(function (q) { return q.d > mv[0].d * 0.25; }).slice(0, 6);
    html += '<h3 class="sec">How it moved</h3>';
    html += '<p class="sub">No member ever carried force, because the frame folded before it could push back. ' +
      'These are the joints that ran away, and the direction each one went:</p>';
    html += '<table class="data"><tr><th>joint</th><th>slid</th></tr>';
    top.forEach(function (q) {
      var dx = T.modeVec[2 * q.i], dy = T.modeVec[2 * q.i + 1];
      var dir = (Math.abs(dx) > Math.abs(dy) * 2) ? (dx > 0 ? 'sideways →' : '← sideways')
              : (Math.abs(dy) > Math.abs(dx) * 2) ? (dy > 0 ? 'straight up' : 'straight down')
              : ((dx > 0 ? 'right and ' : 'left and ') + (dy > 0 ? 'up' : 'down'));
      html += '<tr><td>(' + S.nodes[q.i].x + ', ' + S.nodes[q.i].y + ')</td><td>' + dir + '</td></tr>';
    });
    html += '</table>';
    $('dbBody').innerHTML = html + tableNote();
    finishDebriefButtons(d);
    return;
  }

  html += '<h3 class="sec">Every member, and the worst force it saw</h3>';
  html += '<table class="data"><tr><th>#</th><th>joint → joint</th><th class="num">length</th>' +
    '<th class="num">max tension</th><th class="num">max compression</th><th class="num">buckles at</th>' +
    '<th class="num">% of limit</th></tr>';
  for (i = 0; i < rows.length; i++) {
    var r = rows[i], cls = (r.i === weak) ? 'weak' : (r.u < 0.05 ? 'zero' : '');
    html += '<tr class="' + cls + '"><td>' + (r.i + 1) + (r.i === weak ? ' ⚠' : '') + '</td>' +
      '<td>' + memberLabel(r.i) + (r.dead ? ' <span style="color:#ff8f8f">— snapped</span>' : '') + '</td>' +
      '<td class="num">' + r.len.toFixed(2) + ' m</td>' +
      '<td class="num">' + (r.t > 0 ? (r.t / 1000).toFixed(1) : '—') + '</td>' +
      '<td class="num">' + (r.c < 0 ? (-r.c / 1000).toFixed(1) : '—') + '</td>' +
      '<td class="num">' + (P.capC(r.buck) / 1000).toFixed(0) + ' kN' +
      (r.buck > r.len + 1e-6 ? ' <span class="sub">(' + r.buck.toFixed(1) + ' m unbraced)</span>' : '') + '</td>' +
      '<td class="num">' + Math.round(r.u * 100) + '%</td></tr>';
  }
  html += '</table>' + tableNote();
  $('dbBody').innerHTML = html;
  finishDebriefButtons(d);
}
function tableNote() {
  return '<p class="sub" style="margin-top:.8em">Forces in kN. Every member here is the same steel section: ' +
    'it holds ' + (P.capT() / 1000).toFixed(0) + ' kN in tension no matter how long it is, but in compression ' +
    'it only holds what the buckling column says — which drops with the square of its length.</p>';
}
function finishDebriefButtons(d) {
  var official = S.vehKey === S.L.vehicle;
  var canSave = d.survived && !S.L.sandbox && official;
  $('dbName').classList.toggle('hidden', !canSave);
  $('dbSave').classList.toggle('hidden', !canSave);
  $('dbNext').classList.toggle('hidden', !(d.survived && S.li < LV.LEVELS.length - 1));
  if (d.survived && !official)
    $('dbBody').innerHTML += '<p class="sub" style="margin-top:.6em;color:#ffc75a">Tested with the ' +
      vehicle().name + ' instead of this level\'s ' + LV.VEHICLES[S.L.vehicle].name +
      ' — a demo run, so it does not go on the leaderboard.</p>';
  show('mDebrief');
}

/* ---------------------------------------------------------- interaction */
function snap(wx, wy) {
  var b = S.L.build, i;
  var gx = Math.round(wx / GRID) * GRID, gy = Math.round(wy / GRID) * GRID;
  gx = Math.max(b.xmin, Math.min(b.xmax, gx));
  gy = Math.max(b.ymin, Math.min(b.ymax, gy));
  /* A joint sitting exactly on the snapped point wins outright. Testing only
     proximity to the raw pointer is not enough: on a level that forbids
     building below the deck, a pointer under the deck CLAMPS up onto the deck
     line and can land on a joint further from the pointer than the search
     radius — which used to stack a second joint on top of the first. */
  for (i = 0; i < S.nodes.length; i++)
    if (Math.abs(S.nodes[i].x - gx) < 1e-6 && Math.abs(S.nodes[i].y - gy) < 1e-6)
      return { x: S.nodes[i].x, y: S.nodes[i].y, node: i };
  /* otherwise the nearest joint to the pointer (anchors included) */
  var best = -1, bd = 0.42;
  for (i = 0; i < S.nodes.length; i++) {
    var d = Math.hypot(S.nodes[i].x - wx, S.nodes[i].y - wy);
    if (d < bd) { bd = d; best = i; }
  }
  if (best >= 0) return { x: S.nodes[best].x, y: S.nodes[best].y, node: best };
  return { x: gx, y: gy, node: -1 };
}

/* Two joints can never occupy the same point: the members meeting there would
   be split between them, so the structure would look connected while carrying
   load through only some of it. Also repairs any design saved before the snap
   fix above. */
function mergeCoincident() {
  var i, j;
  for (i = 0; i < S.nodes.length; i++) {
    for (j = S.nodes.length - 1; j > i; j--) {
      if (Math.abs(S.nodes[i].x - S.nodes[j].x) > 1e-6) continue;
      if (Math.abs(S.nodes[i].y - S.nodes[j].y) > 1e-6) continue;
      if (S.nodes[j].anchor && !S.nodes[i].anchor) continue;   // never discard an abutment
      var jj = j;
      S.members.forEach(function (m) { if (m.a === jj) m.a = i; if (m.b === jj) m.b = i; });
      S.nodes.splice(j, 1);
      S.members.forEach(function (m) { if (m.a > jj) m.a--; if (m.b > jj) m.b--; });
    }
  }
  var seen = {}, out = [];
  for (var k = 0; k < S.members.length; k++) {
    var m2 = S.members[k];
    if (m2.a === m2.b) continue;                                // collapsed to nothing
    var key = Math.min(m2.a, m2.b) + ':' + Math.max(m2.a, m2.b);
    if (seen[key]) continue;                                    // merged into a twin
    seen[key] = 1; out.push(m2);
  }
  S.members = out;
}
function nodeAt(wx, wy, tol) {
  var best = -1, bd = tol || 0.4;
  for (var i = 0; i < S.nodes.length; i++) {
    var p = np(i), d = Math.hypot(p.x - wx, p.y - wy);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function memberAt(wx, wy) {
  var best = -1, bd = 0.28;
  for (var i = 0; i < S.members.length; i++) {
    if (!isLive(i)) continue;
    var m = S.members[i], A = np(m.a), B = np(m.b);
    var dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy;
    var t = L2 ? Math.max(0, Math.min(1, ((wx - A.x) * dx + (wy - A.y) * dy) / L2)) : 0;
    var d = Math.hypot(wx - (A.x + t * dx), wy - (A.y + t * dy));
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function inZone(x, y) {
  var b = S.L.build;
  return x >= b.xmin - 1e-6 && x <= b.xmax + 1e-6 && y >= b.ymin - 1e-6 && y <= b.ymax + 1e-6;
}
function ensureNode(p) {
  if (p.node >= 0) return p.node;
  for (var i = 0; i < S.nodes.length; i++)      // belt and braces: never stack joints
    if (Math.abs(S.nodes[i].x - p.x) < 1e-6 && Math.abs(S.nodes[i].y - p.y) < 1e-6) return i;
  S.nodes.push({ x: p.x, y: p.y, anchor: false, fixX: 0, fixY: 0 });
  return S.nodes.length - 1;
}
function hasMember(a, b) {
  for (var i = 0; i < S.members.length; i++)
    if ((S.members[i].a === a && S.members[i].b === b) || (S.members[i].a === b && S.members[i].b === a)) return i;
  return -1;
}
function dragProblem(p0, p1) {
  var len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  if (len < GRID * 0.6) return 'too short';
  if (len > MAXLEN + 1e-6) return 'too long — members max out at ' + MAXLEN + ' m';
  if (p0.node < 0 && !inZone(p0.x, p0.y)) return 'outside the build area';
  if (p1.node < 0 && !inZone(p1.x, p1.y)) return 'outside the build area';
  if (p0.node >= 0 && p1.node >= 0 && hasMember(p0.node, p1.node) >= 0) return 'already a member there';
  return null;
}
function drawDragPreview(lw) {
  var d = S.drag, bad = dragProblem(d.p0, d.p1);
  ctx.strokeStyle = bad ? 'rgba(255,69,0,.9)' : 'rgba(236,172,0,.9)';
  ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.setLineDash(bad ? [8, 8] : []);
  ctx.beginPath(); ctx.moveTo(SX(d.p0.x), SY(d.p0.y)); ctx.lineTo(SX(d.p1.x), SY(d.p1.y)); ctx.stroke();
  ctx.setLineDash([]);
}

function pointer(e) {
  var r = cv.getBoundingClientRect();
  return { x: WX(e.clientX - r.left), y: WY(e.clientY - r.top) };
}
cv.addEventListener('pointerdown', function (e) {
  if (S.phase !== 'build') return;
  cv.focus();
  cv.setPointerCapture(e.pointerId);
  var w = pointer(e);
  S.kcur = snap(w.x, w.y);
  if (S.tool === 'build') {
    var p = snap(w.x, w.y);
    S.drag = { p0: p, p1: p };
  } else if (S.tool === 'erase') {
    var mi = memberAt(w.x, w.y);
    if (mi >= 0) { pushUndo(); S.members.splice(mi, 1); cleanup(); unweldAll(); refresh(); return; }
    var ni = nodeAt(w.x, w.y, 0.4);
    if (ni >= 0 && !S.nodes[ni].anchor) { pushUndo(); removeNode(ni); unweldAll(); refresh(); }
  } else {
    var k = nodeAt(w.x, w.y, 0.5);
    S.sel = k;
    if (k < 0) {
      $('fbd').classList.add('hidden');
      setStatus('No joint there — tap directly on one of the round joints.', 'warn');
    } else setStatus('');
  }
});
cv.addEventListener('pointermove', function (e) {
  if (S.phase !== 'build') return;
  var w = pointer(e);
  if (S.drag) {
    S.drag.p1 = snap(w.x, w.y);
    var bad = dragProblem(S.drag.p0, S.drag.p1);
    var len = Math.hypot(S.drag.p1.x - S.drag.p0.x, S.drag.p1.y - S.drag.p0.y);
    setStatus(bad ? bad : len.toFixed(2) + ' m · ' + money(P.memberCost(len)), bad ? 'err' : '');
  } else if (S.tool === 'build') {
    S.hover = snap(w.x, w.y);
  }
});
function endDrag() {
  if (!S.drag) return;
  var d = S.drag; S.drag = null;
  if (!dragProblem(d.p0, d.p1)) {
    pushUndo();
    var a = ensureNode(d.p0), b = ensureNode(d.p1);
    if (a !== b && hasMember(a, b) < 0) S.members.push({ a: a, b: b, broken: false });
    mergeCoincident();
    weldAll();
  }
  cleanup(); refresh();   // refresh() owns the status line, including warnings
}

/* A joint dropped part-way along a member has to actually BE a joint: split the
   member there. Otherwise the joint sits on top of the member looking connected
   while carrying nothing, which is invisible and deeply confusing. Splitting
   costs nothing extra (cost is per metre) and the solver re-joins collinear
   runs internally, so the buckling length is still measured over the whole
   straight run. Works in both directions — a new joint landing on an old
   member, and a new member drawn straight through an existing joint. */
function weldAll() {
  var guard = 0, changed = true;
  while (changed && guard++ < 60) {
    changed = false;
    for (var i = S.members.length - 1; i >= 0 && !changed; i--) {
      var m = S.members[i], A = S.nodes[m.a], B = S.nodes[m.b];
      var dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy;
      if (L2 < 1e-12) continue;
      var L = Math.sqrt(L2);
      for (var n = 0; n < S.nodes.length; n++) {
        if (n === m.a || n === m.b) continue;
        var p = S.nodes[n];
        var t = ((p.x - A.x) * dx + (p.y - A.y) * dy) / L2;
        if (t <= 1e-6 || t >= 1 - 1e-6) continue;                   // not between the ends
        if (Math.abs((p.x - A.x) * dy - (p.y - A.y) * dx) / L > 1e-6) continue;  // off the line
        S.members.splice(i, 1);
        if (hasMember(m.a, n) < 0) S.members.push({ a: m.a, b: n, broken: false });
        if (hasMember(n, m.b) < 0) S.members.push({ a: n, b: m.b, broken: false });
        changed = true;
        break;
      }
    }
  }
}
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('pointerleave', function () { S.hover = null; });

/* Keyboard-only editing mirrors the pointer tools at one snapped grid point.
   B chooses a start then an end, E erases what is under the cursor, and I
   inspects a joint; the canvas label and live status make this discoverable. */
function keyboardPoint() { return snap(S.kcur.x, S.kcur.y); }
function keyboardBuild() {
  var p = keyboardPoint();
  if (!S.kstart) { S.kstart = p; setStatus('Member start at (' + p.x + ', ' + p.y + '). Move the cursor, then press B to finish.', ''); return; }
  S.drag = { p0: S.kstart, p1: p }; S.kstart = null; endDrag();
  setStatus('Member built at the keyboard cursor. B starts the next member.', '');
}
function keyboardErase() {
  var p = keyboardPoint(), mi = memberAt(p.x, p.y);
  if (mi >= 0) { pushUndo(); S.members.splice(mi, 1); cleanup(); unweldAll(); refresh(); setStatus('Erased member at cursor.', ''); return; }
  var ni = nodeAt(p.x, p.y, 0.4);
  if (ni >= 0 && !S.nodes[ni].anchor) { pushUndo(); removeNode(ni); unweldAll(); refresh(); setStatus('Erased joint at cursor.', ''); return; }
  setStatus('Nothing removable at the keyboard cursor.', 'warn');
}
function keyboardInspect() {
  var p = keyboardPoint(), ni = nodeAt(p.x, p.y, 0.5);
  S.sel = ni;
  if (ni < 0) { $('fbd').classList.add('hidden'); setStatus('No joint at the keyboard cursor.', 'warn'); }
  else { setStatus('Inspecting joint at (' + S.nodes[ni].x + ', ' + S.nodes[ni].y + ').', ''); refresh(); }
}
cv.addEventListener('keydown', function (e) {
  if (!S.keyboard || S.phase !== 'build') return;
  if (!S.kcur) S.kcur = { x: S.L.gap.x0, y: S.L.deckY };
  var dx = 0, dy = 0;
  if (e.key === 'ArrowLeft') dx = -GRID; else if (e.key === 'ArrowRight') dx = GRID;
  else if (e.key === 'ArrowUp') dy = GRID; else if (e.key === 'ArrowDown') dy = -GRID;
  if (dx || dy) {
    e.preventDefault(); var b = S.L.build;
    S.kcur.x = Math.max(b.xmin, Math.min(b.xmax, S.kcur.x + dx));
    S.kcur.y = Math.max(b.ymin, Math.min(b.ymax, S.kcur.y + dy));
    setStatus('Cursor at (' + S.kcur.x + ', ' + S.kcur.y + '). B build, E erase, I inspect.', ''); return;
  }
  if (e.key === 'b' || e.key === 'B') { e.preventDefault(); keyboardBuild(); }
  if (e.key === 'e' || e.key === 'E') { e.preventDefault(); keyboardErase(); }
  if (e.key === 'i' || e.key === 'I') { e.preventDefault(); keyboardInspect(); }
});

function removeNode(ni) {
  S.members = S.members.filter(function (m) { return m.a !== ni && m.b !== ni; });
  S.nodes.splice(ni, 1);
  S.members.forEach(function (m) { if (m.a > ni) m.a--; if (m.b > ni) m.b--; });
  cleanup();
}
/* The inverse of weldAll: a joint left with exactly two members running
   straight through it is a scar, not a joint. It carries no load a single
   member would not, it charges $180, and — because the solver only condenses
   it while it is UNLOADED — the bridge fails the moment a wheel lands on it.
   Erasing a member must put the topology back the way it was. */
function unweldAll() {
  var guard = 0, changed = true;
  while (changed && guard++ < 80) {
    changed = false;
    for (var n = 0; n < S.nodes.length && !changed; n++) {
      if (S.nodes[n].anchor) continue;
      var inc = [];
      for (var i = 0; i < S.members.length; i++)
        if (S.members[i].a === n || S.members[i].b === n) inc.push(i);
      if (inc.length !== 2) continue;
      var m1 = S.members[inc[0]], m2 = S.members[inc[1]];
      var o1 = m1.a === n ? m1.b : m1.a, o2 = m2.a === n ? m2.b : m2.a;
      if (o1 === o2) continue;
      var A = S.nodes[o1], B = S.nodes[n], C = S.nodes[o2];
      var d1x = B.x - A.x, d1y = B.y - A.y, d2x = C.x - B.x, d2y = C.y - B.y;
      var l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
      if (!(l1 > 1e-9 && l2 > 1e-9)) continue;
      if (Math.abs(d1x * d2y - d1y * d2x) / (l1 * l2) > 1e-6) continue;  // not collinear
      if (d1x * d2x + d1y * d2y <= 0) continue;                          // doubles back
      if (l1 + l2 > MAXLEN + 1e-6) continue;                             // merged piece illegal
      if (hasMember(o1, o2) >= 0) continue;
      S.members.splice(Math.max(inc[0], inc[1]), 1);
      S.members.splice(Math.min(inc[0], inc[1]), 1);
      S.members.push({ a: o1, b: o2, broken: false });
      changed = true;
    }
    if (changed) cleanup();
  }
}

/* A roadway joint braced only by members in ONE straight line cannot resist a
   wheel pushing down on it. Unloaded it condenses away and looks fine, so this
   has to be flagged during the build or the test failure looks random. */
function unbracedDeckJoints() {
  var out = [], i, n;
  for (n = 0; n < S.nodes.length; n++) {
    if (S.nodes[n].anchor) continue;
    if (Math.abs(S.nodes[n].y - S.L.deckY) > 1e-6) continue;
    var dirs = [];
    for (i = 0; i < S.members.length; i++) {
      var m = S.members[i];
      if (m.broken || (m.a !== n && m.b !== n)) continue;
      var o = m.a === n ? m.b : m.a;
      var dx = S.nodes[o].x - S.nodes[n].x, dy = S.nodes[o].y - S.nodes[n].y;
      var L = Math.hypot(dx, dy) || 1;
      dirs.push([dx / L, dy / L]);
    }
    if (!dirs.length) continue;
    var spans = false;
    for (i = 1; i < dirs.length; i++)
      if (Math.abs(dirs[0][0] * dirs[i][1] - dirs[0][1] * dirs[i][0]) > 1e-6) { spans = true; break; }
    if (!spans) out.push(n);
  }
  return out;
}

/* drop joints that no longer hold anything (anchors always stay) */
function cleanup() {
  var used = {};
  S.members.forEach(function (m) { used[m.a] = 1; used[m.b] = 1; });
  for (var i = S.nodes.length - 1; i >= 0; i--) {
    if (S.nodes[i].anchor || used[i]) continue;
    S.nodes.splice(i, 1);
    S.members.forEach(function (m) { if (m.a > i) m.a--; if (m.b > i) m.b--; });
  }
}

/* --------------------------------------------------------------- UI wire */
function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }
document.querySelectorAll('.modal').forEach(function (m) {
  m.addEventListener('pointerdown', function (e) { if (e.target === m) m.classList.add('hidden'); });
});
['dbClose', 'lvClose', 'glClose', 'bdClose', 'tcClose', 'hpClose'].forEach(function (id) {
  $(id).addEventListener('click', function () { $(id).closest('.modal').classList.add('hidden'); });
});

document.querySelectorAll('.tool').forEach(function (b) {
  b.addEventListener('click', function () {
    document.querySelectorAll('.tool').forEach(function (x) { x.classList.remove('active'); });
    b.classList.add('active'); S.tool = b.dataset.tool; setToolHint();
    if (S.tool !== 'inspect') { S.sel = -1; $('fbd').classList.add('hidden'); }
    cv.style.cursor = S.tool === 'erase' ? 'not-allowed' : (S.tool === 'inspect' ? 'help' : 'crosshair');
  });
});
$('btnUndo').addEventListener('click', undo);
$('btnClear').addEventListener('click', function () {
  if (!S.members.length) return;
  pushUndo(); S.members = []; cleanup(); refresh();
});
$('btnTest').addEventListener('click', startTest);
function bindTgl(id, key, after) {
  var el = $(id);
  el.addEventListener('change', function () {
    S[key] = el.checked; el.closest('.tgl').classList.toggle('on', el.checked);
    savePrefs(); if (after) after(); refresh();
  });
}
bindTgl('tglXray', 'xray'); bindTgl('tglNums', 'nums'); bindTgl('tglWeight', 'selfWeight');
$('tglBig').addEventListener('change', function () {
  S.big = this.checked; document.body.classList.toggle('big', S.big); savePrefs();
  resize();
});
$('tglPar').addEventListener('change', function () { S.showPar = this.checked; savePrefs(); refresh(); });
$('tglKeyboard').addEventListener('change', function () {
  S.keyboard = this.checked;
  cv.tabIndex = S.keyboard ? 0 : -1;
  cv.setAttribute('role', S.keyboard ? 'application' : 'img');
  cv.setAttribute('aria-label', S.keyboard
    ? 'Bridge editing canvas. Arrow keys move the grid cursor; B starts or completes a member, E erases, and I inspects.'
    : 'Bridge design canvas. Use the pointer to build, or enable keyboard editing in Teacher mode.');
  if (!S.keyboard) S.kstart = null;
  savePrefs(); refresh();
});

function renderVehSel() {
  var allow = S.L.sandbox || S.overload;
  $('vehGroup').classList.toggle('hidden', !allow);
  var sel = $('vehSel');
  var span = S.L.gap.x1 - S.L.gap.x0, h = '';
  Object.keys(LV.VEHICLES).forEach(function (k) {
    var v = LV.VEHICLES[k];
    if (LV.vehicleBody(v) > span && k !== S.L.vehicle) return;   // longer than the bridge
    h += '<option value="' + k + '">' + v.name + ' — ' +
      (LV.vehicleWeight(v) / 1000).toFixed(0) + ' kN</option>';
  });
  sel.innerHTML = h;
  if (LV.vehicleBody(LV.VEHICLES[S.vehKey]) > span && S.vehKey !== S.L.vehicle) S.vehKey = S.L.vehicle;
  sel.value = S.vehKey;
}
$('vehSel').addEventListener('change', function () {
  S.vehKey = this.value; saveDesign(); refresh();
});
$('tglOverload').addEventListener('change', function () {
  S.overload = this.checked;
  if (!S.overload && !S.L.sandbox) S.vehKey = S.L.vehicle;
  savePrefs(); renderVehSel(); refresh();
});
$('btnLevels').addEventListener('click', function () { renderLevels(); show('mLevels'); });
$('btnGallery').addEventListener('click', function () { renderGallery(); show('mGallery'); });
$('btnBoard').addEventListener('click', function () { renderBoard(); show('mBoard'); });
$('btnTeacher').addEventListener('click', function () { show('mTeacher'); });
$('btnHelp').addEventListener('click', function () { show('mHelp'); });
$('dbRetry').addEventListener('click', backToBuild);
$('dbNext').addEventListener('click', function () { hide('mDebrief'); loadLevel(S.li + 1); });
$('dbSave').addEventListener('click', saveScore);

function backToBuild() {
  hide('mDebrief');
  S.phase = 'build'; S.test = null; S.coll = null; S.debris = [];
  S.members.forEach(function (m) { m.broken = false; });
  refresh();
}
function saveScore() {
  var d = S.lastDebrief;
  if (!d || !d.survived) return;
  S.name = ($('dbName').value || '').slice(0, 18).trim() || 'anon'; savePrefs();
  var board = ls(BOARD_K, {});
  var list = board[S.L.id] || [];
  list.push({ n: S.name, c: Math.round(d.cost), t: Date.now() });
  list.sort(function (a, b) { return a.c - b.c; });
  board[S.L.id] = list.slice(0, 30);
  ss(BOARD_K, board);
  renderBoard(); hide('mDebrief'); show('mBoard');
}

document.addEventListener('keydown', function (e) {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === '1') document.querySelector('[data-tool=build]').click();
  if (e.key === '2') document.querySelector('[data-tool=erase]').click();
  if (e.key === '3') document.querySelector('[data-tool=inspect]').click();
  if (e.key === 'x' || e.key === 'X') { $('tglXray').checked = !$('tglXray').checked; $('tglXray').dispatchEvent(new Event('change')); }
  if (e.key === 'f' || e.key === 'F') { $('tglNums').checked = !$('tglNums').checked; $('tglNums').dispatchEvent(new Event('change')); }
  if (e.key === ' ' && S.phase === 'build') { e.preventDefault(); if (!$('btnTest').disabled) startTest(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(function (m) { m.classList.add('hidden'); });
});

/* ------------------------------------------------------------- level list */
function renderLevelChip() {
  $('levelChip').innerHTML = 'Level ' + S.L.n + ' · <b>' + S.L.name + '</b>';
}
function renderLevels() {
  var prog = ls(PROG_K, {}), h = '';
  LV.LEVELS.forEach(function (L, i) {
    var best = prog[L.id];
    h += '<button type="button" class="card' + (best ? ' done' : '') + '" data-i="' + i + '" aria-label="Load level ' + L.n + ': ' + esc(L.name) + '. ' + esc(L.blurb) + '">' +
      '<h3>' + L.n + '. ' + L.name + '</h3><p>' + L.blurb + '</p>' +
      '<div class="meta"><span>' + (L.gap.x1 - L.gap.x0) + ' m · ' + LV.VEHICLES[L.vehicle].name + '</span>' +
      '<span>' + (L.par ? 'par ' + money(L.par) : 'sandbox') + '</span></div>' +
      (best ? '<div class="meta" style="color:#49c47a">✔ your best ' + money(best) + '</div>' : '') +
      '</button>';
  });
  $('lvGrid').innerHTML = h;
  $('lvGrid').querySelectorAll('.card').forEach(function (c) {
    c.addEventListener('click', function () { hide('mLevels'); loadLevel(+c.dataset.i); });
  });
}

/* --------------------------------------------------------------- gallery */
function galleryParams() {
  return { h: +$('glH').value * 0.5, n: +$('glN').value };
}
function renderGallery() {
  var p = galleryParams();
  $('glHv').textContent = p.h.toFixed(1) + ' m deep';
  $('glNv').textContent = p.n + ' panels';
  var x0 = S.L.gap.x0, x1 = S.L.gap.x1, h = '';
  LV.GALLERY.forEach(function (G, i) {
    var d = LV.snapDesign(G.build(x0, x1, p.h, p.n));
    var maxLen = 0;
    d.members.forEach(function (m) {
      maxLen = Math.max(maxLen, Math.hypot(d.nodes[m[0]].x - d.nodes[m[1]].x, d.nodes[m[0]].y - d.nodes[m[1]].y));
    });
    var cost = 0;
    d.members.forEach(function (m) {
      cost += P.memberCost(Math.hypot(d.nodes[m[0]].x - d.nodes[m[1]].x, d.nodes[m[0]].y - d.nodes[m[1]].y));
    });
    var bad = maxLen > MAXLEN + 1e-6 ? 'members up to ' + maxLen.toFixed(1) + ' m — too long, add panels'
            : (p.h > S.L.build.ymax ? 'too tall for this level' : null);
    h += '<button type="button" class="card' + (bad ? ' bad' : '') + '" data-i="' + i + '" aria-label="Load ' + esc(G.name) + ' truss"' + (bad ? ' data-bad="1" disabled' : '') + '>' +
      '<h3>' + G.name + ' <span class="sub">' + G.year + '</span></h3>' +
      svgOf(d) + '<p>' + G.note + '</p>' +
      '<div class="meta"><span>' + d.members.length + ' members</span><span>' +
      (bad ? '<span style="color:#ff8f8f">' + bad + '</span>' : money(cost)) + '</span></div></button>';
  });
  $('glGrid').innerHTML = h;
  $('glGrid').querySelectorAll('.card').forEach(function (c) {
    c.addEventListener('click', function () {
      if (c.dataset.bad) return;
      var pp = galleryParams();
      applyDesign(LV.snapDesign(LV.GALLERY[+c.dataset.i].build(S.L.gap.x0, S.L.gap.x1, pp.h, pp.n)));
      hide('mGallery');
    });
  });
}
function svgOf(d) {
  var xs = d.nodes.map(function (n) { return n.x; }), ys = d.nodes.map(function (n) { return n.y; });
  var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
  var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  var w = x1 - x0 || 1, hh = (y1 - y0) || 1, pad = 0.35;
  var s = '<svg viewBox="' + (x0 - pad) + ' ' + (-y1 - pad) + ' ' + (w + pad * 2) + ' ' + (hh + pad * 2) + '">';
  d.members.forEach(function (m) {
    var A = d.nodes[m[0]], B = d.nodes[m[1]];
    s += '<line x1="' + A.x + '" y1="' + (-A.y) + '" x2="' + B.x + '" y2="' + (-B.y) +
      '" stroke="#8fb6ff" stroke-width="' + (w / 90) + '" stroke-linecap="round"/>';
  });
  return s + '</svg>';
}
['glH', 'glN'].forEach(function (id) { $(id).addEventListener('input', renderGallery); });

/* ----------------------------------------------------------- leaderboard */
function renderBoard() {
  var board = ls(BOARD_K, {}), h = '';
  LV.LEVELS.forEach(function (L) {
    if (L.sandbox) return;
    var list = board[L.id] || [];
    h += '<h3 class="sec">' + L.n + '. ' + L.name + ' — par ' + money(L.par) + '</h3>';
    if (!list.length) { h += '<p class="sub">No surviving bridges yet.</p>'; return; }
    h += '<table class="data"><tr><th>#</th><th>who</th><th class="num">cost</th><th class="num">vs par</th></tr>';
    list.slice(0, 10).forEach(function (e, i) {
      var v = e.c - L.par;
      h += '<tr><td>' + (i + 1) + '</td><td>' + esc(e.n) + '</td><td class="num">' + money(e.c) + '</td>' +
        '<td class="num" style="color:' + (v <= 0 ? '#49c47a' : '#ff8f8f') + '">' +
        (v <= 0 ? '−' : '+') + money(Math.abs(v)) + '</td></tr>';
    });
    h += '</table>';
  });
  $('bdBody').innerHTML = h;
}
function esc(s) { return String(s).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }); }
function armReset(btn, label, act) {
  var armed = false, timer = null;
  btn.addEventListener('click', function () {
    if (!armed) {
      armed = true; btn.textContent = 'Tap again to confirm'; btn.classList.add('active');
      timer = setTimeout(function () { armed = false; btn.textContent = label; btn.classList.remove('active'); }, 4000);
      return;
    }
    clearTimeout(timer); armed = false; btn.textContent = label; btn.classList.remove('active');
    act(); renderBoard(); renderLevels();
    setStatus('Leaderboard cleared.', '');
  });
}
armReset($('btnResetLevel'), "Reset this level's board", function () {
  var b = ls(BOARD_K, {}); delete b[S.L.id]; ss(BOARD_K, b);
  var p = ls(PROG_K, {}); delete p[S.L.id]; ss(PROG_K, p);
});
armReset($('btnResetAll'), 'Reset every board', function () { ss(BOARD_K, {}); ss(PROG_K, {}); });

/* ------------------------------------------------------------- main loop */
var last = 0;
function frame(t) {
  var dt = Math.min(0.033, (t - last) / 1000 || 0.016); last = t;
  /* Any route out of the debrief returns to the build phase. Closing it with
     the ✕, clicking the backdrop or pressing Escape used to leave the game in
     'done' with a dead canvas — you could not draw again without clearing. */
  if (S.phase === 'done' && $('mDebrief').classList.contains('hidden')) backToBuild();
  if (S.phase === 'test' && !S.coll) stepTest(dt);
  else if (S.coll && !S.coll.done) stepCollapse(dt);
  stepDebris(dt);
  draw(t);
  requestAnimationFrame(frame);
}

/* ----------------------------------------------------------------- start */
(function init() {
  var pref = ls(PREF_K, {});
  S.big = !!pref.big; S.showPar = pref.showPar !== false;
  S.xray = pref.xray !== false; S.nums = !!pref.nums; S.selfWeight = !!pref.selfWeight;
  S.name = pref.name || ''; S.overload = !!pref.overload; S.keyboard = !!pref.keyboard;
  $('tglOverload').checked = S.overload;
  document.body.classList.toggle('big', S.big);
  $('tglBig').checked = S.big; $('tglPar').checked = S.showPar; $('tglKeyboard').checked = S.keyboard;
  cv.tabIndex = S.keyboard ? 0 : -1;
  cv.setAttribute('role', S.keyboard ? 'application' : 'img');
  cv.setAttribute('aria-label', S.keyboard
    ? 'Bridge editing canvas. Arrow keys move the grid cursor; B starts or completes a member, E erases, and I inspects.'
    : 'Bridge design canvas. Use the pointer to build, or enable keyboard editing in Teacher mode.');
  $('tglXray').checked = S.xray; $('tglNums').checked = S.nums; $('tglWeight').checked = S.selfWeight;
  [['tglXray', S.xray], ['tglNums', S.nums], ['tglWeight', S.selfWeight]].forEach(function (p) {
    $(p[0]).closest('.tgl').classList.toggle('on', p[1]);
  });
  resize();
  loadLevel(Math.min(pref.li || 0, LV.LEVELS.length - 1));
  if (!pref.seenHelp) { show('mHelp'); pref.seenHelp = 1; ss(PREF_K, Object.assign(pref, { seenHelp: 1 })); }
  requestAnimationFrame(frame);
})();

S.view = V;
window.BWGAME = S;   // exposed for the automated UI smoke test
})();
