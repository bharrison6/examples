/* Bridge Works — physics playtest harness.
   Runs against the SHIPPED solver and level definitions (physics.js / levels.js
   are the same files the browser loads).

     node test-physics.js
*/
'use strict';
const P = require('./physics.js');
const LV = require('./levels.js');

let failures = 0, checks = 0;
function check(name, cond, detail) {
  checks++;
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   [' + detail + ']' : ''));
  if (!cond) failures++;
}
const kN = (v) => (v / 1000).toFixed(2);
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1 : tol);

/* ---------------------------------------------------------------- helpers */
function build(design, anchors) {
  const nodes = design.nodes.map((p) => ({ x: p.x, y: p.y, fixX: 0, fixY: 0 }));
  for (const a of anchors) {
    let hit = -1;
    nodes.forEach((n, i) => { if (Math.hypot(n.x - a.x, n.y - a.y) < 1e-6) hit = i; });
    const fx = a.type === 'roller' ? 0 : 1;
    if (hit >= 0) { nodes[hit].fixX = fx; nodes[hit].fixY = 1; }
    else nodes.push({ x: a.x, y: a.y, fixX: fx, fixY: 1 });
  }
  return { nodes, members: design.members.map((m) => ({ a: m[0], b: m[1], broken: false })) };
}
/* same rule the game uses: steel by the metre + a charge per fabricated joint
   (abutment bearings are provided by the level, so they are free) */
function cost(m) {
  let steel = 0;
  for (const e of m.members) {
    const a = m.nodes[e.a], b = m.nodes[e.b];
    steel += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return P.designCost(steel, m.nodes.filter((n) => !n.fixY).length);
}
function longest(m) {
  let L = 0;
  for (const e of m.members) {
    const a = m.nodes[e.a], b = m.nodes[e.b];
    L = Math.max(L, Math.hypot(b.x - a.x, b.y - a.y));
  }
  return L;
}
function fitsLevel(level, m) {
  if (longest(m) > LV.MAX_MEMBER_LEN + 1e-6) return false;
  for (const n of m.nodes) {
    if (n.fixY) continue;
    if (n.y < level.build.ymin - 1e-6 || n.y > level.build.ymax + 1e-6) return false;
    if (n.x < level.build.xmin - 1e-6 || n.x > level.build.xmax + 1e-6) return false;
  }
  return true;
}
function cross(level, m, vehKey, selfWeight) {
  return P.crossTest(m, {
    deckY: level.deckY, x0: level.gap.x0, x1: level.gap.x1,
    vehicle: LV.VEHICLES[vehKey || level.vehicle],
    selfWeight: !!selfWeight, step: 0.2
  });
}
/* king/queen post family — the shape the tutorial hints at */
function kingpost(x0, x1, h, n) {
  const p = (x1 - x0) / n, nodes = [], members = [], bot = [], top = [];
  for (let i = 0; i <= n; i++) { bot.push(nodes.length); nodes.push({ x: x0 + i * p, y: 0 }); }
  for (let i = 0; i < n; i++) members.push([bot[i], bot[i + 1]]);
  for (let i = 1; i <= n - 1; i++) { top.push(nodes.length); nodes.push({ x: x0 + i * p, y: h }); }
  for (let i = 0; i < top.length; i++) members.push([top[i], bot[i + 1]]);
  for (let i = 0; i < top.length - 1; i++) members.push([top[i], top[i + 1]]);
  members.push([bot[0], top[0]]);
  members.push([bot[n], top[top.length - 1]]);
  return { nodes, members };
}
const flip = (d) => { d.nodes.forEach((n) => (n.y = -n.y)); return d; };
const FAMILIES = {
  warren: (a, b, h, n) => LV.warren(a, b, h, n),
  pratt: (a, b, h, n) => LV.pratt(a, b, h, n, false),
  howe: (a, b, h, n) => LV.pratt(a, b, h, n, true),
  bowstring: (a, b, h, n) => LV.bowstring(a, b, h, n),
  kingpost: kingpost,
  'warren-under': (a, b, h, n) => flip(LV.warren(a, b, h, n)),
  'pratt-under': (a, b, h, n) => flip(LV.pratt(a, b, h, n, false)),
  'kingpost-under': (a, b, h, n) => flip(kingpost(a, b, h, n))
};

/* ================ 1. the stiffness solve against hand statics ============ */
console.log('\n[1] Direct stiffness solve vs. hand calculation');
{
  /* 4 m span, pin + roller, 10 kN down at a 2 m high apex.
     By statics: reactions 5 kN each; diagonals 5/sin45 = 7.071 kN compression;
     bottom chord 7.071*cos45 = 5 kN tension. */
  const m = build({ nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 2 }],
                    members: [[0, 1], [0, 2], [1, 2]] },
                  [{ x: 0, y: 0, type: 'pin' }, { x: 4, y: 0, type: 'roller' }]);
  const F = new Float64Array(6); F[5] = -10e3;
  const r = P.analyse({ nodes: m.nodes, members: m.members, loads: F });
  check('solves (not a mechanism)', !r.mechanism);
  check('bottom chord = +5.00 kN tension', near(r.force[0], 5e3, 1), kN(r.force[0]) + ' kN');
  check('left diagonal = −7.07 kN compression', near(r.force[1], -7071, 1), kN(r.force[1]) + ' kN');
  check('right diagonal = −7.07 kN compression', near(r.force[2], -7071, 1), kN(r.force[2]) + ' kN');
  const Rv = r.reactions.reduce((s, x) => s + x.fy, 0);
  check('vertical reactions carry the whole 10 kN', near(Rv, 10e3, 1), kN(Rv) + ' kN');
  const Rh = r.reactions.reduce((s, x) => s + x.fx, 0);
  check('horizontal reactions sum to zero', near(Rh, 0, 1), kN(Rh) + ' kN');
}

/* ================ 2. statically indeterminate structures =================== */
console.log('\n[2] Statically indeterminate structures (why not method of joints)');
{
  /* same triangle but BOTH ends pinned: 1 degree indeterminate. The bottom
     chord now joins two immovable points, so it cannot strain and must carry
     nothing — the abutments take the thrust instead. Method of joints cannot
     get this; a stiffness solve can. */
  const m = build({ nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 2 }],
                    members: [[0, 1], [0, 2], [1, 2]] },
                  [{ x: 0, y: 0, type: 'pin' }, { x: 4, y: 0, type: 'pin' }]);
  const F = new Float64Array(6); F[5] = -10e3;
  const r = P.analyse({ nodes: m.nodes, members: m.members, loads: F });
  check('indeterminate frame still solves', !r.mechanism);
  check('chord between two pins carries ~0', Math.abs(r.force[0]) < 1, kN(r.force[0]) + ' kN');
  check('diagonals still take the load', near(r.force[1], -7071, 1), kN(r.force[1]) + ' kN');

  /* piling on redundant members must not break the solve */
  const d = LV.snapDesign(LV.warren(2, 14, 2, 6));
  d.members.push([0, 2], [2, 4], [1, 3]);            // arbitrary extra ties
  const m2 = build(d, LV.LEVELS[1].anchors);
  const r2 = P.analyse({ nodes: m2.nodes, members: m2.members,
                         loads: P.wheelLoads(m2.nodes, m2.members, null, 0, LV.VEHICLES.car, 8).loads });
  check('over-braced truss (3 redundant members) solves', !r2.mechanism,
        'rank ' + r2.rank + '/' + r2.nfree);
}

/* ================ 3. REQUIREMENT 1 — rectangle vs. braced rectangle ======= */
console.log('\n[3] REQUIREMENT: a bare rectangle is a mechanism, one diagonal fixes it');
{
  const nodes = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }, { x: 4, y: 3 }];
  const rect = [[0, 1], [0, 2], [1, 3], [2, 3]];
  const anchors = [{ x: 0, y: 0, type: 'pin' }, { x: 4, y: 0, type: 'pin' }];
  const F = new Float64Array(8); F[4] = 5e3;          // sideways shove at a top corner

  const bare = build({ nodes, members: rect }, anchors);
  const rb = P.analyse({ nodes: bare.nodes, members: bare.members, loads: F });
  check('bare rectangle IS a mechanism', rb.mechanism, rb.reason);
  check('  detected as rank deficiency, not a crash', rb.rank < rb.nfree,
        'rank ' + rb.rank + ' of ' + rb.nfree + ' free DOF');
  check('  a collapse direction is returned for the animation', !!rb.mode);

  const braced = build({ nodes, members: rect.concat([[0, 3]]) }, anchors);
  const rr = P.analyse({ nodes: braced.nodes, members: braced.members, loads: F });
  check('rectangle + ONE diagonal is rigid', !rr.mechanism,
        'rank ' + rr.rank + '/' + rr.nfree);
  check('  and the diagonal is the member that carries it',
        Math.abs(rr.force[4]) > 1e3, kN(rr.force[4]) + ' kN');

  /* the same thing at bridge scale: level 2 ships an un-triangulated ladder */
  const L2 = LV.LEVELS[1];
  const lad = build(LV.ladderStarter(L2), L2.anchors);
  const rl = cross(L2, lad);
  check('level 2 starter ladder fails the crossing', !rl.survived, rl.reason);
  check('  ...as a mechanism, before any member is overloaded',
        rl.mechanismAt !== null && rl.broke.length === 0);
  /* add a diagonal to every panel and the same frame survives */
  const d = LV.ladderStarter(L2);
  const n = (d.nodes.length - 2) / 2;                 // panel points per chord
  for (let i = 0; i < n; i++) d.members.push([i, n + 1 + i + 1]);
  const rd = cross(L2, build(d, L2.anchors));
  check('same ladder + one diagonal per panel SURVIVES', rd.survived,
        'peak use ' + Math.round(Math.max(...rd.maxUtil) * 100) + '%');
}

/* ================ 4. REQUIREMENT 2 — the Warren pattern ================== */
console.log('\n[4] REQUIREMENT: a Warren truss alternates tension and compression');
{
  const L2 = LV.LEVELS[1];
  const d = LV.snapDesign(LV.warren(2, 14, 2, 6));
  const m = build(d, L2.anchors);
  const F = new Float64Array(m.nodes.length * 2);
  let mid = -1;
  m.nodes.forEach((n, i) => { if (near(n.x, 8, 1e-9) && near(n.y, 0, 1e-9)) mid = i; });
  F[2 * mid + 1] = -40e3;
  const r = P.analyse({ nodes: m.nodes, members: m.members, loads: F });
  check('Warren truss solves', !r.mechanism);

  const diag = [], bot = [], top = [];
  m.members.forEach((e, i) => {
    const A = m.nodes[e.a], B = m.nodes[e.b];
    if (Math.abs(A.y - B.y) > 1e-9) diag.push({ i, x: (A.x + B.x) / 2, f: r.force[i] });
    else if (Math.abs(A.y) < 1e-9) bot.push(r.force[i]);
    else top.push(r.force[i]);
  });
  diag.sort((a, b) => a.x - b.x);
  const signs = diag.map((d2) => (d2.f > 0 ? 'T' : 'C'));
  /* A Warren mirrors about mid-span, so there is exactly ONE place where two
     neighbours share a sign — right at the centre — and every other adjacent
     pair must flip. */
  const repeats = [];
  for (let k = 1; k < signs.length; k++) if (signs[k] === signs[k - 1]) repeats.push(k);
  check('diagonals alternate T / C the whole way along',
        repeats.length === 1, signs.join(''));
  check('  with the single repeat exactly at mid-span (the mirror line)',
        repeats.length === 1 && Math.abs((diag[repeats[0]].x + diag[repeats[0] - 1].x) / 2 - 8) < 1e-6,
        repeats.length === 1 ? 'between x=' + diag[repeats[0] - 1].x + ' and x=' + diag[repeats[0]].x : '');
  check('  and the two halves mirror each other',
        signs.slice(0, signs.length / 2).join('') ===
        signs.slice(signs.length / 2).reverse().join(''));
  check('  all diagonals carry the same magnitude (equilateral Warren)',
        Math.max(...diag.map((d2) => Math.abs(d2.f))) - Math.min(...diag.map((d2) => Math.abs(d2.f))) < 1,
        kN(diag[0].f) + ' kN each');
  check('bottom chord is entirely TENSION', bot.every((f) => f > 0),
        bot.map(kN).join(' '));
  check('top chord is entirely COMPRESSION', top.every((f) => f < 0),
        top.map(kN).join(' '));
  check('chord force grows from the supports to mid-span',
        near(Math.max(...bot), bot[bot.length / 2], 1) && bot[0] < bot[1] && bot[1] < bot[2],
        bot.map(kN).join(' → ') + ' kN');

  /* Pratt vs Howe: the diagonals swap sign, which is the whole difference */
  const pr = build(LV.snapDesign(LV.pratt(2, 14, 2, 6, false)), L2.anchors);
  const ho = build(LV.snapDesign(LV.pratt(2, 14, 2, 6, true)), L2.anchors);
  function interiorDiagonalSigns(mm) {
    const F2 = new Float64Array(mm.nodes.length * 2);
    let mi = -1;
    mm.nodes.forEach((n, i) => { if (near(n.x, 8, 1e-9) && near(n.y, 0, 1e-9)) mi = i; });
    F2[2 * mi + 1] = -40e3;
    const rr = P.analyse({ nodes: mm.nodes, members: mm.members, loads: F2 });
    const out = [];
    mm.members.forEach((e, i) => {
      const A = mm.nodes[e.a], B = mm.nodes[e.b];
      if (Math.abs(A.y - B.y) < 1e-9) return;             // chord
      if (Math.abs(A.x - B.x) < 1e-9) return;             // vertical
      if (Math.min(A.x, B.x) < 2 + 1e-9 || Math.max(A.x, B.x) > 14 - 1e-9) return;  // end post
      if (Math.abs(rr.force[i]) < 100) return;
      out.push(Math.sign(rr.force[i]));
    });
    return out;
  }
  const ps = interiorDiagonalSigns(pr), hs = interiorDiagonalSigns(ho);
  check('Pratt interior diagonals are in TENSION', ps.length > 0 && ps.every((s) => s > 0),
        ps.join(','));
  check('Howe interior diagonals are in COMPRESSION', hs.length > 0 && hs.every((s) => s < 0),
        hs.join(','));
}

/* ================ 5. compression is the weak direction =================== */
console.log('\n[5] Buckling: compression members fail below tension members');
{
  check('tension capacity is length-independent', P.capT() === 300e3, kN(P.capT()) + ' kN');
  let monotonic = true, alwaysWeaker = true;
  for (let L = 0.5; L <= 6; L += 0.25) {
    if (P.capC(L) > P.capT()) alwaysWeaker = false;
    if (L > 0.5 && P.capC(L) > P.capC(L - 0.25) + 1e-6) monotonic = false;
  }
  check('compression capacity < tension capacity at EVERY length', alwaysWeaker);
  check('compression capacity never increases with length', monotonic);
  check('  2 m strut: ' + kN(P.capC(2)) + ' kN, 4 m strut: ' + kN(P.capC(4)) + ' kN',
        near(P.capC(2) / P.capC(4), 4, 0.02), 'ratio ' + (P.capC(2) / P.capC(4)).toFixed(2) + ' (Euler predicts 4)');

  /* the same truss flipped: propping the deck from above puts the long members
     in compression, hanging it from below puts them in tension */
  const L1 = LV.LEVELS[0];
  const over = build(LV.snapDesign(kingpost(5, 11, 1, 2)), L1.anchors);
  const under = build(LV.snapDesign(flip(kingpost(5, 11, 1, 2))), L1.anchors);
  const ro = cross(L1, over), ru = cross(L1, under);
  check('identical geometry, same cost', near(cost(over), cost(under), 0.01),
        '$' + cost(over).toFixed(0));
  check('hanging the deck is safer than propping it',
        Math.max(...ru.maxUtil) < Math.max(...ro.maxUtil),
        'propped peaks at ' + Math.round(Math.max(...ro.maxUtil) * 100) +
        '%, hung at ' + Math.round(Math.max(...ru.maxUtil) * 100) + '%');
}

/* ================ 6. REQUIREMENT 3 — progressive collapse ================ */
console.log('\n[6] REQUIREMENT: overload produces a progressive collapse');
{
  const L1 = LV.LEVELS[0];
  const kp = build(LV.snapDesign(kingpost(5, 11, 1, 2)), L1.anchors);
  const light = cross(L1, kp, 'car');
  check('tutorial bridge carries the car it was designed for', light.survived,
        'peak use ' + Math.round(Math.max(...light.maxUtil) * 100) + '%');
  const heavy = cross(L1, kp, 'tipper');
  check('the same bridge fails under a 12 t tipper', !heavy.survived);
  check('  a member breaks first, then the remains re-solve into a mechanism',
        heavy.broke.length >= 1 && heavy.mechanismAt !== null,
        heavy.broke.length + ' break(s), then mechanism at x=' + heavy.mechanismAt.toFixed(1));
  check('  the break is a buckling failure, not a tension one',
        heavy.broke[0].force < 0, kN(heavy.broke[0].force) + ' kN');
  /* This is the actual crossing helper at a phase offset that hits the
     ~102% tipper sample. The broken member must retain that sample in the
     reported maxima after solveWithBreaks removes it from the live mask. */
  const tippedSample = P.crossTest(kp, { deckY: L1.deckY, x0: 5, x1: 11,
    vehicle: LV.VEHICLES.tipper, step: 0.35 });
  const broken = tippedSample.broke[0];
  check('  debrief maxima retain the 102% tipper breaking sample',
        broken && broken.util >= 1.02 && broken.util < 1.03 &&
        tippedSample.maxUtil[broken.member] >= broken.util,
        broken ? Math.floor(broken.util * 100) + '% break retained in ' +
          Math.round(tippedSample.maxUtil[broken.member] * 100) + '% maximum' : 'no break');

  /* a REDUNDANT structure keeps standing after the first break, so overloading
     it produces a genuine chain: break -> re-solve -> break -> ... */
  function doubleWarren(x0, x1, h, n) {
    const a = LV.snapDesign(LV.warren(x0, x1, h, n));
    const b = flip(LV.snapDesign(LV.warren(x0, x1, h, n)));
    const nodes = a.nodes.slice(), members = a.members.slice(), map = [];
    b.nodes.forEach((p, i) => {
      let hit = -1;
      nodes.forEach((q, j) => { if (Math.hypot(q.x - p.x, q.y - p.y) < 1e-6) hit = j; });
      if (hit >= 0) map[i] = hit; else { map[i] = nodes.length; nodes.push(p); }
    });
    b.members.forEach((e) => {
      const A = map[e[0]], B = map[e[1]];
      if (!members.some((m) => (m[0] === A && m[1] === B) || (m[0] === B && m[1] === A)))
        members.push([A, B]);
    });
    return { nodes, members };
  }
  const L3 = LV.LEVELS[2];
  const dw = build(doubleWarren(3, 13, 0.5, 5), L3.anchors);
  const casc = cross(L3, dw, 'truck');
  check('redundant truss survives losing its first member and keeps going',
        casc.broke.length >= 2,
        casc.broke.map((b) => 'm' + b.member + (b.force > 0 ? ' tore' : ' buckled')).join(' → '));
  check('  each break is re-solved with the members that are left',
        casc.broke.length >= 2 && casc.broke[1].member !== casc.broke[0].member);
  check('  and the cascade ends in collapse', casc.mechanismAt !== null);
}

/* ================ 7. REQUIREMENT 4 — pars beatable, triangulation only === */
console.log('\n[7] REQUIREMENT: par is beatable, but only with a triangulated design');
{
  for (const level of LV.LEVELS) {
    if (level.sandbox) continue;
    const spans = level.anchors.length > 2
      ? [[level.anchors[0].x, level.anchors[1].x], [level.anchors[1].x, level.anchors[2].x]]
      : [[level.gap.x0, level.gap.x1]];
    let best = null;
    for (const fname of Object.keys(FAMILIES)) {
      for (let n = 2; n <= 12; n++) {
        for (let h = 0.5; h <= 6.01; h += 0.5) {
          const design = { nodes: [], members: [] };
          for (const [sx0, sx1] of spans) {
            const d = LV.snapDesign(FAMILIES[fname](sx0, sx1, h, n));
            const map = [];
            d.nodes.forEach((p, i) => {
              let hit = -1;
              design.nodes.forEach((q, j) => { if (Math.hypot(q.x - p.x, q.y - p.y) < 1e-6) hit = j; });
              if (hit >= 0) map[i] = hit;
              else { map[i] = design.nodes.length; design.nodes.push(p); }
            });
            d.members.forEach((e) => design.members.push([map[e[0]], map[e[1]]]));
          }
          const m = build(design, level.anchors);
          if (!fitsLevel(level, m)) continue;
          const c = cost(m);
          if (best && c >= best.c) continue;
          if (!cross(level, m).survived) continue;
          best = { c, fname, n, h: +h.toFixed(1) };
        }
      }
    }
    check('L' + level.n + ' ' + level.name + ': par $' + level.par + ' is beatable',
          best && best.c <= level.par,
          best ? 'best surviving design $' + Math.round(best.c) + ' — ' + best.fname +
                 ', ' + best.n + ' panels, ' + best.h + ' m deep' : 'NOTHING SURVIVED');
    check('  ...but not trivially (best is within 25% of par)',
          best && best.c > level.par * 0.75,
          best ? Math.round((best.c / level.par) * 100) + '% of par' : '');

    /* no un-triangulated ladder survives this level at ANY depth or panel count */
    let ladderSurvived = null;
    for (let n = 2; n <= 8; n++) {
      for (let h = 0.5; h <= 5.01; h += 0.5) {
        const p = (level.gap.x1 - level.gap.x0) / n;
        const nodes = [], members = [], bot = [], top = [];
        for (let i = 0; i <= n; i++) { bot.push(nodes.length); nodes.push({ x: level.gap.x0 + i * p, y: 0 }); }
        for (let i = 0; i <= n; i++) { top.push(nodes.length); nodes.push({ x: level.gap.x0 + i * p, y: h }); }
        for (let i = 0; i < n; i++) { members.push([bot[i], bot[i + 1]]); members.push([top[i], top[i + 1]]); }
        for (let i = 0; i <= n; i++) members.push([bot[i], top[i]]);
        const m = build(LV.snapDesign({ nodes, members }), level.anchors);
        if (!fitsLevel(level, m)) continue;
        if (cross(level, m).survived) ladderSurvived = n + ' panels, ' + h + ' m';
      }
    }
    check('  ...and no un-triangulated ladder survives it at any size',
          ladderSurvived === null, ladderSurvived || 'checked 80 ladder variants');
  }
}

/* ================ 8. numerical robustness ================================= */
console.log('\n[8] Robustness — the things students will actually do');
{
  const anchors = [{ x: 0, y: 0, type: 'pin' }, { x: 4, y: 0, type: 'roller' }];
  /* a joint dropped in the middle of a straight strut must NOT read as a mechanism */
  const split = build({ nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 2 }, { x: 1, y: 0 }],
                        members: [[0, 3], [3, 1], [0, 2], [1, 2]] }, anchors);
  const F = new Float64Array(8); F[5] = -10e3;
  const rs = P.analyse({ nodes: split.nodes, members: split.members, loads: F });
  check('splitting a chord with a spare joint is not a mechanism', !rs.mechanism);
  check('  both halves carry the same axial force',
        near(rs.force[0], rs.force[1], 1) && near(rs.force[0], 5e3, 1), kN(rs.force[0]) + ' kN');
  check('  buckling length is the WHOLE strut, not the half',
        near(rs.buckLen[0], 4, 1e-6), rs.buckLen[0].toFixed(2) + ' m');

  /* a loose end sticking off the side is a zero-force member, not a crash */
  const stub = build({ nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 2 }, { x: 3, y: 3 }],
                       members: [[0, 1], [0, 2], [1, 2], [2, 3]] }, anchors);
  const rt = P.analyse({ nodes: stub.nodes, members: stub.members, loads: F });
  check('a dangling member is pruned as zero-force, not treated as collapse', !rt.mechanism);
  check('  and reported as carrying nothing', rt.zeroForce[3] === 1);

  /* nothing built at all */
  const none = P.analyse({ nodes: [{ x: 0, y: 0, fixX: 1, fixY: 1 }], members: [], loads: new Float64Array(2) });
  check('an empty level does not throw', none.mechanism && none.empty);

  /* deck continuity */
  const L1 = LV.LEVELS[0];
  const gap = build({ nodes: [{ x: 5, y: 0 }, { x: 8, y: 0 }, { x: 11, y: 0 }, { x: 8, y: 1 }],
                      members: [[0, 1], [0, 3], [3, 1], [3, 2]] }, L1.anchors);
  const rg = cross(L1, gap);
  check('a roadway with a hole in it is refused', !rg.survived && rg.noDeck, rg.reason);
}

/* ================ 9. self weight ========================================= */
console.log('\n[9] Optional self weight');
{
  const L2 = LV.LEVELS[1];
  const m = build(LV.snapDesign(LV.warren(2, 14, 2, 6)), L2.anchors);
  const dry = cross(L2, m, null, false), wet = cross(L2, m, null, true);
  check('both solve', dry.survived && wet.survived);
  check('self weight raises the peak member force',
        Math.max(...wet.maxUtil) > Math.max(...dry.maxUtil),
        Math.round(Math.max(...dry.maxUtil) * 100) + '% → ' + Math.round(Math.max(...wet.maxUtil) * 100) + '%');
  check('  and it sags further', wet.peakDefl > dry.peakDefl,
        (dry.peakDefl * 1000).toFixed(1) + ' mm → ' + (wet.peakDefl * 1000).toFixed(1) + ' mm');
  const empty = P.analyse({ nodes: m.nodes, members: m.members, selfWeight: true,
                            loads: new Float64Array(m.nodes.length * 2) });
  const R = empty.reactions.reduce((s, x) => s + x.fy, 0);
  let W = 0;
  for (const e of m.members) {
    const a = m.nodes[e.a], b = m.nodes[e.b];
    W += P.MAT.selfWeightPerMetre * Math.hypot(b.x - a.x, b.y - a.y);
  }
  check('reactions carry exactly the structure\'s own weight', near(R, W, 5),
        kN(R) + ' kN vs ' + kN(W) + ' kN of steel');
  const hanging = P.analyse({
    nodes: [{ x: 0, y: 0, fixX: 1, fixY: 1 }, { x: 0, y: -1, fixX: 0, fixY: 0 }],
    members: [{ a: 0, b: 1 }], selfWeight: true, loads: new Float64Array(4)
  });
  check('a 1 m self-loaded dangling member keeps its 900 N load',
        near(hanging.selfWeightTotal, 900, 1e-9) && hanging.zeroForce[0] === 0,
        hanging.selfWeightTotal.toFixed(0) + ' N; ' + (hanging.mechanism ? 'unsupported lateral DOF reported' : 'solved'));
}

/* ================ 10. the moving load ==================================== */
console.log('\n[10] Moving load solved at every position');
{
  const L2 = LV.LEVELS[1];
  const m = build(LV.snapDesign(LV.warren(2, 14, 2, 6)), L2.anchors);
  const v = LV.VEHICLES.car;
  const wb = LV.vehicleLength(v);
  let maxAt = -1, maxF = 0, sampled = 0, conserved = true, worstErr = 0, everMech = false;
  for (let x = 2; x <= 14 + wb; x += 0.2) {
    const wl = P.wheelLoads(m.nodes, m.members, null, 0, v, x);
    if (x > 2 + wb && x < 14) {                   // both axles fully on the deck
      let sum = 0;
      for (let i = 1; i < wl.loads.length; i += 2) sum += wl.loads[i];
      sampled++;
      worstErr = Math.max(worstErr, Math.abs(-sum - LV.vehicleWeight(v)));
      if (!near(-sum, LV.vehicleWeight(v), 1)) conserved = false;
    }
    const r = P.analyse({ nodes: m.nodes, members: m.members, loads: wl.loads });
    if (r.mechanism) everMech = true;
    const peak = Math.max(...Array.from(r.force).map(Math.abs));
    if (peak > maxF) { maxF = peak; maxAt = x; }
  }
  check('every wheel load is fully transferred to the deck joints', conserved,
        sampled + ' positions, worst error ' + worstErr.toFixed(6) + ' N');
  check('the truss stays solvable at every position of the crossing', !everMech);
  check('the worst case happens with the vehicle out over the span',
        maxAt > 2 + wb && maxAt < 14,
        'peak ' + kN(maxF) + ' kN with the front axle at x=' + maxAt.toFixed(1) + ' m');
}


/* ================ 10b. the cost model ==================================== */
console.log('\n[10b] Cost model — steel by weight, plus every connection');
{
  check('steel is priced from its mass', near(P.MAT.costPerMetre,
        P.MAT.A * P.MAT.density * P.MAT.costPerKg, 1e-9),
        P.MAT.massPerMetre.toFixed(2) + ' kg/m x $' + P.MAT.costPerKg + '/kg = $' +
        P.MAT.costPerMetre.toFixed(2) + '/m');
  check('a joint costs what a fabricated connection costs', P.MAT.costPerJoint === 180);
  check('a 10 m 4-joint design prices out correctly',
        near(P.designCost(10, 4), 10 * P.MAT.costPerMetre + 4 * 180, 1e-9),
        '$' + P.designCost(10, 4).toFixed(0));

  /* connections must be a real share of the bill, or panel count is free */
  const L2 = LV.LEVELS[1];
  const w6 = build(LV.snapDesign(LV.warren(2, 14, 2, 6)), L2.anchors);
  const w4 = build(LV.snapDesign(LV.warren(2, 14, 2, 4)), L2.anchors);
  let steel6 = 0;
  for (const e of w6.members) {
    const a = w6.nodes[e.a], b = w6.nodes[e.b];
    steel6 += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const jointShare = (w6.nodes.filter((n) => !n.fixY).length * 180) / cost(w6);
  check('connections are a meaningful fraction of the bill',
        jointShare > 0.25 && jointShare < 0.6, Math.round(jointShare * 100) + '% of cost');
  check('fewer panels is cheaper, so panel count is a real trade-off',
        cost(w4) < cost(w6), '4 panels $' + Math.round(cost(w4)) + ' vs 6 panels $' + Math.round(cost(w6)));
  check('  but bracing a panel adds steel only, never a new joint',
        (function () {
          const d = LV.ladderStarter(L2);
          const before = cost(build(d, L2.anchors));
          const nn = (d.nodes.length - 2) / 2;
          for (let i = 0; i < nn; i++) d.members.push([i, nn + 1 + i + 1]);
          const after = build(d, L2.anchors);
          return after.nodes.filter((n) => !n.fixY).length ===
                 build(LV.ladderStarter(L2), L2.anchors).nodes.filter((n) => !n.fixY).length &&
                 cost(after) > before;
        })());
}

/* ================ 11. the fold drawing must not stretch anything ========= */
console.log('\n[11] Fold visualisation is length-exact, not just first-order');
{
  const L2 = LV.LEVELS[1];
  const lad = build(LV.ladderStarter(L2), L2.anchors);
  const r = P.analyse({ nodes: lad.nodes, members: lad.members,
                        loads: new Float64Array(lad.nodes.length * 2) });
  check('the un-braced frame reports every independent fold', r.nullity === 4 && r.modes.length === 4,
        'nullity ' + r.nullity);

  /* the null space is exact to FIRST order... */
  let firstOrder = 0;
  for (const mode of r.modes)
    for (const e of lad.members) {
      const A = lad.nodes[e.a], B = lad.nodes[e.b];
      const L = Math.hypot(B.x - A.x, B.y - A.y);
      const ex = (B.x - A.x) / L, ey = (B.y - A.y) / L;
      firstOrder = Math.max(firstOrder, Math.abs(
        (mode[2 * e.b] - mode[2 * e.a]) * ex + (mode[2 * e.b + 1] - mode[2 * e.a + 1]) * ey) / L);
    }
  check('every mode has zero first-order axial strain', firstOrder < 1e-12,
        (firstOrder * 100).toExponential(1) + '%');

  /* ...but NOT to second order, which is why the raw mode cannot be drawn */
  let raw = 0;
  for (const mode of r.modes)
    for (const e of lad.members) {
      const A = lad.nodes[e.a], B = lad.nodes[e.b];
      const L = Math.hypot(B.x - A.x, B.y - A.y);
      const nx = (B.x + mode[2 * e.b]) - (A.x + mode[2 * e.a]);
      const ny = (B.y + mode[2 * e.b + 1]) - (A.y + mode[2 * e.a + 1]);
      raw = Math.max(raw, Math.abs(Math.hypot(nx, ny) - L) / L);
    }
  check('drawing the raw mode at 1 m WOULD stretch members', raw > 0.01,
        (raw * 100).toFixed(2) + '% — this is why it is projected first');

  /* the projected shape is what actually gets drawn */
  let worstErr = 0, minDisp = Infinity;
  for (const mode of r.modes) {
    const f = P.foldShape(lad.nodes, lad.members, null, mode, 1.4, 120);
    worstErr = Math.max(worstErr, f.err);
    minDisp = Math.min(minDisp, f.disp);
  }
  check('the projected shape holds every member to its exact length',
        worstErr < 1e-4, 'worst ' + (worstErr * 100).toFixed(4) + '%');
  check('  while still folding visibly', minDisp > 0.3, 'smallest fold ' + minDisp.toFixed(2) + ' m');

  /* supports must not be dragged along by the projection */
  const f0 = P.foldShape(lad.nodes, lad.members, null, r.modes[0], 1.4, 120);
  let pinMoved = 0, rollerY = 0;
  lad.nodes.forEach((n, i) => {
    if (n.fixX && n.fixY) pinMoved = Math.max(pinMoved, Math.hypot(f0.pts[i].x - n.x, f0.pts[i].y - n.y));
    if (!n.fixX && n.fixY) rollerY = Math.max(rollerY, Math.abs(f0.pts[i].y - n.y));
  });
  check('the pinned abutment does not move', pinMoved < 1e-9, pinMoved.toExponential(1) + ' m');
  check('the roller stays on its bearing (vertically fixed, free to slide)', rollerY < 1e-9,
        rollerY.toExponential(1) + ' m');

  /* a braced frame has nothing to draw */
  const d2 = LV.ladderStarter(L2);
  const n2 = (d2.nodes.length - 2) / 2;
  for (let i = 0; i < n2; i++) d2.members.push([i, n2 + 1 + i + 1]);
  const rb = P.analyse({ nodes: build(d2, L2.anchors).nodes, members: build(d2, L2.anchors).members,
                         loads: new Float64Array(build(d2, L2.anchors).nodes.length * 2) });
  check('bracing every panel leaves no fold at all', !rb.mechanism && rb.nullity === 0);
}

/* ------------------------------------------------------------------ done */
console.log('\n' + (failures ? '✖ ' + failures + ' of ' + checks + ' checks FAILED'
                             : '✔ all ' + checks + ' checks passed'));
process.exit(failures ? 1 : 0);
