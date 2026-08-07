/* Bridge Works — structural core.
 *
 * A real 2D pin-jointed truss solver using the DIRECT STIFFNESS METHOD:
 * every member is an axial (two-force) element, element stiffnesses are
 * rotated into global coordinates and assembled into K, supports are applied
 * as boundary conditions, and K u = F is solved for the nodal displacements.
 * Member forces follow from the displacements. Because this is a stiffness
 * solve and not a method-of-joints walk, statically INDETERMINATE structures
 * (extra members, two pinned abutments, a mid-span pier) solve correctly.
 *
 * Rank-deficient (under-constrained) structures are detected via full-pivot
 * Gaussian elimination and the null-space direction is returned so the game
 * can animate the actual collapse mode instead of crashing.
 *
 * No DOM. Loaded as a classic <script> in the browser (window.BW) and with
 * require() from test-physics.js in Node.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BW = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

/* ============================================================ material ==== */
/* One standard strut in one standard section, so the design problem stays
   about GEOMETRY rather than shopping for sections. */
var MAT = {
  E: 200e9,            // Pa      — structural steel
  A: 1.2e-3,           // m^2     — 12 cm^2 section
  I: 3.647e-7,         // m^4     — second moment of area (governs buckling)
  sigmaT: 250e6,       // Pa      — yield stress
  density: 7850,       // kg/m^3  — steel
  compYieldFactor: 0.6,// compression members are derated even when stubby
  selfWeightPerMetre: 900, // N/m — member PLUS its share of the deck it carries
  /* Costed the way a fabricator quotes: steel is bought by WEIGHT, and every
     connection is a gusset plate, a pile of bolts and a person to install it.
     Connections are why real trusses use as few panels as they can get away
     with — a lesson that a flat price-per-metre cannot teach. */
  costPerKg: 4.80,     // $/kg    — fabricated, delivered and erected
  costPerJoint: 180    // $/joint — gusset, bolts, fabrication, erection
};
MAT.massPerMetre = MAT.A * MAT.density;             // 9.42 kg per metre
MAT.costPerMetre = MAT.massPerMetre * MAT.costPerKg; // ~$45 per metre
MAT.capT = MAT.sigmaT * MAT.A;                    // 300 kN in tension
MAT.capCyield = MAT.compYieldFactor * MAT.capT;   // 180 kN ceiling in compression
MAT.eulerK = Math.PI * Math.PI * MAT.E * MAT.I;   // ~720 kN.m^2

/* Compression capacity: Euler buckling, capped by the squash load.
   P_cr = pi^2 E I / L^2 — so a 4 m strut carries a quarter of what a 2 m
   strut carries. This is the whole reason tension design is cheaper. */
function capC(L) {
  return Math.min(MAT.capCyield, MAT.eulerK / (L * L));
}
function capT() { return MAT.capT; }

var COLLAPSE_DISP = 0.50;   // m — deflection this large is a failure, not a deflection
var SERVICE_RATIO = 1 / 200; // span/200 deflection warning

function memberCost(len) { return len * MAT.costPerMetre; }
function jointCost(n) { return (n || 0) * MAT.costPerJoint; }
/* total build cost: steel by the metre plus every connection the student made.
   Abutment bearings come with the level, so they are not charged. */
function designCost(steelMetres, studentJoints) {
  return steelMetres * MAT.costPerMetre + (studentJoints || 0) * MAT.costPerJoint;
}

/* ================================================== linear algebra ======== */
/* Gaussian elimination with FULL pivoting on a dense system.
   Full pivoting (rather than partial) is what lets us report the rank
   honestly, which is how mechanisms are detected. Returns the particular
   solution plus a basis for the null space (= the collapse modes). */
function gaussFull(A, b, n) {
  var perm = new Int32Array(n), i, j, k;
  for (i = 0; i < n; i++) perm[i] = i;
  var scale = 0;
  for (i = 0; i < n * n; i++) { var v = Math.abs(A[i]); if (v > scale) scale = v; }
  if (!(scale > 0)) scale = 1;
  var tol = 1e-9 * scale;
  var bScale = 0;
  for (i = 0; i < n; i++) { var bv = Math.abs(b[i]); if (bv > bScale) bScale = bv; }

  var rank = 0;
  for (k = 0; k < n; k++) {
    var best = 0, bi = k, bj = k;
    for (i = k; i < n; i++) {
      var ro = i * n;
      for (j = k; j < n; j++) {
        var av = Math.abs(A[ro + j]);
        if (av > best) { best = av; bi = i; bj = j; }
      }
    }
    if (best <= tol) break;
    if (bi !== k) {
      for (j = 0; j < n; j++) { var t = A[k * n + j]; A[k * n + j] = A[bi * n + j]; A[bi * n + j] = t; }
      var tb = b[k]; b[k] = b[bi]; b[bi] = tb;
    }
    if (bj !== k) {
      for (i = 0; i < n; i++) { var t2 = A[i * n + k]; A[i * n + k] = A[i * n + bj]; A[i * n + bj] = t2; }
      var tp = perm[k]; perm[k] = perm[bj]; perm[bj] = tp;
    }
    var piv = A[k * n + k];
    for (i = k + 1; i < n; i++) {
      var f = A[i * n + k] / piv;
      if (f === 0) continue;
      A[i * n + k] = 0;
      for (j = k + 1; j < n; j++) A[i * n + j] -= f * A[k * n + j];
      b[i] -= f * b[k];
    }
    rank++;
  }

  /* rows below the rank must have (near) zero RHS or the load simply cannot
     be equilibrated — that is a collapsing mechanism, not a stiff structure */
  var inconsistent = false;
  var rtol = 1e-7 * (bScale > 0 ? bScale : 1);
  for (i = rank; i < n; i++) if (Math.abs(b[i]) > rtol) { inconsistent = true; break; }

  /* particular solution with all free variables set to zero */
  var y = new Float64Array(n);
  for (k = rank - 1; k >= 0; k--) {
    var s = b[k];
    for (j = k + 1; j < rank; j++) s -= A[k * n + j] * y[j];
    y[k] = s / A[k * n + k];
  }
  var x = new Float64Array(n);
  for (k = 0; k < n; k++) x[perm[k]] = y[k];

  /* null-space basis: one vector per free column */
  var nulls = [];
  for (var fc = rank; fc < n; fc++) {
    var z = new Float64Array(n);
    z[fc] = 1;
    for (k = rank - 1; k >= 0; k--) {
      var s2 = 0;
      for (j = k + 1; j < n; j++) s2 += A[k * n + j] * z[j];
      z[k] = -s2 / A[k * n + k];
    }
    var zz = new Float64Array(n);
    for (k = 0; k < n; k++) zz[perm[k]] = z[k];
    var norm = 0;
    for (k = 0; k < n; k++) norm += zz[k] * zz[k];
    norm = Math.sqrt(norm) || 1;
    for (k = 0; k < n; k++) zz[k] /= norm;
    nulls.push(zz);
  }
  return { x: x, rank: rank, nulls: nulls, inconsistent: inconsistent, singular: rank < n };
}

/* =========================================================== analysis ==== */
/*
 * model = {
 *   nodes:   [{x, y, fixX, fixY}]        // metres, y up
 *   members: [{a, b, broken}]            // indices into nodes
 *   live:    optional array/Uint8Array of 0|1 overriding .broken
 *   loads:   optional Float64Array(2N) of applied nodal forces, N, y up
 *   selfWeight: bool
 * }
 */
function analyse(model) {
  var nodes = model.nodes, mem = model.members;
  var N = nodes.length, M = mem.length, i, j, k, n;

  var live = new Uint8Array(M);
  for (i = 0; i < M; i++) live[i] = model.live ? (model.live[i] ? 1 : 0) : (mem[i].broken ? 0 : 1);

  var L = new Float64Array(M), ex = new Float64Array(M), ey = new Float64Array(M);
  for (i = 0; i < M; i++) {
    if (!live[i]) continue;
    var a = nodes[mem[i].a], b = nodes[mem[i].b];
    var dx = b.x - a.x, dy = b.y - a.y, l = Math.sqrt(dx * dx + dy * dy);
    if (!(l > 1e-9)) { live[i] = 0; continue; }
    L[i] = l; ex[i] = dx / l; ey[i] = dy / l;
  }

  var support = new Uint8Array(N);
  for (n = 0; n < N; n++) support[n] = (nodes[n].fixX || nodes[n].fixY) ? 1 : 0;

  /* ---- applied load vector ------------------------------------------------
     Self weight is added BEFORE the zero-force pass. A live member owns its
     weight even if it ends at a loose joint: a vertical hanger carries that
     load axially; a differently oriented loose member correctly exposes an
     unsupported/mechanism load path instead of disappearing as a "zero-force"
     stub. */
  var F = new Float64Array(2 * N);
  if (model.loads) for (i = 0; i < 2 * N; i++) F[i] = model.loads[i];
  var selfWeightTotal = 0;
  if (model.selfWeight) {
    for (i = 0; i < M; i++) {
      if (!live[i]) continue;
      var memberWeight = MAT.selfWeightPerMetre * L[i];
      selfWeightTotal += memberWeight;
      F[2 * mem[i].a + 1] -= memberWeight * 0.5;
      F[2 * mem[i].b + 1] -= memberWeight * 0.5;
    }
  }
  var applied = new Uint8Array(N);
  for (n = 0; n < N; n++)
    if (Math.abs(F[2 * n]) > 1e-9 || Math.abs(F[2 * n + 1]) > 1e-9) applied[n] = 1;

  /* ---- prune zero-force stubs -------------------------------------------
     A node with one member and nothing pushing on it can only ever carry
     zero force (classic zero-force member rule). Removing these recursively
     keeps half-built structures analysable instead of reporting every loose
     end as a mechanism — and the game draws them greyed out, which is the
     honest answer: they are doing nothing. */
  var pruned = new Uint8Array(N), stub = new Uint8Array(M);
  var deg = new Int32Array(N);
  function recount() {
    deg.fill(0);
    for (var q = 0; q < M; q++) if (live[q] && !stub[q]) { deg[mem[q].a]++; deg[mem[q].b]++; }
  }
  recount();
  var changed = true, guard = 0;
  while (changed && guard++ < N + 5) {
    changed = false;
    for (n = 0; n < N; n++) {
      if (pruned[n] || support[n] || applied[n]) continue;
      if (deg[n] <= 1) {
        pruned[n] = 1;
        for (var q = 0; q < M; q++)
          if (live[q] && !stub[q] && (mem[q].a === n || mem[q].b === n)) stub[q] = 1;
        changed = true;
      }
    }
    recount();
  }

  /* ---- collinear pass-through nodes --------------------------------------
     Dropping a node in the middle of a straight strut does not create a
     joint in any physical sense, but in a pin-jointed idealisation it makes
     K singular. Condense such chains into a single equivalent element
     (springs in series: EA/L_total is exact) and remember that the buckling
     length is the WHOLE chain, because an unbraced intermediate pin does not
     shorten the buckling length. */
  var inc = new Array(N);
  for (n = 0; n < N; n++) inc[n] = [];
  for (i = 0; i < M; i++) if (live[i] && !stub[i]) { inc[mem[i].a].push(i); inc[mem[i].b].push(i); }

  var pt = new Uint8Array(N);
  for (n = 0; n < N; n++) {
    if (pruned[n] || support[n] || applied[n]) continue;
    if (inc[n].length !== 2) continue;
    var m1 = inc[n][0], m2 = inc[n][1];
    var s1 = (mem[m1].a === n) ? 1 : -1, s2 = (mem[m2].a === n) ? 1 : -1;
    var d1x = ex[m1] * s1, d1y = ey[m1] * s1, d2x = ex[m2] * s2, d2y = ey[m2] * s2;
    var cross = d1x * d2y - d1y * d2x, dot = d1x * d2x + d1y * d2y;
    if (Math.abs(cross) < 1e-7 && dot < 0) pt[n] = 1;
  }

  var chainOf = new Int32Array(M).fill(-1);
  var chains = [];
  for (i = 0; i < M; i++) {
    if (!live[i] || stub[i] || chainOf[i] >= 0) continue;
    var seq = [mem[i].a, mem[i].b], mems = [i];
    chainOf[i] = chains.length;
    var g = 0;
    while (pt[seq[0]] && g++ < M + 2) {
      var nd = seq[0], cur = mems[0];
      var oth = (inc[nd][0] === cur) ? inc[nd][1] : inc[nd][0];
      if (oth === undefined || chainOf[oth] >= 0) break;
      chainOf[oth] = chains.length;
      mems.unshift(oth);
      seq.unshift(mem[oth].a === nd ? mem[oth].b : mem[oth].a);
    }
    g = 0;
    while (pt[seq[seq.length - 1]] && g++ < M + 2) {
      var nd2 = seq[seq.length - 1], cur2 = mems[mems.length - 1];
      var oth2 = (inc[nd2][0] === cur2) ? inc[nd2][1] : inc[nd2][0];
      if (oth2 === undefined || chainOf[oth2] >= 0) break;
      chainOf[oth2] = chains.length;
      mems.push(oth2);
      seq.push(mem[oth2].a === nd2 ? mem[oth2].b : mem[oth2].a);
    }
    var A0 = nodes[seq[0]], B0 = nodes[seq[seq.length - 1]];
    var clx = B0.x - A0.x, cly = B0.y - A0.y, cl = Math.sqrt(clx * clx + cly * cly);
    chains.push({ mems: mems, seq: seq, a: seq[0], b: seq[seq.length - 1], L: cl, ex: clx / cl, ey: cly / cl });
  }

  /* move any load sitting on a condensed node out to the chain ends */
  for (var ci = 0; ci < chains.length; ci++) {
    var ch = chains[ci];
    if (ch.seq.length <= 2) continue;
    var na = ch.a, nb = ch.b, PA = nodes[na];
    for (k = 1; k < ch.seq.length - 1; k++) {
      var nn = ch.seq[k];
      var t = Math.sqrt(Math.pow(nodes[nn].x - PA.x, 2) + Math.pow(nodes[nn].y - PA.y, 2)) / ch.L;
      F[2 * na] += F[2 * nn] * (1 - t); F[2 * nb] += F[2 * nn] * t;
      F[2 * na + 1] += F[2 * nn + 1] * (1 - t); F[2 * nb + 1] += F[2 * nn + 1] * t;
      F[2 * nn] = 0; F[2 * nn + 1] = 0;
    }
  }

  /* ---- active node set / dof map ----------------------------------------- */
  var idx = new Int32Array(N).fill(-1), act = [];
  for (n = 0; n < N; n++) {
    if (pruned[n] || pt[n] || deg[n] === 0) continue;
    idx[n] = act.length; act.push(n);
  }
  var na2 = act.length, nd2 = 2 * na2;

  var result = {
    mechanism: false, reason: '', rank: 0, ndof: nd2, nfree: 0, nullity: 0,
    u: new Float64Array(2 * N), mode: null, modes: null, maxDisp: 0,
    force: new Float64Array(M), util: new Float64Array(M),
    buckLen: new Float64Array(M), capC: new Float64Array(M),
    zeroForce: new Uint8Array(M), live: live, stub: stub,
    pruned: pruned, passthrough: pt, reactions: [], chains: chains,
    empty: false, selfWeightTotal: selfWeightTotal
  };
  for (i = 0; i < M; i++) {
    result.buckLen[i] = L[i];
    result.capC[i] = capC(L[i]);
    if (live[i] && stub[i]) result.zeroForce[i] = 1;
  }
  if (na2 === 0 || chains.length === 0) {
    result.empty = true;
    result.mechanism = true;
    result.reason = 'nothing to carry the load';
    return result;
  }

  /* ---- assemble K --------------------------------------------------------- */
  var K = new Float64Array(nd2 * nd2);
  for (ci = 0; ci < chains.length; ci++) {
    var c = chains[ci];
    var ia = idx[c.a], ib = idx[c.b];
    if (ia < 0 || ib < 0) continue;
    var kk = MAT.E * MAT.A / c.L;
    var cx = c.ex, cy = c.ey;
    var kxx = kk * cx * cx, kxy = kk * cx * cy, kyy = kk * cy * cy;
    var d = [2 * ia, 2 * ia + 1, 2 * ib, 2 * ib + 1];
    var loc = [kxx, kxy, -kxx, -kxy,
               kxy, kyy, -kxy, -kyy,
              -kxx, -kxy, kxx, kxy,
              -kxy, -kyy, kxy, kyy];
    for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) K[d[i] * nd2 + d[j]] += loc[i * 4 + j];
  }
  var Kfull = new Float64Array(K); // keep a clean copy for reactions

  /* ---- boundary conditions ------------------------------------------------ */
  var freeDof = [];
  for (var ai = 0; ai < na2; ai++) {
    var gn = act[ai];
    if (!nodes[gn].fixX) freeDof.push(2 * ai);
    if (!nodes[gn].fixY) freeDof.push(2 * ai + 1);
  }
  var nf = freeDof.length;
  result.nfree = nf;
  if (nf === 0) {
    result.reason = 'fully restrained';
    // still compute forces (all zero displacement)
  }

  var uAct = new Float64Array(nd2);
  var sol = null;
  if (nf > 0) {
    var Kff = new Float64Array(nf * nf), Ff = new Float64Array(nf);
    for (i = 0; i < nf; i++) {
      var gi = freeDof[i];
      Ff[i] = F[2 * act[gi >> 1] + (gi & 1)];
      for (j = 0; j < nf; j++) Kff[i * nf + j] = K[gi * nd2 + freeDof[j]];
    }
    sol = gaussFull(Kff, Ff, nf);
    result.rank = sol.rank;
    for (i = 0; i < nf; i++) uAct[freeDof[i]] = sol.x[i];

    if (sol.singular) {
      result.mechanism = true;
      /* the dimension of the null space = how many independent ways this
         structure can move without straining anything. Each one needs at least
         one more member (or support) to lock it. */
      result.nullity = nf - sol.rank;
      result.reason = sol.inconsistent
        ? 'mechanism — the load has no path to the supports'
        : 'mechanism — the structure can move without stretching anything';
      /* pick the null-space direction the load actually drives */
      var bestZ = null, bestW = -1;
      for (k = 0; k < sol.nulls.length; k++) {
        var z = sol.nulls[k], w = 0;
        for (i = 0; i < nf; i++) w += z[i] * Ff[i];
        if (Math.abs(w) > bestW) { bestW = Math.abs(w); bestZ = z; if (w < 0) { bestZ = z.map(function (v) { return -v; }); } }
      }
      if (!bestZ && sol.nulls.length) bestZ = sol.nulls[0];
      if (bestZ) {
        var modeAct = new Float64Array(nd2);
        for (i = 0; i < nf; i++) modeAct[freeDof[i]] = bestZ[i];
        result.mode = expandToNodes(modeAct, act, idx, chains, nodes, N, pruned, inc, mem, live);
      }
      /* every independent fold, not just the one this load happens to drive —
         the game cycles through them so a student can see each in turn */
      result.modes = [];
      for (k = 0; k < sol.nulls.length && k < 8; k++) {
        var mAct = new Float64Array(nd2);
        for (i = 0; i < nf; i++) mAct[freeDof[i]] = sol.nulls[k][i];
        result.modes.push(expandToNodes(mAct, act, idx, chains, nodes, N, pruned, inc, mem, live));
      }
      // a mechanism has no meaningful equilibrium displacement
      for (i = 0; i < nd2; i++) uAct[i] = 0;
    }
  }

  /* ---- displacements out to every original node --------------------------- */
  result.u = expandToNodes(uAct, act, idx, chains, nodes, N, pruned, inc, mem, live);
  var md = 0;
  for (n = 0; n < N; n++) {
    var dmag = Math.hypot(result.u[2 * n], result.u[2 * n + 1]);
    if (dmag > md) md = dmag;
  }
  result.maxDisp = md;
  if (!result.mechanism && md > COLLAPSE_DISP) {
    result.mechanism = true;
    result.reason = 'excessive deflection — effectively a collapse';
    result.mode = result.u;
  }

  /* ---- member forces ------------------------------------------------------ */
  if (!result.mechanism) {
    for (ci = 0; ci < chains.length; ci++) {
      var ch2 = chains[ci];
      var iaa = idx[ch2.a], ibb = idx[ch2.b];
      if (iaa < 0 || ibb < 0) continue;
      var dux = uAct[2 * ibb] - uAct[2 * iaa], duy = uAct[2 * ibb + 1] - uAct[2 * iaa + 1];
      var Nax = (MAT.E * MAT.A / ch2.L) * (dux * ch2.ex + duy * ch2.ey);
      for (k = 0; k < ch2.mems.length; k++) {
        var mi = ch2.mems[k];
        result.force[mi] = Nax;
        result.buckLen[mi] = ch2.L;      // unbraced length is the whole chain
        result.capC[mi] = capC(ch2.L);
        result.util[mi] = Nax >= 0 ? Nax / MAT.capT : (-Nax) / result.capC[mi];
      }
    }
    /* ---- reactions --------------------------------------------------------- */
    for (ai = 0; ai < na2; ai++) {
      var gn2 = act[ai];
      if (!nodes[gn2].fixX && !nodes[gn2].fixY) continue;
      var rx = 0, ry = 0;
      for (j = 0; j < nd2; j++) {
        rx += Kfull[(2 * ai) * nd2 + j] * uAct[j];
        ry += Kfull[(2 * ai + 1) * nd2 + j] * uAct[j];
      }
      result.reactions.push({ node: gn2, fx: rx - F[2 * gn2], fy: ry - F[2 * gn2 + 1] });
    }
  }
  result.loadVec = F;
  return result;
}

/* spread an active-dof vector over every original node (condensed nodes are
   interpolated along their chain, pruned stubs follow their anchor) */
function expandToNodes(uAct, act, idx, chains, nodes, N, pruned, inc, mem, live) {
  var out = new Float64Array(2 * N), i, k;
  for (i = 0; i < act.length; i++) {
    out[2 * act[i]] = uAct[2 * i];
    out[2 * act[i] + 1] = uAct[2 * i + 1];
  }
  for (var ci = 0; ci < chains.length; ci++) {
    var ch = chains[ci];
    if (ch.seq.length <= 2) continue;
    var A = nodes[ch.a], ia = idx[ch.a], ib = idx[ch.b];
    if (ia < 0 || ib < 0) continue;
    for (k = 1; k < ch.seq.length - 1; k++) {
      var nn = ch.seq[k];
      var t = Math.hypot(nodes[nn].x - A.x, nodes[nn].y - A.y) / ch.L;
      out[2 * nn] = uAct[2 * ia] * (1 - t) + uAct[2 * ib] * t;
      out[2 * nn + 1] = uAct[2 * ia + 1] * (1 - t) + uAct[2 * ib + 1] * t;
    }
  }
  /* pruned stubs ride along with whatever they hang off */
  for (var pass = 0; pass < N; pass++) {
    var moved = false;
    for (var n = 0; n < N; n++) {
      if (!pruned[n]) continue;
      for (var q = 0; q < mem.length; q++) {
        if (!live[q]) continue;
        var o = mem[q].a === n ? mem[q].b : (mem[q].b === n ? mem[q].a : -1);
        if (o < 0) continue;
        if (!pruned[o] || (out[2 * o] || out[2 * o + 1])) {
          if (out[2 * n] !== out[2 * o] || out[2 * n + 1] !== out[2 * o + 1]) {
            out[2 * n] = out[2 * o]; out[2 * n + 1] = out[2 * o + 1]; moved = true;
          }
          break;
        }
      }
    }
    if (!moved) break;
  }
  return out;
}

/* ================================================ progressive collapse ==== */
/* Solve, snap the single most-overloaded member, re-solve with what is left,
   repeat. That re-solve is what turns one broken member into a cascade. */
function solveWithBreaks(model, maxBreaks) {
  maxBreaks = maxBreaks == null ? 40 : maxBreaks;
  var live = new Uint8Array(model.members.length);
  for (var i = 0; i < live.length; i++)
    live[i] = model.live ? (model.live[i] ? 1 : 0) : (model.members[i].broken ? 0 : 1);
  var broke = [], res = null;
  for (var it = 0; it <= maxBreaks; it++) {
    res = analyse({ nodes: model.nodes, members: model.members, live: live,
                    loads: model.loads, selfWeight: model.selfWeight });
    if (res.mechanism) break;
    var worst = -1, wu = 1.0;
    for (i = 0; i < live.length; i++) {
      if (!live[i] || res.stub[i]) continue;
      if (res.util[i] > wu) { wu = res.util[i]; worst = i; }
    }
    if (worst < 0) break;
    live[worst] = 0;
    broke.push({ member: worst, util: wu, force: res.force[worst] });
  }
  return { result: res, broke: broke, live: live };
}

/* ====================================================== vehicle loads ===== */
/* Wheels sit on the roadway. Each wheel load is shared between the two ends
   of whichever deck member it stands on, by lever arm — the standard
   tributary distribution to panel points. */
function deckMembers(nodes, members, live, deckY) {
  var out = [];
  for (var i = 0; i < members.length; i++) {
    if (live && !live[i]) continue;
    if (!live && members[i].broken) continue;
    var a = nodes[members[i].a], b = nodes[members[i].b];
    if (Math.abs(a.y - deckY) > 1e-6 || Math.abs(b.y - deckY) > 1e-6) continue;
    if (Math.abs(a.x - b.x) < 1e-9) continue;
    out.push({ i: i, x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x),
               a: members[i].a, b: members[i].b });
  }
  return out;
}

/* is there an unbroken roadway from x0 to x1? */
function deckCoverage(nodes, members, live, deckY, x0, x1) {
  var segs = deckMembers(nodes, members, live, deckY)
    .map(function (d) { return [d.x0, d.x1]; })
    .sort(function (p, q) { return p[0] - q[0]; });
  var reach = x0, gapAt = null;
  for (var i = 0; i < segs.length; i++) {
    if (segs[i][0] > reach + 1e-6) { gapAt = reach; break; }
    if (segs[i][1] > reach) reach = segs[i][1];
    if (reach >= x1 - 1e-6) break;
  }
  if (reach < x1 - 1e-6 && gapAt === null) gapAt = reach;
  return { ok: reach >= x1 - 1e-6, reach: reach, gapAt: gapAt };
}

/* build the nodal load vector for a vehicle whose front axle is at x */
function wheelLoads(nodes, members, live, deckY, vehicle, x) {
  var N = nodes.length;
  var F = new Float64Array(2 * N);
  var dm = deckMembers(nodes, members, live, deckY);
  var onDeck = 0, total = 0;
  for (var w = 0; w < vehicle.axles.length; w++) {
    var ax = vehicle.axles[w], wx = x - ax.dx, P = ax.P;
    total += P;
    var host = null;
    for (var i = 0; i < dm.length; i++)
      if (wx >= dm[i].x0 - 1e-9 && wx <= dm[i].x1 + 1e-9) { host = dm[i]; break; }
    if (!host) continue;
    onDeck += P;
    var A = nodes[host.a], B = nodes[host.b];
    var t = Math.abs(B.x - A.x) < 1e-12 ? 0 : (wx - A.x) / (B.x - A.x);
    t = Math.max(0, Math.min(1, t));
    F[2 * host.a + 1] -= P * (1 - t);
    F[2 * host.b + 1] -= P * t;
  }
  return { loads: F, onDeck: onDeck, total: total };
}

/* ============================================ honest fold geometry ======== */
/* A null-space vector has zero axial strain only to FIRST order. Draw it at a
   finite amplitude and members visibly stretch — which teaches exactly the
   wrong lesson, since the whole point is that a fold changes no member length.
   So: use the mode as a predictor, then project back onto exact member lengths
   (Gauss-Seidel on the distance constraints, supports held) before drawing.
   What comes back is either
     - a FINITE mechanism: the projection holds a large displacement with the
       lengths exactly preserved. A true hinge.
     - an INFINITESIMAL mechanism: no length-preserving path exists, so the
       projection pulls it back. The structure still has zero stiffness at rest
       (K really is singular) but it can only move by second-order stretching.
   Both are failures; they are not the same failure, and the game should not
   draw them as if they were. */
function projectToLengths(nodes, members, live, pts, iters) {
  var M = members.length, i, it;
  var rest = new Float64Array(M);
  for (i = 0; i < M; i++) {
    if (live && !live[i]) continue;
    var a0 = nodes[members[i].a], b0 = nodes[members[i].b];
    rest[i] = Math.hypot(b0.x - a0.x, b0.y - a0.y);
  }
  for (it = 0; it < (iters || 60); it++) {
    for (i = 0; i < M; i++) {
      if (live && !live[i]) continue;
      if (!(rest[i] > 1e-9)) continue;
      var na = nodes[members[i].a], nb = nodes[members[i].b];
      var A = pts[members[i].a], B = pts[members[i].b];
      var wa = (na.fixX && na.fixY) ? 0 : 1, wb = (nb.fixX && nb.fixY) ? 0 : 1;
      var tot = wa + wb;
      if (!tot) continue;
      var dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
      if (d < 1e-9) continue;
      var s = (d - rest[i]) / d;
      if (wa) {
        if (!na.fixX) A.x += dx * s * (wa / tot);
        if (!na.fixY) A.y += dy * s * (wa / tot);
      }
      if (wb) {
        if (!nb.fixX) B.x -= dx * s * (wb / tot);
        if (!nb.fixY) B.y -= dy * s * (wb / tot);
      }
    }
  }
  var err = 0, disp = 0;
  for (i = 0; i < M; i++) {
    if (live && !live[i]) continue;
    if (!(rest[i] > 1e-9)) continue;
    var d2 = Math.hypot(pts[members[i].b].x - pts[members[i].a].x,
                        pts[members[i].b].y - pts[members[i].a].y);
    err = Math.max(err, Math.abs(d2 - rest[i]) / rest[i]);
  }
  for (i = 0; i < nodes.length; i++)
    disp = Math.max(disp, Math.hypot(pts[i].x - nodes[i].x, pts[i].y - nodes[i].y));
  return { err: err, disp: disp };
}

/* displaced-and-corrected shape for one mode at one amplitude */
function foldShape(nodes, members, live, mode, amp, iters) {
  var pts = [];
  for (var i = 0; i < nodes.length; i++)
    pts.push({ x: nodes[i].x + mode[2 * i] * amp, y: nodes[i].y + mode[2 * i + 1] * amp });
  var q = projectToLengths(nodes, members, live, pts, iters);
  return { pts: pts, err: q.err, disp: q.disp };
}

/* ================================================== the crossing test ===== */
/* Drive the vehicle across quasi-statically: at each position re-solve from
   scratch (with whatever members are still standing) and let overloads break.
   A bridge "survives" only if nothing breaks and it never becomes a mechanism. */
function crossTest(model, opt) {
  var nodes = model.nodes, members = model.members;
  var M = members.length;
  var live = new Uint8Array(M);
  for (var i = 0; i < M; i++) live[i] = members[i].broken ? 0 : 1;

  var wb = 0;
  for (i = 0; i < opt.vehicle.axles.length; i++) wb = Math.max(wb, opt.vehicle.axles[i].dx);
  var step = opt.step || 0.25;
  var xStart = opt.x0, xEnd = opt.x1 + wb;

  var cov = deckCoverage(nodes, members, live, opt.deckY, opt.x0, opt.x1);
  if (!cov.ok)
    return { survived: false, reason: 'the roadway does not reach across', gapAt: cov.gapAt,
             maxForce: new Float64Array(M), maxUtil: new Float64Array(M), broke: [], noDeck: true };

  var maxForce = new Float64Array(M), maxUtil = new Float64Array(M);
  var maxT = new Float64Array(M), maxC = new Float64Array(M);
  var broke = [], first = null, mechanismAt = null, peakDefl = 0, peakDeflAt = 0;

  for (var x = xStart; x <= xEnd + 1e-9; x += step) {
    var wl = wheelLoads(nodes, members, live, opt.deckY, opt.vehicle, x);
    var r = solveWithBreaks({ nodes: nodes, members: members, live: live,
                              loads: wl.loads, selfWeight: opt.selfWeight }, 40);
    for (i = 0; i < M; i++) {
      if (!live[i]) continue;
      var f = r.result.force[i];
      if (Math.abs(f) > Math.abs(maxForce[i])) maxForce[i] = f;
      if (f > maxT[i]) maxT[i] = f;
      if (f < maxC[i]) maxC[i] = f;
      if (r.result.util[i] > maxUtil[i]) maxUtil[i] = r.result.util[i];
    }
    /* solveWithBreaks removes the snapped member before returning its final
       equilibrium. Preserve the actual over-limit sample for the debrief,
       rather than filtering it out with the now-dead live mask. */
    for (i = 0; i < r.broke.length; i++) {
      var br = r.broke[i], bi = br.member, bf = br.force;
      if (Math.abs(bf) > Math.abs(maxForce[bi])) maxForce[bi] = bf;
      if (bf > maxT[bi]) maxT[bi] = bf;
      if (bf < maxC[bi]) maxC[bi] = bf;
      if (br.util > maxUtil[bi]) maxUtil[bi] = br.util;
    }
    if (r.result && r.result.maxDisp > peakDefl) { peakDefl = r.result.maxDisp; peakDeflAt = x; }
    if (r.broke.length) {
      for (i = 0; i < r.broke.length; i++) broke.push({ x: x, member: r.broke[i].member,
        util: r.broke[i].util, force: r.broke[i].force });
      if (!first) first = { x: x, member: r.broke[0].member, util: r.broke[0].util,
        force: r.broke[0].force, mode: r.broke[0].force > 0 ? 'tension' : 'buckling' };
      live = r.live;
    }
    if (r.result.mechanism && mechanismAt === null) {
      mechanismAt = x;
      if (!first) first = { x: x, member: -1, util: 0, force: 0, mode: 'mechanism',
                            reason: r.result.reason };
      break;
    }
  }

  return {
    survived: broke.length === 0 && mechanismAt === null,
    reason: mechanismAt !== null ? 'the structure turned into a mechanism'
          : broke.length ? 'a member failed' : '',
    maxForce: maxForce, maxTension: maxT, maxCompression: maxC, maxUtil: maxUtil,
    broke: broke, first: first, mechanismAt: mechanismAt,
    peakDefl: peakDefl, peakDeflAt: peakDeflAt, live: live
  };
}

return {
  MAT: MAT, capC: capC, capT: capT, memberCost: memberCost, crossTest: crossTest,
  jointCost: jointCost, designCost: designCost,
  COLLAPSE_DISP: COLLAPSE_DISP, SERVICE_RATIO: SERVICE_RATIO,
  analyse: analyse, solveWithBreaks: solveWithBreaks, gaussFull: gaussFull,
  projectToLengths: projectToLengths, foldShape: foldShape,
  deckMembers: deckMembers, deckCoverage: deckCoverage, wheelLoads: wheelLoads
};
});
