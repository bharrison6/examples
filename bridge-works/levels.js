/* Bridge Works — levels, vehicles and the famous-truss gallery.
   Dual-export: window.BWLEVELS in the browser, require() in Node. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BWLEVELS = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

var GRID = 0.5;              // m — placement snap
var MAX_MEMBER_LEN = 4.0;    // m — struts come in stock lengths; keeps panels sane

/* --------------------------------------------------------------- vehicles */
/* axles: dx = distance BEHIND the front axle, P = wheel load in newtons */
var VEHICLES = {
  car: {
    key: 'car', name: 'Compact car', mass: '3.1 t', colour: '#f2b134',
    hgt: 1.4, axles: [{ dx: 0, P: 15e3 }, { dx: 2.6, P: 15e3 }]
  },
  van: {
    key: 'van', name: 'Delivery van', mass: '6.1 t', colour: '#e8734a',
    hgt: 2.0, axles: [{ dx: 0, P: 25e3 }, { dx: 3.4, P: 35e3 }]
  },
  tipper: {
    key: 'tipper', name: 'Loaded tipper', mass: '12.2 t', colour: '#c9683a',
    hgt: 2.4, axles: [{ dx: 0, P: 50e3 }, { dx: 3.2, P: 70e3 }]
  },
  truck: {
    key: 'truck', name: 'Loaded truck', mass: '12.7 t', colour: '#d94f4f',
    hgt: 2.6, axles: [{ dx: 0, P: 35e3 }, { dx: 4.6, P: 45e3 }, { dx: 5.9, P: 45e3 }]
  },
  crane: {
    key: 'crane', name: 'Mobile crane', mass: '20.4 t', colour: '#b03a8b',
    hgt: 3.0, axles: [{ dx: 0, P: 50e3 }, { dx: 5.0, P: 75e3 }, { dx: 6.4, P: 75e3 }]
  }
};
function vehicleWeight(v) {
  var s = 0; for (var i = 0; i < v.axles.length; i++) s += v.axles[i].P; return s;
}
function vehicleLength(v) { return v.axles[v.axles.length - 1].dx; }
/* overall body length: wheelbase plus an overhang at each end. Also decides
   whether a vehicle is even worth offering on a given span. */
function vehicleBody(v) { return vehicleLength(v) + 1.4; }

/* ----------------------------------------------------------------- levels */
/* anchors are fixed by the level and cannot be deleted.
   build: the rectangle new nodes may be placed in (ymin excludes below-deck
   building on the clearance level). */
var LEVELS = [
  {
    id: 'gap6', n: 1, name: 'First Crossing',
    blurb: 'A short gap and a light car. Get something across.',
    lesson: 'A flat roadway alone is a mechanism — it has to be held up by something.',
    deckY: 0, gap: { x0: 5, x1: 11 },
    anchors: [{ x: 5, y: 0, type: 'pin' }, { x: 11, y: 0, type: 'roller' }],
    build: { xmin: 5, xmax: 11, ymin: -3, ymax: 3.5 },
    vehicle: 'car', par: 1050,
    hint: 'Try a single triangle: two deck pieces, a post above the middle, and two struts down to the abutments.'
  },
  {
    id: 'gap12', n: 2, name: 'The Long Gap',
    blurb: 'Twice the span. We have started you off with a rectangular frame — test it first and watch what happens.',
    lesson: 'Rectangles fold. Triangles cannot change shape without changing a member length.',
    deckY: 0, gap: { x0: 2, x1: 14 },
    anchors: [{ x: 2, y: 0, type: 'pin' }, { x: 14, y: 0, type: 'roller' }],
    build: { xmin: 2, xmax: 14, ymin: -4, ymax: 5 },
    vehicle: 'car', par: 2800,
    hint: 'Every four-sided panel needs a diagonal. Add them, then look at which members are barely working and delete those.',
    starter: 'ladder'
  },
  {
    id: 'heavy', n: 3, name: 'Heavy Haul',
    blurb: 'A 12.7 tonne truck. The same shape that carried a car may not carry this.',
    lesson: 'Capacity, not just stability. Long compression members buckle first.',
    deckY: 0, gap: { x0: 3, x1: 13 },
    anchors: [{ x: 3, y: 0, type: 'pin' }, { x: 13, y: 0, type: 'roller' }],
    build: { xmin: 3, xmax: 13, ymin: -4, ymax: 5 },
    vehicle: 'truck', par: 2800,
    hint: 'Shorten your compression members. A deeper truss lowers chord forces; more panels shorten each strut.'
  },
  {
    id: 'clearance', n: 4, name: 'High Water',
    blurb: 'The river is up. Nothing may be built below the roadway.',
    lesson: 'When you cannot go under, you go over — a through truss or a bowstring arch.',
    deckY: 0, gap: { x0: 2, x1: 14 },
    anchors: [{ x: 2, y: 0, type: 'pin' }, { x: 14, y: 0, type: 'roller' }],
    build: { xmin: 2, xmax: 14, ymin: 0, ymax: 6 },
    vehicle: 'van', par: 3100,
    hint: 'A bowstring: curve a compression chord over the deck and let the deck itself act as the tie holding its feet together.'
  },
  {
    id: 'pier', n: 5, name: 'Island Pier',
    blurb: 'A wide canyon, but there is rock at the middle. A third anchor sits on the pier.',
    lesson: 'Halving the span halves the bending demand — supports are cheaper than steel.',
    deckY: 0, gap: { x0: 1, x1: 17 },
    anchors: [{ x: 1, y: 0, type: 'pin' }, { x: 9, y: 0, type: 'roller' }, { x: 17, y: 0, type: 'roller' }],
    pier: { x: 9, top: 0, bottom: -6.5, w: 1.6 },
    build: { xmin: 1, xmax: 17, ymin: -4.5, ymax: 5 },
    vehicle: 'truck', par: 3600,
    hint: 'Treat it as two short bridges that happen to share a deck.'
  },
  {
    id: 'sandbox', n: 6, name: 'Sandbox',
    blurb: 'No par, no limits. Pick a vehicle and find out.',
    lesson: 'Free build.',
    deckY: 0, gap: { x0: 1, x1: 19 },
    anchors: [{ x: 1, y: 0, type: 'pin' }, { x: 19, y: 0, type: 'roller' }],
    build: { xmin: 1, xmax: 19, ymin: -6, ymax: 7 },
    vehicle: 'truck', par: null, sandbox: true,
    hint: 'Try the gallery trusses at different depths and compare their peak member forces.'
  }
];

/* ------------------------------------------------- starter configurations */
/* The deliberately un-triangulated frame that level 2 hands the student. */
function ladderStarter(level) {
  var x0 = level.gap.x0, x1 = level.gap.x1, h = 2.5, p = 3;
  var n = Math.round((x1 - x0) / p);
  var nodes = [], members = [], bot = [], top = [];
  for (var i = 0; i <= n; i++) { bot.push(nodes.length); nodes.push({ x: x0 + i * p, y: 0 }); }
  for (i = 0; i <= n; i++) { top.push(nodes.length); nodes.push({ x: x0 + i * p, y: h }); }
  for (i = 0; i < n; i++) { members.push([bot[i], bot[i + 1]]); members.push([top[i], top[i + 1]]); }
  for (i = 0; i <= n; i++) members.push([bot[i], top[i]]);
  return { nodes: nodes, members: members };
}

/* ------------------------------------------------------- truss generators */
/* All three are THROUGH trusses: the roadway is the bottom chord, so they are
   legal on every level including the no-building-below-deck one. */
function pratt(x0, x1, h, n, howe) {
  var p = (x1 - x0) / n, nodes = [], members = [], bot = [], top = [], i;
  for (i = 0; i <= n; i++) { bot.push(nodes.length); nodes.push({ x: x0 + i * p, y: 0 }); }
  for (i = 1; i <= n - 1; i++) { top.push(nodes.length); nodes.push({ x: x0 + i * p, y: h }); }
  var T = function (i) { return top[i - 1]; };            // top node above panel point i
  for (i = 0; i < n; i++) members.push([bot[i], bot[i + 1]]);          // deck
  for (i = 1; i <= n - 2; i++) members.push([T(i), T(i + 1)]);          // top chord
  for (i = 1; i <= n - 1; i++) members.push([T(i), bot[i]]);            // verticals
  members.push([bot[0], T(1)]);                                        // end posts
  members.push([bot[n], T(n - 1)]);
  for (var j = 1; j <= n - 2; j++) {                                    // interior diagonals
    var leftHalf = j < n / 2;
    if (howe) leftHalf = !leftHalf;
    members.push(leftHalf ? [T(j), bot[j + 1]] : [T(j + 1), bot[j]]);
  }
  return { nodes: nodes, members: members };
}
function warren(x0, x1, h, n) {
  var p = (x1 - x0) / n, nodes = [], members = [], bot = [], top = [], i;
  for (i = 0; i <= n; i++) { bot.push(nodes.length); nodes.push({ x: x0 + i * p, y: 0 }); }
  for (i = 0; i < n; i++) { top.push(nodes.length); nodes.push({ x: x0 + (i + 0.5) * p, y: h }); }
  for (i = 0; i < n; i++) members.push([bot[i], bot[i + 1]]);
  for (i = 0; i < n - 1; i++) members.push([top[i], top[i + 1]]);
  for (i = 0; i < n; i++) { members.push([bot[i], top[i]]); members.push([top[i], bot[i + 1]]); }
  return { nodes: nodes, members: members };
}
/* a bowstring / tied arch: curved top chord, hangers down to the deck */
function bowstring(x0, x1, h, n) {
  var p = (x1 - x0) / n, nodes = [], members = [], bot = [], top = [], i;
  for (i = 0; i <= n; i++) { bot.push(nodes.length); nodes.push({ x: x0 + i * p, y: 0 }); }
  for (i = 1; i <= n - 1; i++) {
    var t = i / n, y = 4 * h * t * (1 - t);
    top.push(nodes.length); nodes.push({ x: x0 + i * p, y: Math.round(y / GRID) * GRID });
  }
  for (i = 0; i < n; i++) members.push([bot[i], bot[i + 1]]);
  for (i = 0; i < top.length - 1; i++) members.push([top[i], top[i + 1]]);
  members.push([bot[0], top[0]]);
  members.push([bot[n], top[top.length - 1]]);
  for (i = 1; i <= n - 1; i++) members.push([top[i - 1], bot[i]]);
  for (var j = 1; j <= n - 2; j++) members.push([top[j - 1], bot[j + 1]]);
  return { nodes: nodes, members: members };
}

var GALLERY = [
  { key: 'pratt', name: 'Pratt', year: '1844',
    note: 'Verticals take compression, diagonals take tension. Diagonals slope DOWN toward mid-span. Cheap when steel is strong in tension and you can use thin rods for the diagonals.',
    build: function (x0, x1, h, n) { return pratt(x0, x1, h, n, false); } },
  { key: 'howe', name: 'Howe', year: '1840',
    note: 'The mirror of the Pratt: diagonals slope UP toward mid-span and go into compression, verticals into tension. It made sense in timber, where long compression diagonals were the cheap part.',
    build: function (x0, x1, h, n) { return pratt(x0, x1, h, n, true); } },
  { key: 'warren', name: 'Warren', year: '1848',
    note: 'No verticals at all — just alternating diagonals. Adjacent diagonals alternate tension and compression, so the whole truss is equilateral triangles.',
    build: warren },
  { key: 'bowstring', name: 'Bowstring arch', year: '1841',
    note: 'A curved compression chord tied by the deck. The arch wants to spread; the deck holds it in, so the deck is in tension.',
    build: bowstring }
];

/* snap a generated truss onto the grid */
function snapDesign(d) {
  for (var i = 0; i < d.nodes.length; i++) {
    d.nodes[i].x = Math.round(d.nodes[i].x / GRID) * GRID;
    d.nodes[i].y = Math.round(d.nodes[i].y / GRID) * GRID;
  }
  return d;
}

return {
  GRID: GRID, MAX_MEMBER_LEN: MAX_MEMBER_LEN,
  VEHICLES: VEHICLES, LEVELS: LEVELS, GALLERY: GALLERY,
  vehicleWeight: vehicleWeight, vehicleLength: vehicleLength, vehicleBody: vehicleBody,
  pratt: pratt, warren: warren, bowstring: bowstring,
  ladderStarter: ladderStarter, snapDesign: snapDesign
};
});
