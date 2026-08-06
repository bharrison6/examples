/* =====================================================================
   TOPPING OUT — VIEWS
   The 4D cutaway, the Gantt chart and the network diagram.

   All three read the same live CPM result, so the critical path shown
   in one is by construction the critical path shown in the others.
   ===================================================================== */
'use strict';

var TO = (typeof TO !== 'undefined' && TO) || {};

TO.Views = (function () {

  var SVGNS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

  /* Fraction complete of an activity, 0..1 */
  function pct(g, id) {
    var s = g.state[id], a = g.byId[id];
    if (!s || !a) return 0;
    if (s.finishDay !== null) return 1;
    if (s.startedDay === null) return 0;
    var total = a.work + (s.holdExtra || 0);
    if (total <= 0) return 1;
    return clamp01((total - s.remaining - (s.holdExtra || 0)) / total);
  }
  function anyPct(g, ids) {
    var t = 0, n = 0;
    for (var i = 0; i < ids.length; i++) { if (g.byId[ids[i]]) { t += pct(g, ids[i]); n++; } }
    return n ? t / n : 0;
  }

  /* =================================================================
     4D CUTAWAY
     A stylised section through the building, driven entirely by
     activity progress. Excavation opens, foundations pour, structure
     rises floor by floor, the envelope closes, interiors fill in.
     Crews appear as markers in the zone they are working, so trade
     stacking is visible as overcrowding and a stalled work front is
     visible as an empty floor with an amber dashed outline.
     ================================================================= */
  /* The cutaway lives in render4d.js — it is big enough to deserve
     its own file, and it is the view students look at most. */
  function render4D(host, g, cpm) { return TO.View4D.render(host, g, cpm); }

  /* =================================================================
     GANTT
     Bars from ES to EF, float shown as a thin tail out to LF, critical
     work in red, non-compressible holds hatched. Today and the
     contract date are both marked.
     ================================================================= */
  function renderGantt(host, g, cpm) {
    host.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.id = 'gantt';
    host.appendChild(wrap);

    var horizon = Math.max(cpm.projectEnd, g.net.contractWorkingDays) + 4;
    var trackW = Math.max(420, host.clientWidth - 290);
    var ppd = trackW / horizon;

    var head = document.createElement('div');
    head.id = 'gantt-head';
    var weeks = '';
    for (var w = 0; w <= horizon; w += 5) {
      weeks += '<div class="g-grid" style="left:' + (w * ppd) + 'px"></div>' +
        '<div class="g-week" style="left:' + (w * ppd + 2) + 'px">' + (w / 5 + 1) + '</div>';
    }
    head.innerHTML = '<div class="g-lab">Activity</div><div class="g-float">Float</div>' +
      '<div class="g-track">' + weeks +
      '<div class="g-today" style="left:' + (g.day * ppd) + 'px"></div>' +
      '<div class="g-deadline" style="left:' + (g.net.contractWorkingDays * ppd) + 'px"></div></div>';
    wrap.appendChild(head);

    var rows = g.net.activities.slice().sort(function (a, b) {
      return cpm.results[a.id].es - cpm.results[b.id].es || cpm.results[a.id].ef - cpm.results[b.id].ef;
    });

    rows.forEach(function (a) {
      var r = cpm.results[a.id], s = g.state[a.id];
      var row = document.createElement('div');
      row.className = 'g-row';
      row.title = a.name + '  ·  ES ' + r.es + ' EF ' + r.ef + ' / LS ' + r.ls + ' LF ' + r.lf +
        '\nTotal float ' + r.tf + ' wd, free float ' + r.ff + ' wd' +
        (a.fixed ? '\nNon-compressible ' + (a.kind === 'cure' ? 'cure time' : 'inspection hold') : '');

      var done = s.finishDay !== null;
      var p = pct(g, a.id);
      var bw = Math.max(3, r.dur * ppd);
      var floatW = Math.max(0, (r.lf - r.ef)) * ppd;

      row.innerHTML =
        '<div class="g-lab"><span class="id">' + a.id + '</span>' + a.name + '</div>' +
        '<div class="g-float">' + (done ? '—' : (r.tf === 0 ? 'CP' : r.tf + ' wd')) + '</div>' +
        '<div class="g-track">' +
          (floatW > 1 && !done ? '<div class="g-floatbar" style="left:' + (r.ef * ppd) + 'px;width:' + floatW + 'px"></div>' : '') +
          '<div class="g-bar' + (r.tf === 0 ? ' crit' : '') + (a.fixed ? ' fixed' : '') + (done ? ' done' : '') +
            '" style="left:' + (r.es * ppd) + 'px;width:' + bw + 'px">' +
            (p > 0 && p < 1 ? '<div class="g-prog" style="left:' + (p * 100) + '%;right:0"></div>' : '') +
          '</div>' +
        '</div>';
      wrap.appendChild(row);
    });
  }

  /* =================================================================
     NETWORK DIAGRAM
     Nodes placed by early start, packed into lanes. Relationship type
     and lag are drawn on the arrows; the driving path is thick and red.
     ================================================================= */
  function renderNetwork(host, g, cpm) {
    host.innerHTML = '';
    var horizon = cpm.projectEnd + 4;
    var ppd = 11, NW = 62, NH = 30, LANE = 46;

    var order = g.net.activities.slice().sort(function (a, b) {
      return cpm.results[a.id].es - cpm.results[b.id].es;
    });
    var lanes = [], pos = {};
    order.forEach(function (a) {
      var r = cpm.results[a.id];
      var x = r.es * ppd;
      var w = Math.max(NW, r.dur * ppd);
      var li = 0;
      while (lanes[li] != null && lanes[li] > x - 10) li++;
      lanes[li] = x + w;
      pos[a.id] = { x: x, y: 18 + li * LANE, w: w, lane: li };
    });

    var height = 18 + lanes.length * LANE + 30;
    var width = Math.max(host.clientWidth, horizon * ppd + NW + 40);
    var svg = el('svg', { id: 'network-svg', width: width, height: height, viewBox: '0 0 ' + width + ' ' + height });
    host.appendChild(svg);

    var defs = el('defs', null, svg);
    ['#77839a', '#b3261e'].forEach(function (col, i) {
      var m = el('marker', {
        id: 'arw' + i, viewBox: '0 0 10 10', refX: 9, refY: 5,
        markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse'
      }, defs);
      el('path', { d: 'M0,0 L10,5 L0,10 z', fill: col }, m);
    });

    var chainSet = {};
    for (var i = 0; i < cpm.chain.length - 1; i++) chainSet[cpm.chain[i] + '>' + cpm.chain[i + 1]] = true;

    /* edges first so nodes sit on top */
    g.net.activities.forEach(function (a) {
      (a.preds || []).forEach(function (p) {
        var from = pos[p.id], to = pos[a.id];
        if (!from || !to) return;
        var crit = !!chainSet[p.id + '>' + a.id];
        var x1 = from.x + from.w, y1 = from.y + NH / 2;
        var x2 = to.x, y2 = to.y + NH / 2;
        if (p.type === 'SS') { x1 = from.x; }
        if (p.type === 'FF') { x2 = to.x + to.w; }
        var mx = (x1 + x2) / 2;
        el('path', {
          d: 'M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2,
          class: 'n-edge' + (crit ? ' crit' : ''),
          'marker-end': 'url(#arw' + (crit ? 1 : 0) + ')'
        }, svg);
        if (p.type !== 'FS' || p.lag) {
          var lt = el('text', {
            x: mx, y: (y1 + y2) / 2 - 3, 'font-size': 7.5, 'font-family': 'monospace',
            fill: crit ? '#b3261e' : '#77839a', 'text-anchor': 'middle'
          }, svg);
          lt.appendChild(document.createTextNode(p.type + (p.lag ? '+' + p.lag : '')));
        }
      });
    });

    g.net.activities.forEach(function (a) {
      var r = cpm.results[a.id], q = pos[a.id], s = g.state[a.id];
      var grp = el('g', {
        class: 'n-node' + (r.tf === 0 ? ' crit' : '') + (s.finishDay !== null ? ' done' : '') + (a.fixed ? ' fixed' : '')
      }, svg);
      el('rect', { x: q.x, y: q.y, width: q.w, height: NH, rx: 2 }, grp);
      var t1 = el('text', { x: q.x + 4, y: q.y + 12, 'font-weight': 'bold' }, grp);
      t1.appendChild(document.createTextNode(a.id));
      var t2 = el('text', { x: q.x + 4, y: q.y + 23, class: 'sub' }, grp);
      t2.appendChild(document.createTextNode('d' + r.dur + ' TF' + r.tf));
      var ttl = el('title', null, grp);
      ttl.appendChild(document.createTextNode(
        a.id + ' — ' + a.name + '\nES ' + r.es + '  EF ' + r.ef + '\nLS ' + r.ls + '  LF ' + r.lf +
        '\nTotal float ' + r.tf + '  Free float ' + r.ff));
    });
  }

  return { render4D: render4D, renderGantt: renderGantt, renderNetwork: renderNetwork, pct: pct };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = TO.Views;
