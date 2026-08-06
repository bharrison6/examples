/* watch.js — window.LL.Watch
 * Watch window + image-table scan debugger for Ladder Lab.
 *
 * Contract (SPEC.md):
 *   LL.Watch.init(containerEl, ctx)  — build skeleton; ctx = {getPlc, bus, bigUI, ...}
 *   LL.Watch.update()                — cheap per-frame refresh: row nodes are
 *                                      cached keyed by tag; only changed
 *                                      text/classes are touched.
 *
 * Section 1 "Watch": grouped tables Inputs / Outputs / Bits / Timers /
 * Counters from plc.tagList(); LED dot + 0/1 for bit-like tags; timers show
 * ACC/PRE in seconds (2 decimals) + EN TT DN chips; counters ACC/PRE + DN
 * chip. Rows flash (~400 ms CSS animation) when their tag appears in
 * plc.changedBits.
 *
 * Section 2 "Image Tables / Scan Debugger": input/output images as LED grids
 * with tag labels; a cell whose "I:tag"/"O:tag" is in plc.changedBits keeps a
 * highlight ring until the next scan; shows scanCount and simTime (s).
 * Both sections collapse via their header strip.
 *
 * Rebuild policy: the row DOM is rebuilt only when ctx.getPlc() returns a
 * different PLC instance (spec: the PLC is replaced on program change/reset,
 * and a program's tag universe is fixed at load).
 *
 * Big-UI is pure CSS (body.bigui scaling in ladder-watch.css) — no JS needed.
 */
window.LL = window.LL || {};
window.LL.Watch = (function () {
  'use strict';

  var GROUPS = [
    { kind: 'I', title: 'Inputs' },
    { kind: 'O', title: 'Outputs' },
    { kind: 'B', title: 'Bits' },
    { kind: 'T', title: 'Timers' },
    { kind: 'C', title: 'Counters' }
  ];

  var ctx = null, container = null;
  var groupsEl = null, gridInEl = null, gridOutEl = null;
  var scanNumEl = null, simTimeEl = null;
  var lastPlc = null;
  var rows = {};        // "K:tag" -> {tr, led, num, chips:{M:{node,last}}, lastNum, lastLed}
  var cells = {};       // "I:tag"/"O:tag" -> {node, led, last}
  var inTags = [], outTags = [];
  var ringed = [];      // cell nodes currently carrying .watch-ring
  var lastFlashScan = -1;
  var lastScanShown = null, lastTimeShown = null;

  // ---------------------------------------------------------------- helpers
  function div(cls, parent) {
    var n = document.createElement('div');
    n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }
  function span(cls, text, parent) {
    var n = document.createElement('span');
    n.className = cls;
    if (text !== null && text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function fmtS(ms) { return ((ms || 0) / 1000).toFixed(2); }

  function makeSection(title, bodyBuilder) {
    var sec = div('watch-sec', container);
    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'watch-sec-head';
    span('', title, head);
    span('watch-caret', '▼', head);
    sec.appendChild(head);
    var body = div('watch-sec-body', sec);
    head.addEventListener('click', function () {
      sec.classList.toggle('watch-collapsed');
    });
    bodyBuilder(body);
    return sec;
  }

  // ---------------------------------------------------------------- skeleton
  function init(containerEl, context) {
    ctx = context;
    container = containerEl;
    container.classList.add('watch-container');
    container.innerHTML = '';
    lastPlc = null;
    rows = {}; cells = {}; ringed = [];
    lastFlashScan = -1; lastScanShown = null; lastTimeShown = null;

    makeSection('Watch', function (body) {
      groupsEl = div('watch-groups', body);
    });
    makeSection('Image Tables / Scan Debugger', function (body) {
      var line = div('watch-scanline', body);
      span('', 'Scan ', line);
      scanNumEl = document.createElement('b');
      scanNumEl.textContent = '0';
      line.appendChild(scanNumEl);
      span('', '   ·   Sim time ', line);
      simTimeEl = document.createElement('b');
      simTimeEl.textContent = '0.00 s';
      line.appendChild(simTimeEl);
      var grids = div('watch-grids', body);
      var bIn = div('watch-imgblock', grids);
      div('watch-imgtitle', bIn).textContent = 'Input Image';
      gridInEl = div('watch-grid', bIn);
      var bOut = div('watch-imgblock', grids);
      div('watch-imgtitle', bOut).textContent = 'Output Image';
      gridOutEl = div('watch-grid', bOut);
    });
  }

  // ---------------------------------------------------------------- rebuild
  function makeBitRow(tbody, kind, tag) {
    var tr = document.createElement('tr');
    tr.className = 'watch-row';
    var td1 = document.createElement('td');
    td1.className = 'watch-tag';
    td1.textContent = tag;
    var td2 = document.createElement('td');
    td2.className = 'watch-val';
    var led = span('watch-led', null, td2);
    var num = span('watch-num', '0', td2);
    tr.appendChild(td1); tr.appendChild(td2);
    tbody.appendChild(tr);
    rows[kind + ':' + tag] = { tr: tr, led: led, num: num, chips: null, lastNum: null, lastLed: -1 };
  }

  function makeTcRow(tbody, kind, tag, members) {
    var tr = document.createElement('tr');
    tr.className = 'watch-row';
    var td1 = document.createElement('td');
    td1.className = 'watch-tag';
    td1.textContent = tag;
    var td2 = document.createElement('td');
    td2.className = 'watch-val';
    var num = span('watch-num', '', td2);
    var td3 = document.createElement('td');
    td3.className = 'watch-chips';
    var chips = {};
    for (var i = 0; i < members.length; i++) {
      chips[members[i]] = { node: span('watch-chip', members[i], td3), last: -1 };
    }
    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
    tbody.appendChild(tr);
    rows[kind + ':' + tag] = { tr: tr, led: null, num: num, chips: chips, lastNum: null, lastLed: -1 };
  }

  function makeCell(gridEl, kind, tag) {
    var cell = div('watch-cell', gridEl);
    var led = span('watch-led', null, cell);
    span('watch-cell-tag', tag, cell);
    cell.title = tag;
    cells[kind + ':' + tag] = { node: cell, led: led, last: -1 };
  }

  function rebuild(plc) {
    rows = {}; cells = {}; ringed = [];
    inTags = []; outTags = [];
    lastFlashScan = -1; lastScanShown = null; lastTimeShown = null;
    groupsEl.innerHTML = '';
    gridInEl.innerHTML = '';
    gridOutEl.innerHTML = '';

    var list = (plc.tagList ? plc.tagList() : []) || [];
    var byKind = { I: [], O: [], B: [], T: [], C: [] };
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (byKind[e.kind]) byKind[e.kind].push(e.tag);
    }

    for (var g = 0; g < GROUPS.length; g++) {
      var kind = GROUPS[g].kind, tags = byKind[kind];
      if (!tags.length) continue;
      var box = div('watch-group', groupsEl);
      div('watch-group-title', box).textContent = GROUPS[g].title;
      var table = document.createElement('table');
      table.className = 'watch-table';
      var tbody = document.createElement('tbody');
      table.appendChild(tbody);
      box.appendChild(table);
      for (var j = 0; j < tags.length; j++) {
        if (kind === 'T') makeTcRow(tbody, kind, tags[j], ['EN', 'TT', 'DN']);
        else if (kind === 'C') makeTcRow(tbody, kind, tags[j], ['DN']);
        else makeBitRow(tbody, kind, tags[j]);
      }
    }

    inTags = byKind.I;
    outTags = byKind.O;
    for (var a = 0; a < inTags.length; a++) makeCell(gridInEl, 'I', inTags[a]);
    for (var b = 0; b < outTags.length; b++) makeCell(gridOutEl, 'O', outTags[b]);
  }

  // ---------------------------------------------------------------- update
  function setLed(led, on) {
    if (on) led.classList.add('watch-on'); else led.classList.remove('watch-on');
  }
  function refreshBitRow(row, v) {
    if (v !== row.lastLed) {
      row.lastLed = v;
      setLed(row.led, v);
      row.num.textContent = String(v);
    }
  }
  function refreshChips(row, rec, zero) {
    var r = rec || zero;
    for (var m in row.chips) {
      var ch = row.chips[m];
      var on = r[m] ? 1 : 0;
      if (on !== ch.last) {
        ch.last = on;
        if (on) ch.node.classList.add('watch-on'); else ch.node.classList.remove('watch-on');
      }
    }
  }
  function flashRow(tr) {
    // restart the ~400 ms CSS animation (forced reflow only on actual changes)
    tr.classList.remove('watch-flash');
    void tr.offsetWidth;
    tr.classList.add('watch-flash');
  }

  var T_ZERO = { EN: 0, TT: 0, DN: 0, ACC: 0, PRE: 0 };
  var C_ZERO = { CU: 0, CD: 0, DN: 0, ACC: 0, PRE: 0 };

  function update() {
    if (!ctx) return;
    var plc = ctx.getPlc && ctx.getPlc();
    if (!plc) return;
    if (plc !== lastPlc) { lastPlc = plc; rebuild(plc); }

    var outs = plc.outputs ? plc.outputs() : {};
    var inImg = plc.inputImage || {};
    var bits = plc.bits || {};
    var timers = plc.timers || {};
    var counters = plc.counters || {};

    var key, row, tag, v, txt;
    for (key in rows) {
      row = rows[key];
      tag = key.slice(2);
      var kind = key.charAt(0);
      if (kind === 'I') refreshBitRow(row, inImg[tag] ? 1 : 0);
      else if (kind === 'O') refreshBitRow(row, outs[tag] ? 1 : 0);
      else if (kind === 'B') refreshBitRow(row, bits[tag] ? 1 : 0);
      else if (kind === 'T') {
        var t = timers[tag] || T_ZERO;
        txt = fmtS(t.ACC) + ' / ' + fmtS(t.PRE) + ' s';
        if (txt !== row.lastNum) { row.lastNum = txt; row.num.textContent = txt; }
        refreshChips(row, t, T_ZERO);
      } else if (kind === 'C') {
        var c = counters[tag] || C_ZERO;
        txt = (c.ACC || 0) + ' / ' + (c.PRE || 0);
        if (txt !== row.lastNum) { row.lastNum = txt; row.num.textContent = txt; }
        refreshChips(row, c, C_ZERO);
      }
    }

    // image-table LEDs
    var i, cell;
    for (i = 0; i < inTags.length; i++) {
      cell = cells['I:' + inTags[i]];
      v = inImg[inTags[i]] ? 1 : 0;
      if (v !== cell.last) { cell.last = v; setLed(cell.led, v); }
    }
    for (i = 0; i < outTags.length; i++) {
      cell = cells['O:' + outTags[i]];
      v = outs[outTags[i]] ? 1 : 0;
      if (v !== cell.last) { cell.last = v; setLed(cell.led, v); }
    }

    // scan counter + sim time (sim time from the engine, never wall clock)
    if (plc.scanCount !== lastScanShown) {
      lastScanShown = plc.scanCount;
      scanNumEl.textContent = String(plc.scanCount);
    }
    var tStr = fmtS(plc.simTimeMs) + ' s';
    if (tStr !== lastTimeShown) {
      lastTimeShown = tStr;
      simTimeEl.textContent = tStr;
    }

    // per-scan work: row flashes + image-table rings from plc.changedBits.
    // changedBits describes the LAST scan, so process once per new scanCount.
    if (plc.scanCount !== lastFlashScan) {
      lastFlashScan = plc.scanCount;
      for (i = 0; i < ringed.length; i++) ringed[i].classList.remove('watch-ring');
      ringed = [];
      var cb = plc.changedBits;
      if (cb && typeof cb.forEach === 'function') {
        cb.forEach(function (entry) {
          // entries look like "I:PED_NS", "O:NS_GRN", "B:STEP1", "T:T1.DN"
          var ci = entry.indexOf(':');
          if (ci < 0) return;
          var k = entry.slice(0, ci), rest = entry.slice(ci + 1);
          var di = rest.indexOf('.');
          var base = di >= 0 ? rest.slice(0, di) : rest;
          var r = rows[k + ':' + base];
          if (r) flashRow(r.tr);
          if (k === 'I' || k === 'O') {
            var c2 = cells[k + ':' + base];
            if (c2) { c2.node.classList.add('watch-ring'); ringed.push(c2.node); }
          }
        });
      }
    }
  }

  return { init: init, update: update };
})();
