/* =====================================================================
   TOPPING OUT — 4D CUTAWAY
   (concatenated into the bundle by build.js)

   Two design rules, both learned from watching the thing confuse people:

   1. The view must say something useful on week 1, when nothing has
      been built. So the finished building is always drawn first as a
      faint ghost and real work fills it in. Progress then reads as
      "how much of the ghost is solid", which is the question you
      actually ask walking a site.

   2. Nothing here may be hard-coded to one project's activity IDs.
      Geometry is derived from the zones the network uses, and every
      element is driven by an activity's `role` (see data.js). A network
      that only uses Level 1 draws a single-storey building — which is
      what the tutorial is, and drawing it as an empty three-storey
      ghost was the fastest way to lose a student on turn one.
   ===================================================================== */

TO.View4D = (function () {

  var SVGNS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(parent, x, y, s, attrs) {
    var t = el('text', attrs || {}, parent);
    t.setAttribute('x', x); t.setAttribute('y', y);
    t.appendChild(document.createTextNode(s));
    return t;
  }
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

  var C = {
    sky: '#cfe3f4', skyHi: '#eef6fc', earth: '#cfc7ae', earthDark: '#a2916c',
    grass: '#8fb56a',
    ghost: '#a9bccf', concrete: '#b6babc', concreteDark: '#8d9092',
    steel: '#4c5c68', steelDark: '#33465a',
    brick: '#9e4a35', brickDark: '#7d3a2a', mortar: '#d9cfc0', stone: '#e3ddcf',
    glass: '#9fc6dd', glassEdge: '#5d8ba6',
    roof: '#4a4340',
    mep: '#8a5a9e', dry: '#b08a4a', fin: '#4a8f52', elev: '#7d7a86',
    navy: '#002144', gold: '#ECAC00', goldDark: '#9c7200',
    skin: '#f0c39a', crewOver: '#b3261e', idle: '#a5730a'
  };

  /* ---- progress helpers -------------------------------------------- */
  function pct(g, id) {
    var s = g.state[id], a = g.byId[id];
    if (!s || !a) return 0;
    if (s.finishDay !== null) return 1;
    if (s.startedDay === null) return 0;
    var total = a.work + (s.holdExtra || 0);
    if (total <= 0) return 1;
    return clamp01((total - s.remaining - (s.holdExtra || 0)) / total);
  }
  function role(g, r, zone) {
    var t = 0, n = 0;
    g.net.activities.forEach(function (a) {
      if (a.role !== r) return;
      if (zone && a.zone !== zone) return;
      t += pct(g, a.id); n++;
    });
    return n ? t / n : 0;
  }
  function roleDone(g, r, zone) {
    var any = false, all = true;
    g.net.activities.forEach(function (a) {
      if (a.role !== r) return;
      if (zone && a.zone !== zone) return;
      any = true;
      if (g.state[a.id].finishDay === null) all = false;
    });
    return any && all;
  }
  function hasRole(g, r) {
    return g.net.activities.some(function (a) { return a.role === r; });
  }
  function hasZone(g, z) {
    return g.net.activities.some(function (a) { return a.zone === z; });
  }

  /* ---- a cartoon worker ---------------------------------------------
     About 26px tall: boots, work pants, a gold hi-vis vest over a navy
     shirt, arms with a pose, a face, and a gold hard hat. `pose` cycles
     so a crew reads as people doing things rather than clones:
       0 hands on hips   1 carrying a board   2 arm up, signalling      */
  function worker(svg, cx, feetY, opts) {
    opts = opts || {};
    var over = !!opts.over;
    var vest = over ? C.crewOver : C.gold;
    var shirt = over ? '#7d1a14' : C.navy;
    var pose = opts.pose || 0;
    var g2 = el('g', null, svg);
    /* legs + boots */
    el('rect', { x: cx - 4.6, y: feetY - 10, width: 3.6, height: 8.5, fill: shirt }, g2);
    el('rect', { x: cx + 1, y: feetY - 10, width: 3.6, height: 8.5, fill: shirt }, g2);
    el('rect', { x: cx - 5.6, y: feetY - 2.4, width: 5.4, height: 2.6, rx: 1, fill: '#5a4632' }, g2);
    el('rect', { x: cx + 0.4, y: feetY - 2.4, width: 5.4, height: 2.6, rx: 1, fill: '#5a4632' }, g2);
    /* torso: vest over shirt */
    el('rect', { x: cx - 5.4, y: feetY - 19, width: 10.8, height: 9.6, rx: 2.4, fill: vest, stroke: over ? '#7d1a14' : C.goldDark, 'stroke-width': .7 }, g2);
    el('path', { d: 'M' + (cx - 3.4) + ' ' + (feetY - 19) + ' v9.6 M' + (cx + 3.4) + ' ' + (feetY - 19) + ' v9.6', stroke: '#fff', 'stroke-width': 1.1, opacity: .85 }, g2);
    /* arms by pose */
    if (pose === 1) {
      el('rect', { x: cx - 9.5, y: feetY - 18.4, width: 4, height: 3, rx: 1.4, fill: shirt }, g2);
      el('rect', { x: cx + 5.5, y: feetY - 18.4, width: 4, height: 3, rx: 1.4, fill: shirt }, g2);
      el('rect', { x: cx - 12, y: feetY - 20.4, width: 24, height: 2.6, rx: 1, fill: '#b98a4e', stroke: '#8f6836', 'stroke-width': .5 }, g2);
    } else if (pose === 2) {
      el('rect', { x: cx - 9.5, y: feetY - 18.4, width: 4.6, height: 3, rx: 1.4, fill: shirt }, g2);
      el('rect', { x: cx + 4.4, y: feetY - 27, width: 2.8, height: 10, rx: 1.4, fill: shirt }, g2);
    } else {
      el('path', { d: 'M' + (cx - 5.4) + ' ' + (feetY - 17.6) + ' q-3.6 1.4 -2.6 5.4', stroke: shirt, 'stroke-width': 2.6, fill: 'none', 'stroke-linecap': 'round' }, g2);
      el('path', { d: 'M' + (cx + 5.4) + ' ' + (feetY - 17.6) + ' q3.6 1.4 2.6 5.4', stroke: shirt, 'stroke-width': 2.6, fill: 'none', 'stroke-linecap': 'round' }, g2);
    }
    /* head + face + hard hat */
    el('circle', { cx: cx, cy: feetY - 22.4, r: 4.2, fill: C.skin }, g2);
    el('circle', { cx: cx - 1.5, cy: feetY - 22.8, r: .55, fill: '#33261a' }, g2);
    el('circle', { cx: cx + 1.5, cy: feetY - 22.8, r: .55, fill: '#33261a' }, g2);
    el('path', { d: 'M' + (cx - 1.3) + ' ' + (feetY - 21) + ' q1.3 1 2.6 0', stroke: '#8a5a3a', 'stroke-width': .6, fill: 'none' }, g2);
    var hat = over ? C.crewOver : C.gold;
    el('path', { d: 'M' + (cx - 4.4) + ' ' + (feetY - 24.6) + ' a4.4 4.6 0 0 1 8.8 0 z', fill: hat, stroke: C.goldDark, 'stroke-width': .6 }, g2);
    el('rect', { x: cx - 6, y: feetY - 25, width: 12, height: 1.7, rx: .8, fill: hat, stroke: C.goldDark, 'stroke-width': .5 }, g2);
    return g2;
  }

  /* ---- geometry derived from the project ---------------------------- */
  function geometry(g) {
    var levels = ['L1', 'L2', 'L3'].filter(function (z) { return hasZone(g, z); });
    if (!levels.length) levels = ['L1'];
    var bandH = levels.length >= 3 ? 78 : (levels.length === 2 ? 104 : 132);
    var GROUND = 322;
    var G = {
      GROUND: GROUND, X0: 196, X1: 516, CUT: 396,
      levels: levels, bandH: bandH,
      PARAPET: GROUND - levels.length * bandH, L: {}
    };
    levels.forEach(function (z, i) { G.L[z] = [GROUND - i * bandH, GROUND - (i + 1) * bandH]; });
    return G;
  }

  /* =================================================================== */
  function render(host, g, cpm) {
    host.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.id = 'fourd-wrap';
    host.appendChild(wrap);

    var G = geometry(g);
    /* Fit the viewBox to the building this project actually has, so a
       single-storey job is not drawn as a small box under acres of sky. */
    var vTop = Math.min(G.PARAPET - 52, 36);
    var svg = el('svg', {
      id: 'fourd-svg', viewBox: '0 ' + vTop + ' 720 ' + (400 - vTop),
      preserveAspectRatio: 'xMidYMid meet'
    });
    wrap.appendChild(svg);

    /* sky with a gradient, a sun, and a couple of lazy clouds — the
       cartoon starts with the backdrop */
    var defs = el('defs', null, svg);
    var grad = el('linearGradient', { id: 'skyg', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0%', 'stop-color': C.sky }, grad);
    el('stop', { offset: '100%', 'stop-color': C.skyHi }, grad);
    var brickP = el('pattern', { id: 'brickp', width: 22, height: 12, patternUnits: 'userSpaceOnUse' }, defs);
    el('rect', { width: 22, height: 12, fill: C.brick }, brickP);
    el('path', { d: 'M0 0 H22 M0 6 H22 M6 0 V6 M17 6 V12', stroke: C.mortar, 'stroke-width': 1 }, brickP);
    el('path', { d: 'M0 12 H22', stroke: C.mortar, 'stroke-width': 1 }, brickP);

    el('rect', { x: -700, y: -700, width: 2100, height: 700 + G.GROUND, fill: 'url(#skyg)' }, svg);
    /* sun and clouds sit relative to the visible frame, not the
       building, so they never clip off the top of a tall project */
    var skyTop = vTop + 16;
    el('circle', { cx: 66, cy: skyTop + 26, r: 24, fill: '#ffd965', stroke: '#f3b62a', 'stroke-width': 3, opacity: .95 }, svg);
    [[310, 10, 1], [560, 34, .8], [168, 44, .6]].forEach(function (cl) {
      var cy2 = skyTop + cl[1];
      var gcl = el('g', { opacity: .9 }, svg);
      el('ellipse', { cx: cl[0], cy: cy2, rx: 40 * cl[2], ry: 12 * cl[2], fill: '#fff' }, gcl);
      el('ellipse', { cx: cl[0] - 24 * cl[2], cy: cy2 + 4, rx: 23 * cl[2], ry: 9 * cl[2], fill: '#fff' }, gcl);
      el('ellipse', { cx: cl[0] + 26 * cl[2], cy: cy2 + 5, rx: 21 * cl[2], ry: 8 * cl[2], fill: '#fff' }, gcl);
    });
    el('rect', { x: -700, y: G.GROUND, width: 2100, height: 900, fill: C.earth }, svg);
    el('rect', { x: -700, y: G.GROUND, width: 2100, height: 5, fill: C.grass }, svg);

    var backfilled = hasRole(g, 'backfill')
      ? roleDone(g, 'backfill')
      : roleDone(g, 'slab');

    drawSite(svg, g, G);
    if (!backfilled) drawExcavation(svg, g, G);
    drawGhost(svg, g, G);
    drawFoundations(svg, g, G, backfilled);
    drawStructure(svg, g, G);
    drawRoof(svg, g, G);
    drawEnvelope(svg, g, G);
    drawInteriors(svg, g, G);
    drawElevator(svg, g, G);
    drawCrane(svg, g, G);
    drawCrews(svg, g, G, cpm);
    drawLevelTags(svg, g, G);
    drawKey(svg, g, G);

    var rain = document.createElement('div'); rain.className = 'rainfx'; rain.id = 'rainfx';
    var chip = document.createElement('div'); chip.className = 'daychip'; chip.id = 'daychip';
    var bar = document.createElement('div'); bar.id = 'runbar'; bar.innerHTML = '<i></i>';
    host.appendChild(rain); host.appendChild(chip); host.appendChild(bar);

    wrap.appendChild(buildZoneStrip(g, cpm));
  }

  /* ---- the ghost: what the finished building will be ---------------- */
  function drawGhost(svg, g, G) {
    var gh = el('g', { opacity: .6 }, svg);
    el('rect', {
      x: G.X0, y: G.PARAPET, width: G.X1 - G.X0, height: G.GROUND - G.PARAPET,
      fill: 'none', stroke: C.ghost, 'stroke-width': 1.2, 'stroke-dasharray': '5 4'
    }, gh);
    G.levels.forEach(function (z) {
      el('line', {
        x1: G.X0, y1: G.L[z][1], x2: G.X1, y2: G.L[z][1],
        stroke: C.ghost, 'stroke-width': 1, 'stroke-dasharray': '5 4'
      }, gh);
    });
    if (hasRole(g, 'sheathing')) {
      el('line', {
        x1: G.CUT, y1: G.PARAPET, x2: G.CUT, y2: G.GROUND,
        stroke: C.ghost, 'stroke-width': 1, 'stroke-dasharray': '2 3'
      }, gh);
    }
    txt(gh, (G.X0 + G.X1) / 2, G.PARAPET - 26, 'SECTION LOOKING NORTH', {
      fill: '#8f9dad', 'font-size': 8.5, 'font-family': 'monospace',
      'text-anchor': 'middle', 'letter-spacing': '1.5'
    });
  }

  /* ---- site context -------------------------------------------------- */
  function drawSite(svg, g, G) {
    var GR = G.GROUND;
    el('line', { x1: 34, y1: GR, x2: 34, y2: GR + 54, stroke: '#a89f88', 'stroke-width': 1, 'stroke-dasharray': '6 3 2 3' }, svg);
    el('line', { x1: 690, y1: GR, x2: 690, y2: GR + 54, stroke: '#a89f88', 'stroke-width': 1, 'stroke-dasharray': '6 3 2 3' }, svg);
    el('line', { x1: -700, y1: GR, x2: 1400, y2: GR, stroke: '#a89f88', 'stroke-width': 1.4 }, svg);

    var p = role(g, 'mobilize');
    if (p > 0) {
      var t = el('g', { opacity: 0.4 + 0.6 * p }, svg);
      /* the field office, with the pennant every Racer site flies */
      el('rect', { x: 52, y: GR - 32, width: 80, height: 32, rx: 2, fill: '#f2ede2', stroke: '#9a9280', 'stroke-width': 1.2 }, t);
      el('rect', { x: 52, y: GR - 36, width: 80, height: 5, rx: 2, fill: C.navy }, t);
      el('rect', { x: 60, y: GR - 26, width: 15, height: 11, fill: C.glass, stroke: '#5d8ba6', 'stroke-width': .8 }, t);
      el('rect', { x: 82, y: GR - 26, width: 15, height: 11, fill: C.glass, stroke: '#5d8ba6', 'stroke-width': .8 }, t);
      el('rect', { x: 106, y: GR - 22, width: 13, height: 22, fill: '#b6ab93', stroke: '#8f8467', 'stroke-width': .8 }, t);
      el('circle', { cx: 116, cy: GR - 11, r: 1, fill: '#5a4632' }, t);
      el('rect', { x: 100, y: GR - 1, width: 22, height: 3, fill: '#8f8467' }, t);
      el('line', { x1: 58, y1: GR - 36, x2: 58, y2: GR - 62, stroke: '#6b6249', 'stroke-width': 1.6 }, t);
      el('path', { d: 'M58 ' + (GR - 62) + ' l22 4.5 l-22 4.5 z', fill: C.navy }, t);
      el('path', { d: 'M58 ' + (GR - 60) + ' l14 2.6 l-14 2.8 z', fill: C.gold }, t);
      txt(t, 92, GR + 12, 'FIELD OFFICE', { fill: '#8b8370', 'font-size': 7, 'font-family': 'monospace', 'text-anchor': 'middle' });
      /* conex box */
      el('rect', { x: 22, y: GR - 15, width: 26, height: 15, fill: C.navy, stroke: '#0e2f52', 'stroke-width': 1 }, t);
      el('path', { d: 'M25 ' + (GR - 15) + ' V' + GR + ' M30 ' + (GR - 15) + ' V' + GR + ' M35 ' + (GR - 15) + ' V' + GR + ' M40 ' + (GR - 15) + ' V' + GR + ' M45 ' + (GR - 15) + ' V' + GR, stroke: '#0e2f52', 'stroke-width': .8 }, t);
    }
    var ps = role(g, 'sitework');
    if (ps > 0) {
      el('rect', { x: 552, y: GR + 4, width: 120 * ps, height: 15, fill: '#5f5b55', opacity: .85 }, svg);
      txt(svg, 552, GR + 32, 'PAVING', { fill: '#8b8370', 'font-size': 7, 'font-family': 'monospace' });
      for (var i = 0; i < 3 * ps; i++) {
        el('circle', { cx: 566 + i * 30, cy: GR + 34, r: 7, fill: '#4a8f52', opacity: .85 }, svg);
      }
    }
  }

  function drawExcavation(svg, g, G) {
    var p = role(g, 'excavate'), GR = G.GROUND, X0 = G.X0, X1 = G.X1;
    if (p <= 0) return;
    var depth = 46 * p;
    el('path', {
      d: 'M' + (X0 - 26) + ',' + GR + ' L' + (X0 - 8) + ',' + (GR + depth) +
         ' L' + (X1 + 8) + ',' + (GR + depth) + ' L' + (X1 + 26) + ',' + GR + ' Z',
      fill: C.earthDark, stroke: '#7d6f52', 'stroke-width': 1
    }, svg);
    el('path', { d: 'M596,' + GR + ' q26,' + (-15 * p) + ' 52,0 Z', fill: '#a8966f' }, svg);
    if (p < 1) txt(svg, (X0 + X1) / 2, GR + 30, 'EXCAVATION ' + Math.round(p * 100) + '%', {
      fill: '#7d6f52', 'font-size': 8, 'font-family': 'monospace', 'text-anchor': 'middle'
    });
  }

  function drawFoundations(svg, g, G, backfilled) {
    var GR = G.GROUND, X0 = G.X0, X1 = G.X1;
    var pf = role(g, 'footing'), pw = role(g, 'wall');
    if (pf > 0) el('rect', { x: X0 - 6, y: GR + 34, width: (X1 - X0 + 12) * pf, height: 8, fill: '#8f9294', stroke: '#74777a' }, svg);
    if (pw > 0) {
      var h = 38 * pw;
      el('rect', { x: X0 - 3, y: GR + 34 - h, width: 12, height: h, fill: '#9a9d9f', stroke: '#7c7f81' }, svg);
      el('rect', { x: X1 - 9, y: GR + 34 - h, width: 12, height: h, fill: '#9a9d9f', stroke: '#7c7f81' }, svg);
    }
    if (backfilled) {
      el('rect', { x: X0 - 30, y: GR + 1, width: (X1 - X0) + 60, height: 60, fill: C.earth }, svg);
      el('line', { x1: X0 - 30, y1: GR, x2: X1 + 30, y2: GR, stroke: '#a89f88', 'stroke-width': 1.4 }, svg);
    }
    var ps = role(g, 'slab', 'L1');
    if (ps > 0) el('rect', { x: X0 - 3, y: GR - 7, width: (X1 - X0 + 6) * ps, height: 8, fill: C.concrete, stroke: C.concreteDark }, svg);
  }

  function drawStructure(svg, g, G) {
    var X0 = G.X0, X1 = G.X1, W = X1 - X0;
    G.levels.forEach(function (z) {
      var y0 = G.L[z][0], y1 = G.L[z][1];
      var ps = role(g, 'structure', z);
      if (ps > 0) {
        var ncol = 6, shown = Math.max(1, Math.round(ncol * ps));
        for (var i = 0; i < shown; i++) {
          var cx = X0 + 10 + i * ((W - 20) / (ncol - 1));
          el('rect', { x: cx - 3.5, y: y1, width: 7, height: y0 - y1, fill: C.steel, stroke: C.steelDark, 'stroke-width': .6 }, svg);
        }
        if (ps > .5) el('rect', { x: X0, y: y1, width: W * clamp01((ps - .5) / .5), height: 5, fill: C.steelDark }, svg);
      }
      var pd = role(g, 'deck', z);
      if (pd > 0) el('rect', { x: X0, y: y1 - 7, width: W * pd, height: 7, fill: C.concrete, stroke: C.concreteDark }, svg);
    });
  }

  function drawRoof(svg, g, G) {
    var X0 = G.X0, X1 = G.X1, W = X1 - X0, top = G.PARAPET;
    var pr = role(g, 'roofing');
    /* a project with no separate roof-deck activity still gets a deck
       under its membrane, so the roof never floats */
    var pd = hasRole(g, 'roofdeck') ? role(g, 'roofdeck') : pr;
    if (pd > 0) el('rect', { x: X0, y: top + 3, width: W * pd, height: 7, fill: C.concrete, stroke: C.concreteDark }, svg);
    if (pr > 0) {
      el('rect', { x: X0, y: top - 3, width: W * pr, height: 6, fill: C.roof }, svg);
      el('rect', { x: X0 - 5, y: top - 10, width: (W + 10) * pr, height: 8, fill: '#6a625c' }, svg);
    }
    if (roleDone(g, hasRole(g, 'roofdeck') ? 'roofdeck' : 'roofing')) {
      /* the topping-out tradition: an evergreen and a flag on the last
         beam — the flag, naturally, is navy and gold */
      var fx = X1 - 22;
      el('line', { x1: fx, y1: top - 10, x2: fx, y2: top - 46, stroke: C.steel, 'stroke-width': 2 }, svg);
      el('path', { d: 'M' + fx + ',' + (top - 46) + ' l26,6 l-26,6 z', fill: C.navy }, svg);
      el('path', { d: 'M' + fx + ',' + (top - 43) + ' l17,3.2 l-17,3.6 z', fill: C.gold }, svg);
      var tx2 = X1 - 46;
      el('rect', { x: tx2 - 1.4, y: top - 20, width: 2.8, height: 8, fill: '#6d4a2f' }, svg);
      el('path', { d: 'M' + tx2 + ' ' + (top - 40) + ' l7 10 l-4.5 0 l6 9 l-17 0 l6 -9 l-4.5 0 z', fill: '#2f6b3a', stroke: '#245229', 'stroke-width': .7 }, svg);
    }
  }

  function drawEnvelope(svg, g, G) {
    var GR = G.GROUND, CUT = G.CUT, X1 = G.X1, top = G.PARAPET;
    var p1 = role(g, 'sheathing'), p2 = role(g, 'glazing');
    if (p1 > 0) {
      /* campus brick with limestone bands at the floor lines — this is
         a Murray State building and it should look like one */
      var h = (GR - top) * p1;
      var grp = el('g', null, svg);
      el('rect', { x: CUT, y: GR - h, width: X1 - CUT, height: h, fill: 'url(#brickp)', stroke: C.brickDark, 'stroke-width': 1 }, grp);
      G.levels.forEach(function (z) {
        var yb = G.L[z][1];
        if (yb > GR - h) el('rect', { x: CUT, y: yb - 2, width: X1 - CUT, height: 5, fill: C.stone, stroke: '#c4bba6', 'stroke-width': .5 }, grp);
      });
      el('rect', { x: CUT, y: GR - 6, width: X1 - CUT, height: 6, fill: C.stone, opacity: p1 > 0.1 ? 1 : 0 }, grp);
    }
    if (p2 > 0) {
      var cols = 2, rows = G.levels.length, made = Math.round(cols * rows * p2), k = 0;
      var gw = (X1 - CUT - 16) / cols, gh = Math.min(58, G.bandH - 24);
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          if (k++ >= made) break;
          var gx = CUT + 8 + c * gw, gy = G.L[G.levels[r]][1] + 14;
          el('rect', { x: gx, y: gy, width: gw - 8, height: gh, fill: C.glass, stroke: C.glassEdge, opacity: .93 }, svg);
          el('line', { x1: gx + 2, y1: gy + 10, x2: gx + gw - 12, y2: gy + 26, stroke: '#cfe4ef', 'stroke-width': 2, opacity: .75 }, svg);
        }
      }
    }
  }

  function drawInteriors(svg, g, G) {
    var X0 = G.X0, CUT = hasRole(g, 'sheathing') ? G.CUT : G.X1;
    G.levels.forEach(function (z) {
      var y0 = G.L[z][0], y1 = G.L[z][1], iw = CUT - X0 - 12;
      var pf = role(g, 'finishes', z);
      if (pf > 0) el('rect', { x: X0 + 6, y: y1 + 10, width: iw * pf, height: y0 - y1 - 12, fill: '#e8f0e6', opacity: .8 }, svg);
      var pm = role(g, 'mep', z);
      if (pm > 0) {
        el('rect', { x: X0 + 6, y: y1 + 12, width: iw * pm, height: 7, fill: C.mep, opacity: .9 }, svg);
        for (var d = 0; d < 4 * pm; d++) {
          el('rect', { x: X0 + 18 + d * 34, y: y1 + 19, width: 2.5, height: 9, fill: C.mep, opacity: .7 }, svg);
        }
      }
      var pd = role(g, 'partitions', z);
      if (pd > 0) {
        var sh = Math.max(1, Math.round(4 * pd));
        for (var i = 0; i < sh; i++) {
          el('rect', { x: X0 + 24 + i * 40, y: y1 + 30, width: 4, height: (y0 - y1 - 34), fill: C.dry, opacity: .95 }, svg);
        }
      }
      if (pf > 0) el('rect', { x: X0 + 6, y: y0 - 12, width: iw * pf, height: 4, fill: C.fin, opacity: .8 }, svg);
    });
  }

  function drawElevator(svg, g, G) {
    if (!hasRole(g, 'elevator')) return;
    var GR = G.GROUND, x = G.CUT - 30, p = role(g, 'elevator');
    if (p <= 0) return;
    el('rect', { x: x, y: G.PARAPET + 6, width: 22, height: GR - G.PARAPET - 6, fill: 'none', stroke: '#98939f', 'stroke-width': 1, 'stroke-dasharray': '3 3' }, svg);
    var h = (GR - G.PARAPET - 6) * p;
    el('rect', { x: x, y: GR - h, width: 22, height: h, fill: C.elev, opacity: .3 }, svg);
    el('rect', { x: x + 3, y: GR - h + 4, width: 16, height: 18, fill: C.elev, opacity: .85 }, svg);
    txt(svg, x + 11, GR - h - 4, 'ELEV', { fill: '#7a7686', 'font-size': 6.5, 'font-family': 'monospace', 'text-anchor': 'middle' });
  }

  /* The crane goes up for steel and comes down when the roof is on,
     which is roughly when a real one would. */
  function drawCrane(svg, g, G) {
    if (!(role(g, 'structure') > 0 && !roleDone(g, 'roofing'))) return;
    var GR = G.GROUND, mx = 578, top = Math.min(G.PARAPET - 34, 52);
    var gc = el('g', null, svg);
    /* lattice tower */
    el('rect', { x: mx - 5, y: top, width: 10, height: GR - top, fill: C.gold, stroke: C.goldDark, 'stroke-width': 1 }, gc);
    for (var yy = top + 8; yy < GR - 8; yy += 14) {
      el('line', { x1: mx - 5, y1: yy, x2: mx + 5, y2: yy + 10, stroke: C.goldDark, 'stroke-width': 1 }, gc);
      el('line', { x1: mx + 5, y1: yy, x2: mx - 5, y2: yy + 10, stroke: C.goldDark, 'stroke-width': 1 }, gc);
    }
    /* jib + counterjib + counterweight + cab */
    el('rect', { x: mx - 96, y: top - 7, width: 158, height: 6, fill: C.gold, stroke: C.goldDark, 'stroke-width': 1 }, gc);
    for (var xx = mx - 90; xx < mx + 56; xx += 13) {
      el('line', { x1: xx, y1: top - 7, x2: xx + 9, y2: top - 1, stroke: C.goldDark, 'stroke-width': .8 }, gc);
    }
    el('rect', { x: mx + 46, y: top - 3, width: 18, height: 12, fill: '#5f6b78', stroke: '#43505e', 'stroke-width': 1 }, gc);
    el('path', { d: 'M' + mx + ' ' + (top - 7) + ' L' + mx + ' ' + (top - 22) + ' L' + (mx - 88) + ' ' + (top - 6) + ' M' + mx + ' ' + (top - 22) + ' L' + (mx + 58) + ' ' + (top - 6), stroke: C.goldDark, 'stroke-width': 1 }, gc);
    el('rect', { x: mx - 1, y: top - 24, width: 3, height: 4, fill: C.crewOver }, gc);
    el('rect', { x: mx + 6, y: top - 1, width: 11, height: 10, rx: 1.6, fill: C.navy, stroke: '#0e2f52', 'stroke-width': 1 }, gc);
    el('rect', { x: mx + 8, y: top + 1, width: 5, height: 4, fill: C.glass }, gc);
    /* hook with a beam on it */
    var hx = mx - 62, hookY = top + 34;
    el('line', { x1: hx, y1: top - 1, x2: hx, y2: hookY, stroke: '#43505e', 'stroke-width': 1.2 }, gc);
    el('path', { d: 'M' + hx + ' ' + hookY + ' q-3 4 1 6', stroke: '#43505e', 'stroke-width': 2, fill: 'none' }, gc);
    el('rect', { x: hx - 16, y: hookY + 7, width: 32, height: 4, fill: C.steel, stroke: C.steelDark, 'stroke-width': .8 }, gc);
  }

  /* ---- crews ---------------------------------------------------------
     Markers stand on the floor of the zone they work, tagged with the
     trade, so an overloaded floor is visibly overloaded and a floor with
     open work and nobody on it is visibly empty.                        */
  function crewMap(g, cpm) {
    var perZone = {}, openZone = {};
    g.net.activities.forEach(function (a) {
      var s = g.state[a.id];
      if (s.finishDay !== null) return;
      var r = cpm.results[a.id];
      if (!a.fixed && a.trade && r && r.es < g.day + 5) openZone[a.zone] = (openZone[a.zone] || 0) + 1;
      var c = Math.min(g.alloc[a.id] || 0, a.maxCrews || 1);
      if (c > 0 && !a.fixed && a.trade) {
        perZone[a.zone] = perZone[a.zone] || { n: 0, trades: {} };
        perZone[a.zone].n += c;
        perZone[a.zone].trades[a.trade] = (perZone[a.zone].trades[a.trade] || 0) + c;
      }
    });
    return { perZone: perZone, openZone: openZone };
  }

  function drawCrews(svg, g, G, cpm) {
    var m = crewMap(g, cpm);
    var BOX = { SITE: [G.X0 + 4, G.GROUND + 10, 190] };
    G.levels.forEach(function (z) { BOX[z] = [G.X0 + 10, G.L[z][0] - 26, 170]; });
    if (hasZone(g, 'ROOF')) BOX.ROOF = [G.X0 + 14, G.PARAPET - 36, 150];
    if (hasZone(g, 'EXT')) BOX.EXT = [G.X1 + 10, G.GROUND - (G.GROUND - G.PARAPET) * 0.55, 74];

    Object.keys(BOX).forEach(function (z) {
      var box = BOX[z], info = m.perZone[z] || { n: 0, trades: {} };
      var total = info.n, cap = g.zones[z] ? g.zones[z].cap : 2;

      if (!total) {
        if (m.openZone[z]) {
          el('rect', {
            x: box[0] - 4, y: box[1] - 4, width: box[2], height: 26,
            fill: '#b06f10', 'fill-opacity': .10, stroke: C.idle,
            'stroke-width': 1.3, 'stroke-dasharray': '5 3', rx: 2
          }, svg);
          txt(svg, box[0] + 3, box[1] + 13, 'WORK OPEN — NO CREW', {
            fill: C.idle, 'font-size': 8, 'font-family': 'monospace', 'font-weight': 'bold'
          });
        }
        return;
      }

      if (z === 'EXT') {                       // swing stage against the facade
        el('line', { x1: G.X1, y1: box[1] - 8, x2: G.X1 + 62, y2: box[1] - 8, stroke: '#8b8370', 'stroke-width': 1 }, svg);
        el('line', { x1: G.X1 + 8, y1: box[1] - 8, x2: G.X1 + 8, y2: G.PARAPET + 4, stroke: '#8b8370', 'stroke-width': .8 }, svg);
        el('line', { x1: G.X1 + 54, y1: box[1] - 8, x2: G.X1 + 54, y2: G.PARAPET + 4, stroke: '#8b8370', 'stroke-width': .8 }, svg);
        el('rect', { x: G.X1 + 4, y: box[1] + 20, width: 58, height: 4, fill: '#9a9280' }, svg);
      }

      var over = total > cap;
      if (over) {
        el('rect', {
          x: box[0] - 5, y: box[1] - 5, width: box[2] + 2, height: 28,
          fill: C.crewOver, 'fill-opacity': .14, stroke: C.crewOver, 'stroke-width': 1.2, rx: 2
        }, svg);
      }
      var i = 0;
      Object.keys(info.trades).forEach(function (tr) {
        for (var k = 0; k < info.trades[tr]; k++) {
          var step = over ? 17 : 24;
          var cx = box[0] + 12 + i * step;
          var feetY = box[1] + 22;
          worker(svg, cx, feetY, { over: over, pose: (i + (tr.length % 3)) % 3 });
          if (k === 0) {
            var lab = el('g', null, svg);
            el('rect', { x: cx - 12, y: feetY + 2, width: 24, height: 8, rx: 2, fill: over ? C.crewOver : C.navy, opacity: .92 }, lab);
            txt(lab, cx, feetY + 8, (g.trades[tr].short || tr).slice(0, 6), {
              fill: over ? '#fff' : C.gold, 'font-size': 5.6, 'font-family': 'monospace',
              'text-anchor': 'middle', 'font-weight': 'bold'
            });
          }
          i++;
        }
      });
      if (over) {
        txt(svg, box[0] + box[2] - 6, box[1] - 8, 'STACKED ' + total + '/' + cap, {
          fill: C.crewOver, 'font-size': 8, 'font-weight': 'bold',
          'font-family': 'monospace', 'text-anchor': 'end'
        });
      }
    });
  }

  /* ---- per-level status in the left margin --------------------------- */
  function drawLevelTags(svg, g, G) {
    var IN = ['structure', 'deck', 'slab', 'mep', 'partitions', 'finishes'];
    G.levels.forEach(function (z) {
      var y1 = G.L[z][1], t = 0, n = 0;
      IN.forEach(function (r) {
        g.net.activities.forEach(function (a) {
          if (a.role !== r || a.zone !== z) return;
          t += pct(g, a.id); n++;
        });
      });
      var p = n ? t / n : 0, x = G.X0 - 66;
      txt(svg, x, y1 + 20, z, { fill: '#5d6b7d', 'font-size': 13, 'font-weight': 'bold', 'font-family': 'monospace' });
      el('rect', { x: x, y: y1 + 26, width: 46, height: 6, fill: '#d5dae0', rx: 1 }, svg);
      el('rect', { x: x, y: y1 + 26, width: 46 * p, height: 6, fill: p >= 1 ? '#2f6b3a' : '#2f6fa8', rx: 1 }, svg);
      txt(svg, x, y1 + 42, Math.round(p * 100) + '% built', { fill: '#77839a', 'font-size': 7.5, 'font-family': 'monospace' });
    });

    var st = 0, sn = 0;
    ['excavate', 'footing', 'wall', 'backfill', 'underground', 'sitework'].forEach(function (r) {
      g.net.activities.forEach(function (a) { if (a.role === r) { st += pct(g, a.id); sn++; } });
    });
    var ps = sn ? st / sn : 0;
    txt(svg, G.X0 - 66, G.GROUND + 22, 'SITE', { fill: '#5d6b7d', 'font-size': 11, 'font-weight': 'bold', 'font-family': 'monospace' });
    el('rect', { x: G.X0 - 66, y: G.GROUND + 28, width: 46, height: 6, fill: '#c9c2b0', rx: 1 }, svg);
    el('rect', { x: G.X0 - 66, y: G.GROUND + 28, width: 46 * ps, height: 6, fill: ps >= 1 ? '#2f6b3a' : '#a9761f', rx: 1 }, svg);
  }

  /* ---- colour key: only what this project actually draws ------------- */
  function drawKey(svg, g, G) {
    var candidates = [
      ['structure', 'Structure', C.steel], ['deck', 'Deck / slab', C.concrete],
      ['slab', 'Deck / slab', C.concrete], ['mep', 'MEP rough-in', C.mep],
      ['partitions', 'Drywall', C.dry], ['finishes', 'Finishes', C.fin],
      ['roofing', 'Roofing', C.roof], ['sheathing', 'Brick veneer', C.brick],
      ['glazing', 'Glazing', C.glass]
    ];
    var seen = {}, items = [];
    candidates.forEach(function (c) {
      if (!hasRole(g, c[0]) || seen[c[1]]) return;
      seen[c[1]] = true; items.push([c[1], c[2]]);
    });
    var gk = el('g', null, svg), x = 24, y = 386;
    items.forEach(function (it) {
      el('rect', { x: x, y: y - 7, width: 11, height: 8, fill: it[1], stroke: '#8c93a0', 'stroke-width': .5 }, gk);
      txt(gk, x + 15, y, it[0], { fill: '#6b7686', 'font-size': 8, 'font-family': 'monospace' });
      x += 24 + it[0].length * 5.1;
    });
  }

  /* ---- zone occupancy strip ------------------------------------------ */
  function buildZoneStrip(g, cpm) {
    var strip = document.createElement('div');
    strip.id = 'zone-strip';
    var m = crewMap(g, cpm);

    Object.keys(g.zones).forEach(function (z) {
      if (!hasZone(g, z)) return;          // do not advertise floors this project has not got
      var info = m.perZone[z] || { n: 0, trades: {} };
      var cap = g.zones[z].cap;
      var d = document.createElement('div');
      var state = info.n > cap ? 'over' : (info.n === 0 && m.openZone[z] ? 'idle' : '');
      d.className = 'zone-chip ' + state;
      var who = Object.keys(info.trades).map(function (t) {
        return '<span class="ztag">' + (g.trades[t].short || t) +
          (info.trades[t] > 1 ? '×' + info.trades[t] : '') + '</span>';
      }).join('');
      var pips = '';
      for (var i = 0; i < Math.max(info.n, cap); i++) {
        pips += '<span class="dot' + (i >= info.n ? ' cap' : (info.n > cap ? ' over' : '')) + '"></span>';
      }
      d.innerHTML =
        '<div class="zn">' + z + ' · ' + g.zones[z].name + '</div>' +
        '<div class="zc">' + info.n + ' of ' + cap + ' crew slots' +
          (info.n > cap ? ' — STACKED' : (state === 'idle' ? ' — work open, nobody on it' : '')) + '</div>' +
        '<div class="dots">' + pips + '</div>' +
        (who ? '<div class="ztags">' + who + '</div>' : '');
      strip.appendChild(d);
    });
    return strip;
  }

  return { render: render, pct: pct, geometry: geometry, role: role };
})();
