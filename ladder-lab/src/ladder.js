/* ladder.js — window.LL.Ladder
 * Ladder-diagram SVG renderer + click inspector for Ladder Lab.
 *
 * Contract (SPEC.md):
 *   LL.Ladder.init(containerEl, ctx)  — attach; ctx = {getPlc, onSelectElement, bus, bigUI}
 *   LL.Ladder.render()                — full rebuild from ctx.getPlc().program
 *   LL.Ladder.update()                — cheap per-frame refresh of power/ACC state
 *                                       (no DOM rebuild; toggles classes/text on cached nodes)
 *
 * Reads only the spec'd PLC surface: plc.program (stable elem.id on every
 * element), plc.power {elemId:{in,out}}, plc.timers, plc.counters, plc.bits,
 * plc.inputImage, plc.outputs(). Element ids are treated as opaque strings —
 * never parsed.
 *
 * Bus events consumed:
 *   'fault:revealed' {elemIds:[...]} → persistent red outline until next render()
 *   'fault:injected'                 → clears any existing fault highlights
 *   'bigui:changed'                  → re-read big-UI state, re-render at ~1.35x
 *
 * Spec ambiguity resolved (documented per spec §"choose sensibly"):
 *   ctx.onSelectElement is listed as "(cb)" in the ctx sketch; we treat it as
 *   the app-wired notification function and CALL it on element click with
 *   {id, type, tag, pre, rung, elem}. If the app instead passes a registrar,
 *   it can wrap it — we guard with typeof === 'function'.
 */
window.LL = window.LL || {};
window.LL.Ladder = (function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';

  // ---- base geometry (unscaled px; whole SVG scales via viewBox for big-UI)
  var M = {
    railX: 46,        // left rail x (rung numbers sit left of it)
    padTop: 16, padBottom: 26, padRight: 26,
    seg: 26,          // min wire run between elements
    rungGap: 30,      // vertical gap between rungs
    commentH: 22,     // height reserved for a rung comment line
    contactW: 46, contactBarH: 44, contactGapW: 16,
    coilW: 52, coilRx: 13, coilRy: 22,
    resW: 66,
    onsW: 60, onsH: 44,
    boxW: 158, boxH: 98,
    minAbove: 58,     // series row: space above wire (half symbol + tag label)
    minBelow: 26,     // series row: space below wire
    brRowGap: 8       // extra air between stacked branch paths
  };

  // ---- module state -------------------------------------------------------
  var ctx = null, container = null, svg = null, pop = null;
  var scale = 1;                 // 1 normal, 1.35 big-UI
  var lastProgram = null;        // program object rendered last (defensive re-render key)
  var layoutW = 0, layoutH = 0;  // base-unit svg size of last render

  // caches rebuilt by render(), consumed by update()
  var wireRefs = [];   // {node, ref:{hot:1}|{id,port}, last}
  var elemRefs = [];   // {node, id, last}   → toggles .lad-energized
  var accRefs  = [];   // {node, tag, kind:'T'|'C', last}
  var pipRefs  = [];   // {node, tag, kind:'T'|'C', member, last}
  var elemIndex = {};  // id -> {elem, node, type, tag, pre, rung, cx, cy, below}
  var revealedIds = [];// ids currently fault-highlighted
  var popForId = null;
  var suppressClickUntil = 0;    // swallow the synthetic click after touchend

  // ======================================================================
  // small DOM helpers
  // ======================================================================
  function svgEl(name, attrs, cls) {
    var n = document.createElementNS(SVGNS, name);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (cls) n.setAttribute('class', cls);
    return n;
  }
  function addLine(parent, x1, y1, x2, y2, cls) {
    var n = svgEl('line', { x1: x1, y1: y1, x2: x2, y2: y2 }, cls);
    parent.appendChild(n);
    return n;
  }
  function addText(parent, x, y, str, cls, anchor) {
    var n = svgEl('text', { x: x, y: y }, cls);
    if (anchor) n.setAttribute('text-anchor', anchor);
    n.textContent = str;
    parent.appendChild(n);
    return n;
  }
  // a wire whose energized state tracks `ref` ({hot:1} = always hot, or {id,port})
  function addWire(parent, x1, y1, x2, y2, ref) {
    var n = addLine(parent, x1, y1, x2, y2, 'lad-wire');
    wireRefs.push({ node: n, ref: ref, last: -1 });
    return n;
  }
  function addDot(parent, x, y, ref) {
    var n = svgEl('circle', { cx: x, cy: y, r: 3.6 }, 'lad-dot');
    parent.appendChild(n);
    wireRefs.push({ node: n, ref: ref, last: -1 });
    return n;
  }

  // ======================================================================
  // measuring (base units)
  // ======================================================================
  function isBox(t) { return t === 'TON' || t === 'TOF' || t === 'CTU' || t === 'CTD'; }

  function measureItem(it) {
    var t = it.t;
    if (t === 'BR') return measureBranch(it);
    if (isBox(t)) return { w: M.boxW, above: M.boxH / 2 + 12, below: M.boxH / 2 + 10 };
    if (t === 'ONS') return { w: M.onsW, above: M.minAbove, below: M.minBelow };
    if (t === 'RES') return { w: M.resW, above: M.minAbove, below: M.minBelow };
    if (t === 'OTE' || t === 'OTL' || t === 'OTU') return { w: M.coilW, above: M.minAbove, below: M.minBelow };
    return { w: M.contactW, above: M.minAbove, below: M.minBelow }; // XIC/XIO/unknown
  }

  function measureSeries(items) {
    var w = 0, above = 34, below = 16; // minimums for an empty path (bare wire)
    for (var i = 0; i < items.length; i++) {
      var m = measureItem(items[i]);
      w += M.seg + m.w;
      if (m.above > above) above = m.above;
      if (m.below > below) below = m.below;
    }
    w += M.seg; // trailing run
    return { w: w, above: above, below: below };
  }

  function measureBranch(br) {
    var paths = br.paths || [];
    var rows = [], w = 120;
    for (var p = 0; p < paths.length; p++) {
      var ms = measureSeries(paths[p]);
      rows.push(ms);
      if (ms.w > w) w = ms.w;
    }
    var offs = [0];
    for (var k = 1; k < rows.length; k++) {
      offs.push(offs[k - 1] + rows[k - 1].below + M.brRowGap + rows[k].above);
    }
    var below = rows.length
      ? offs[offs.length - 1] + rows[rows.length - 1].below
      : M.minBelow;
    return {
      w: w,
      above: rows.length ? rows[0].above : M.minAbove,
      below: below,
      rows: rows, offs: offs
    };
  }

  // ======================================================================
  // drawing (base units)
  // ======================================================================
  function elemGroup(parent, it, rung) {
    var g = svgEl('g', { 'data-elem-id': it.id }, 'lad-elem lad-t-' + it.t);
    parent.appendChild(g);
    return g;
  }
  // invisible hit rect (also carries the fault outline); registers in elemIndex
  function finishElem(g, it, rung, hx, hy, hw, hh, cx, cy, below) {
    var hit = svgEl('rect', { x: hx, y: hy, width: hw, height: hh, rx: 4 }, 'lad-hit');
    g.appendChild(hit);
    elemIndex[it.id] = {
      elem: it, node: g, type: it.t, tag: it.tag,
      pre: (typeof it.pre === 'number' ? it.pre : null),
      rung: rung, cx: cx, cy: cy, below: below
    };
    if (it.t !== 'BR') elemRefs.push({ node: g, id: it.id, last: -1 });
  }

  function drawContact(parent, it, x, y, rung) {
    var g = elemGroup(parent, it, rung);
    var w = M.contactW, gw = M.contactGapW, hh = M.contactBarH / 2;
    var b1 = x + (w - gw) / 2, b2 = b1 + gw;
    addWire(g, x, y, b1, y, { id: it.id, port: 'in' });
    addWire(g, b2, y, x + w, y, { id: it.id, port: 'out' });
    addLine(g, b1, y - hh, b1, y + hh, 'lad-sym');
    addLine(g, b2, y - hh, b2, y + hh, 'lad-sym');
    if (it.t === 'XIO') addLine(g, b1 - 5, y + hh, b2 + 5, y - hh, 'lad-sym');
    addText(g, x + w / 2, y - hh - 10, it.tag || '?', 'lad-tag', 'middle');
    finishElem(g, it, rung, x - 3, y - hh - 26, w + 6, M.contactBarH + 32, x + w / 2, y, M.minBelow);
  }

  function drawOns(parent, it, x, y, rung) {
    var g = elemGroup(parent, it, rung);
    var w = M.onsW, bw = 44, bh = M.onsH;
    var bx = x + (w - bw) / 2;
    addWire(g, x, y, bx, y, { id: it.id, port: 'in' });
    addWire(g, bx + bw, y, x + w, y, { id: it.id, port: 'out' });
    g.appendChild(svgEl('rect', { x: bx, y: y - bh / 2, width: bw, height: bh, rx: 3 }, 'lad-sym'));
    addText(g, x + w / 2, y + 5, 'ONS', 'lad-symtext', 'middle');
    addText(g, x + w / 2, y - bh / 2 - 10, it.tag || '?', 'lad-tag', 'middle');
    finishElem(g, it, rung, x - 3, y - bh / 2 - 26, w + 6, bh + 32, x + w / 2, y, M.minBelow);
  }

  // OTE / OTL / OTU / RES — coil parens; letter L/U or "RES" inside
  function drawCoil(parent, it, x, y, rung) {
    var g = elemGroup(parent, it, rung);
    var res = (it.t === 'RES');
    var w = res ? M.resW : M.coilW;
    var rx = M.coilRx, ry = M.coilRy;
    var cx = x + w / 2;
    var off = res ? 17 : 9;              // paren spacing (RES needs room for text)
    var pl = cx - off, pr = cx + off;
    addWire(g, x, y, pl - 3, y, { id: it.id, port: 'in' });
    addWire(g, pr + 3, y, x + w, y, { id: it.id, port: 'out' });
    var pLeft = svgEl('path', {
      d: 'M ' + pl + ' ' + (y - ry) + ' A ' + rx + ' ' + ry + ' 0 0 0 ' + pl + ' ' + (y + ry)
    }, 'lad-sym');
    var pRight = svgEl('path', {
      d: 'M ' + pr + ' ' + (y - ry) + ' A ' + rx + ' ' + ry + ' 0 0 1 ' + pr + ' ' + (y + ry)
    }, 'lad-sym');
    g.appendChild(pLeft); g.appendChild(pRight);
    var letter = it.t === 'OTL' ? 'L' : it.t === 'OTU' ? 'U' : res ? 'RES' : '';
    if (letter) {
      var tn = addText(g, cx, y + 5, letter, 'lad-symtext', 'middle');
      if (res) tn.setAttribute('style', 'font-size:11px');
    }
    addText(g, cx, y - ry - 10, it.tag || '?', 'lad-tag', 'middle');
    finishElem(g, it, rung, x - 3, y - ry - 26, w + 6, ry * 2 + 32, cx, y, M.minBelow);
  }

  // TON / TOF / CTU / CTD instruction box
  function drawBox(parent, it, x, y, rung) {
    var g = elemGroup(parent, it, rung);
    var w = M.boxW, bx = x + 8, bw = w - 16, bh = M.boxH, top = y - bh / 2;
    addWire(g, x, y, bx, y, { id: it.id, port: 'in' });
    addWire(g, bx + bw, y, x + w, y, { id: it.id, port: 'out' });
    g.appendChild(svgEl('rect', { x: bx, y: top, width: bw, height: bh, rx: 3 }, 'lad-boxrect'));
    addText(g, bx + 10, top + 20, it.t, 'lad-boxtype');
    addText(g, bx + bw - 10, top + 20, it.tag || '?', 'lad-boxtag', 'end');
    addLine(g, bx, top + 27, bx + bw, top + 27, 'lad-boxline');
    var isTimer = (it.t === 'TON' || it.t === 'TOF');
    var preStr = isTimer
      ? 'PRE ' + ((it.pre || 0) / 1000).toFixed(2) + ' s'
      : 'PRE ' + (it.pre || 0);
    addText(g, bx + 10, top + 46, preStr, 'lad-boxtext');
    var accNode = addText(g, bx + 10, top + 64, isTimer ? 'ACC 0.00 s' : 'ACC 0', 'lad-boxtext');
    accRefs.push({ node: accNode, tag: it.tag, kind: isTimer ? 'T' : 'C', last: null });
    // pips: timers EN/TT/DN; CTU shows CU/DN, CTD shows CD/DN (counters have no EN/TT)
    var members = isTimer ? ['EN', 'TT', 'DN'] : (it.t === 'CTU' ? ['CU', 'DN'] : ['CD', 'DN']);
    var px = bx + 14;
    for (var i = 0; i < members.length; i++) {
      var pip = svgEl('circle', { cx: px, cy: top + 82, r: 5.5 }, 'lad-pip');
      g.appendChild(pip);
      addText(g, px + 9, top + 86, members[i], 'lad-piplabel');
      pipRefs.push({ node: pip, tag: it.tag, kind: isTimer ? 'T' : 'C', member: members[i], last: -1 });
      px += 44;
    }
    finishElem(g, it, rung, x + 2, top - 6, w - 4, bh + 12, x + w / 2, y, bh / 2 + 10);
  }

  function drawBranch(parent, br, x, y, rung) {
    var m = measureBranch(br);
    var xR = x + m.w;
    var g = elemGroup(parent, br, rung);
    var lastOff = m.offs.length ? m.offs[m.offs.length - 1] : 0;
    // vertical branch rails: left tracks branch power-in, right tracks power-out
    var vl = addLine(g, x, y, x, y + lastOff, 'lad-wire');
    wireRefs.push({ node: vl, ref: { id: br.id, port: 'in' }, last: -1 });
    var vr = addLine(g, xR, y, xR, y + lastOff, 'lad-wire');
    wireRefs.push({ node: vr, ref: { id: br.id, port: 'out' }, last: -1 });
    // junction dots at every path connection
    for (var k = 0; k < m.offs.length; k++) {
      addDot(g, x, y + m.offs[k], { id: br.id, port: 'in' });
      addDot(g, xR, y + m.offs[k], { id: br.id, port: 'out' });
    }
    // paths (path 0 rides the main wire line)
    var paths = br.paths || [];
    for (var p = 0; p < paths.length; p++) {
      drawSeries(parent, paths[p], x, y + m.offs[p], xR, { id: br.id, port: 'in' }, rung);
    }
    // clickable zone = left rail strip of the branch
    finishElem(g, br, rung, x - 7, y - 10, 14, lastOff + 20, x, y, m.below);
    return m.w;
  }

  function drawItem(parent, it, x, y, rung) {
    var t = it.t;
    if (t === 'BR') return drawBranch(parent, it, x, y, rung);
    if (isBox(t)) { drawBox(parent, it, x, y, rung); return M.boxW; }
    if (t === 'ONS') { drawOns(parent, it, x, y, rung); return M.onsW; }
    if (t === 'OTE' || t === 'OTL' || t === 'OTU' || t === 'RES') {
      drawCoil(parent, it, x, y, rung);
      return t === 'RES' ? M.resW : M.coilW;
    }
    drawContact(parent, it, x, y, rung);
    return M.contactW;
  }

  // draw a series from x to xEnd on wire-line y. entryRef feeds the first
  // segment ("segment before first element lit iff entry power"; at top level
  // entryRef={hot:1} — the left rail is hot). Segment after element i is lit
  // iff power[items[i].id].out.
  function drawSeries(parent, items, x, y, xEnd, entryRef, rung) {
    var cur = x, ref = entryRef;
    for (var i = 0; i < items.length; i++) {
      addWire(parent, cur, y, cur + M.seg, y, ref);
      cur += M.seg;
      cur += drawItem(parent, items[i], cur, y, rung);
      ref = { id: items[i].id, port: 'out' };
    }
    addWire(parent, cur, y, xEnd, y, ref);
    return ref;
  }

  // ======================================================================
  // render / update
  // ======================================================================
  function render() {
    if (!container || !ctx) return;
    var plc = ctx.getPlc && ctx.getPlc();
    if (!plc || !plc.program) return;
    var prog = plc.program;
    lastProgram = prog;

    // reset caches; a render clears fault highlights (per spec: highlights
    // persist "until next render()")
    wireRefs = []; elemRefs = []; accRefs = []; pipRefs = []; elemIndex = {};
    revealedIds = [];
    hidePop();

    var rungs = prog.rungs || [];

    // ---- measure pass
    var lays = [], y = M.padTop, maxW = 320;
    for (var r = 0; r < rungs.length; r++) {
      var ms = measureSeries(rungs[r].items || []);
      var ch = rungs[r].comment ? M.commentH : 0;
      var lay = { ms: ms, commentY: y + 14, yBase: y + ch + ms.above };
      lays.push(lay);
      y = lay.yBase + ms.below + M.rungGap;
      var need = M.railX + ms.w + 60;
      if (rungs[r].comment) {
        var cw = M.railX + rungs[r].comment.length * 7.4 + 30;
        if (cw > need) need = cw;
      }
      if (need > maxW) maxW = need;
    }
    layoutH = y - M.rungGap + M.padBottom;
    if (layoutH < 80) layoutH = 80;

    var availW = container.clientWidth ? (container.clientWidth - 6) / scale : 0;
    layoutW = Math.max(maxW + M.padRight, availW, 320);
    var railR = layoutW - M.padRight;

    // ---- build fresh SVG (big-UI scales the whole drawing via viewBox)
    if (svg) container.removeChild(svg);
    svg = svgEl('svg', {
      width: Math.round(layoutW * scale),
      height: Math.round(layoutH * scale),
      viewBox: '0 0 ' + layoutW + ' ' + layoutH
    }, 'lad-svg');

    // rails (left rail is hot — always-green styling via CSS)
    var railTop = Math.max(M.padTop - 8, 4), railBot = layoutH - 8;
    addLine(svg, M.railX, railTop, M.railX, railBot, 'lad-rail lad-rail-left');
    addLine(svg, railR, railTop, railR, railBot, 'lad-rail lad-rail-right');

    for (var i = 0; i < rungs.length; i++) {
      var gR = svgEl('g', null, 'lad-rung');
      svg.appendChild(gR);
      if (rungs[i].comment) {
        addText(gR, M.railX + 6, lays[i].commentY, rungs[i].comment, 'lad-comment');
      }
      addText(gR, M.railX - 12, lays[i].yBase + 4, String(i), 'lad-rungnum', 'end');
      drawSeries(gR, rungs[i].items || [], M.railX, lays[i].yBase, railR, { hot: 1 }, i);
    }

    svg.addEventListener('click', onSvgClick);
    svg.addEventListener('touchend', onSvgTouch, { passive: false });
    container.appendChild(svg);
    if (pop) container.appendChild(pop); // keep popover last (paints on top)

    update(); // paint initial power/ACC state
  }

  function powerOf(plc, ref) {
    if (ref.hot) return 1;
    var p = plc.power && plc.power[ref.id];
    return p && p[ref.port] ? 1 : 0;
  }

  function update() {
    if (!ctx) return;
    var plc = ctx.getPlc && ctx.getPlc();
    if (!plc) return;
    // defensive: if the program object changed and the app hasn't called
    // render() yet, rebuild instead of updating stale DOM
    if (plc.program !== lastProgram) { render(); return; }

    var i, w, on, e, p;
    for (i = 0; i < wireRefs.length; i++) {
      w = wireRefs[i];
      on = powerOf(plc, w.ref);
      if (on !== w.last) {
        w.last = on;
        if (on) w.node.classList.add('lad-hot'); else w.node.classList.remove('lad-hot');
      }
    }
    for (i = 0; i < elemRefs.length; i++) {
      e = elemRefs[i];
      p = plc.power && plc.power[e.id];
      on = p && p.out ? 1 : 0;
      if (on !== e.last) {
        e.last = on;
        if (on) e.node.classList.add('lad-energized'); else e.node.classList.remove('lad-energized');
      }
    }
    for (i = 0; i < accRefs.length; i++) {
      var a = accRefs[i], txt;
      if (a.kind === 'T') {
        var t = plc.timers && plc.timers[a.tag];
        txt = 'ACC ' + ((t ? t.ACC : 0) / 1000).toFixed(2) + ' s';
      } else {
        var c = plc.counters && plc.counters[a.tag];
        txt = 'ACC ' + (c ? c.ACC : 0);
      }
      if (txt !== a.last) { a.last = txt; a.node.textContent = txt; }
    }
    for (i = 0; i < pipRefs.length; i++) {
      var pp = pipRefs[i];
      var tbl = pp.kind === 'T' ? plc.timers : plc.counters;
      var rec = tbl && tbl[pp.tag];
      on = rec && rec[pp.member] ? 1 : 0;
      if (on !== pp.last) {
        pp.last = on;
        if (on) pp.node.classList.add('lad-pip-on'); else pp.node.classList.remove('lad-pip-on');
      }
    }
  }

  // ======================================================================
  // inspector popover + selection
  // ======================================================================
  var TYPE_NAMES = {
    XIC: 'Examine If Closed (N.O. contact)',
    XIO: 'Examine If Open (N.C. contact)',
    ONS: 'One-Shot Rising',
    OTE: 'Output Energize (coil)',
    OTL: 'Output Latch',
    OTU: 'Output Unlatch',
    TON: 'On-Delay Timer',
    TOF: 'Off-Delay Timer',
    CTU: 'Count Up',
    CTD: 'Count Down',
    RES: 'Reset',
    BR:  'Parallel Branch'
  };

  // resolve a contact/coil tag to its current 0/1 (handles T1.DN style members)
  function bitVal(plc, tag) {
    if (!tag) return 0;
    var di = tag.indexOf('.');
    if (di > 0) {
      var base = tag.slice(0, di), mem = tag.slice(di + 1);
      var t = plc.timers && plc.timers[base];
      if (t && mem in t) return t[mem] ? 1 : 0;
      var c = plc.counters && plc.counters[base];
      if (c && mem in c) return c[mem] ? 1 : 0;
      return 0;
    }
    if (plc.inputImage && tag in plc.inputImage) return plc.inputImage[tag] ? 1 : 0;
    if (plc.bits && tag in plc.bits) return plc.bits[tag] ? 1 : 0;
    var outs = plc.outputs ? plc.outputs() : null;
    if (outs && tag in outs) return outs[tag] ? 1 : 0;
    return 0;
  }

  function fmtS(ms) { return ((ms || 0) / 1000).toFixed(2); }
  function onOff(v) { return v ? 'ON' : 'OFF'; }

  // one-line plain-English description per element type, using live state
  function describe(plc, info) {
    var t = info.type, tag = info.tag, elem = info.elem;
    var st = bitVal(plc, tag);
    var pw = (plc.power && plc.power[info.elem.id]) || { in: 0, out: 0 };
    var tm = plc.timers && plc.timers[tag];
    var cn = plc.counters && plc.counters[tag];
    switch (t) {
      case 'XIC':
        return 'Examine-if-closed: passes power while ' + tag + ' is ON. ' + tag +
          ' is currently ' + onOff(st) + ', so this contact ' + (st ? 'passes' : 'blocks') + ' power.';
      case 'XIO':
        return 'Examine-if-open: passes power while ' + tag + ' is OFF. ' + tag +
          ' is currently ' + onOff(st) + ', so this contact ' + (st ? 'blocks' : 'passes') + ' power.';
      case 'ONS':
        return 'One-shot: passes power for exactly ONE scan when rung power first arrives, ' +
          'then blocks until power drops and returns. Storage bit ' + tag + ' remembers last scan (' + onOff(st) + ').';
      case 'OTE':
        return 'Output coil: ' + tag + ' follows this rung every scan — ON while the rung is true, ' +
          'OFF when it is false. The rung is currently ' + (pw.in ? 'TRUE' : 'FALSE') +
          ', so ' + tag + ' is ' + onOff(st) + '.';
      case 'OTL':
        return 'Latch: when this rung is true, ' + tag + ' turns ON and STAYS on until an unlatch (OTU) ' +
          'turns it off. ' + tag + ' is currently ' + onOff(st) + '.';
      case 'OTU':
        return 'Unlatch: when this rung is true, ' + tag + ' turns OFF and stays off until a latch (OTL) ' +
          'sets it again. ' + tag + ' is currently ' + onOff(st) + '.';
      case 'TON':
        return 'On-delay timer: while the rung is true, ACC counts up; DN turns on at PRE (' +
          fmtS(info.pre) + ' s). Rung false → resets. ACC is now ' + fmtS(tm ? tm.ACC : 0) + ' s.';
      case 'TOF':
        return 'Off-delay timer: DN turns ON the moment the rung goes true and STAYS on for PRE (' +
          fmtS(info.pre) + ' s) after the rung goes false; ACC times the off-delay (now ' +
          fmtS(tm ? tm.ACC : 0) + ' s).';
      case 'CTU':
        return 'Count-up counter: adds 1 to ACC each time this rung goes false→true. DN turns on at ' +
          'PRE (' + (info.pre || 0) + '). ACC is now ' + (cn ? cn.ACC : 0) + '.';
      case 'CTD':
        return 'Count-down counter: subtracts 1 from ACC each time this rung goes false→true. DN is on ' +
          'while ACC ≥ PRE (' + (info.pre || 0) + '). ACC is now ' + (cn ? cn.ACC : 0) + '.';
      case 'RES':
        return 'Reset: while this rung is true, clears ' + tag + ' — a timer goes to ACC 0 with DN/TT off; ' +
          'a counter goes to ACC 0. The rung is currently ' + (pw.in ? 'TRUE (resetting)' : 'FALSE') + '.';
      case 'BR':
        var n = (elem.paths || []).length;
        return 'Parallel branch (' + n + ' paths): power reaches the far side if ANY path conducts — ' +
          'a ladder OR. Every path is still solved each scan, so outputs on all paths execute.';
      default:
        return 'Unknown element type "' + t + '".';
    }
  }

  function stateLine(plc, info) {
    var t = info.type;
    if (t === 'TON' || t === 'TOF') {
      var tm = (plc.timers && plc.timers[info.tag]) || { EN: 0, TT: 0, DN: 0, ACC: 0, PRE: info.pre || 0 };
      return 'EN ' + (tm.EN ? 1 : 0) + '  TT ' + (tm.TT ? 1 : 0) + '  DN ' + (tm.DN ? 1 : 0) +
        '  ·  ACC ' + fmtS(tm.ACC) + ' / ' + fmtS(tm.PRE || info.pre) + ' s';
    }
    if (t === 'CTU' || t === 'CTD') {
      var cn = (plc.counters && plc.counters[info.tag]) || { DN: 0, ACC: 0, PRE: info.pre || 0 };
      return 'DN ' + (cn.DN ? 1 : 0) + '  ·  ACC ' + cn.ACC + ' / ' + (cn.PRE || info.pre || 0);
    }
    var pw = (plc.power && plc.power[info.elem.id]) || { in: 0, out: 0 };
    if (t === 'BR') {
      return 'power in ' + (pw.in ? 1 : 0) + ' → out ' + (pw.out ? 1 : 0);
    }
    return info.tag + ' = ' + (bitVal(plc, info.tag) ? '1 (ON)' : '0 (OFF)') +
      '  ·  power in ' + (pw.in ? 1 : 0) + ' → out ' + (pw.out ? 1 : 0);
  }

  function buildPop() {
    pop = document.createElement('div');
    pop.className = 'lad-pop';
    pop.style.display = 'none';
    pop.innerHTML =
      '<div class="lad-pop-head"><span class="lad-pop-tag"></span>' +
      '<span class="lad-pop-kind"></span>' +
      '<button class="lad-pop-close" type="button" aria-label="Close">✕</button></div>' +
      '<div class="lad-pop-state"></div>' +
      '<div class="lad-pop-desc"></div>';
    pop.querySelector('.lad-pop-close').addEventListener('click', hidePop);
    container.appendChild(pop);
  }

  function showPop(id) {
    var info = elemIndex[id];
    if (!info || !pop) return;
    var plc = ctx.getPlc && ctx.getPlc();
    if (!plc) return;
    pop.querySelector('.lad-pop-tag').textContent =
      info.type === 'BR' ? 'BRANCH' : (info.type + ' ' + (info.tag || ''));
    pop.querySelector('.lad-pop-kind').textContent = TYPE_NAMES[info.type] || info.type;
    pop.querySelector('.lad-pop-state').textContent = stateLine(plc, info);
    pop.querySelector('.lad-pop-desc').textContent = describe(plc, info);
    pop.style.display = 'block';
    popForId = id;
    // position near the element (popover lives inside the scroll content, so
    // plain content coordinates track scrolling naturally)
    var popW = pop.offsetWidth || 272;
    var left = info.cx * scale - popW / 2;
    var maxLeft = Math.round(layoutW * scale) - popW - 6;
    if (left > maxLeft) left = maxLeft;
    if (left < 6) left = 6;
    var top = (info.cy + info.below + 10) * scale;
    var popH = pop.offsetHeight || 120;
    if (top + popH > layoutH * scale - 4) {          // no room below → above
      top = (info.cy - info.below) * scale - popH - 44;
      if (top < 4) top = 4;
    }
    pop.style.left = Math.round(left) + 'px';
    pop.style.top = Math.round(top) + 'px';
    // keep the popover inside the container's visible viewport (it lives in
    // the scroll content, so nudge scrollTop rather than the popover)
    var viewTop = container.scrollTop, viewH = container.clientHeight;
    if (top + popH > viewTop + viewH - 6) {
      container.scrollTop = Math.max(0, top + popH - viewH + 8);
    } else if (top < viewTop) {
      container.scrollTop = Math.max(0, top - 8);
    }
    document.addEventListener('pointerdown', onDocPointer, true);
    document.addEventListener('keydown', onDocKey, true);
  }

  function hidePop() {
    if (pop) pop.style.display = 'none';
    popForId = null;
    document.removeEventListener('pointerdown', onDocPointer, true);
    document.removeEventListener('keydown', onDocKey, true);
  }

  function onDocPointer(e) {
    if (pop && pop.contains(e.target)) return;
    hidePop();
  }
  function onDocKey(e) {
    if (e.key === 'Escape' || e.key === 'Esc') hidePop();
  }

  function activate(target) {
    var g = target && target.closest ? target.closest('[data-elem-id]') : null;
    if (!g) { hidePop(); return; }
    var id = g.getAttribute('data-elem-id');
    var info = elemIndex[id];
    if (!info) return;
    if (ctx && typeof ctx.onSelectElement === 'function') {
      ctx.onSelectElement({
        id: id, type: info.type, tag: info.tag, pre: info.pre,
        rung: info.rung, elem: info.elem
      });
    }
    showPop(id);
  }

  // Mouse + touch: touchend handles taps directly (and suppresses the
  // browser's synthetic follow-up click via event timestamps — no Date.now()).
  function onSvgClick(e) {
    if (e.timeStamp && e.timeStamp < suppressClickUntil) return;
    activate(e.target);
  }
  function onSvgTouch(e) {
    var t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    var target = document.elementFromPoint(t.clientX, t.clientY);
    var g = target && target.closest ? target.closest('[data-elem-id]') : null;
    if (!g) return;               // let non-element touches scroll/behave normally
    e.preventDefault();           // avoid double-firing via the synthetic click
    suppressClickUntil = (e.timeStamp || 0) + 700;
    activate(target);
  }

  // ======================================================================
  // fault highlights + big-UI
  // ======================================================================
  function setRevealed(ids) {
    var i, info;
    for (i = 0; i < revealedIds.length; i++) {
      info = elemIndex[revealedIds[i]];
      if (info) info.node.classList.remove('lad-fault');
    }
    revealedIds = [];
    if (!ids) return;
    for (i = 0; i < ids.length; i++) {
      info = elemIndex[ids[i]];
      if (info) {
        info.node.classList.add('lad-fault');
        revealedIds.push(ids[i]);
      }
    }
  }

  function applyBigUI(big) {
    var s = big ? 1.35 : 1;
    if (s === scale) return;
    scale = s;
    if (lastProgram) render();
  }

  // ======================================================================
  // init
  // ======================================================================
  function init(containerEl, context) {
    ctx = context;
    container = containerEl;
    container.classList.add('lad-container');
    container.innerHTML = '';
    svg = null;
    scale = (ctx && ctx.bigUI) ? 1.35 : 1;
    buildPop();
    if (ctx && ctx.bus && typeof ctx.bus.on === 'function') {
      ctx.bus.on('fault:revealed', function (d) {
        setRevealed(d && d.elemIds ? d.elemIds : []);
      });
      ctx.bus.on('fault:injected', function () { setRevealed([]); });
      ctx.bus.on('bigui:changed', function (d) {
        var big;
        if (typeof d === 'boolean') big = d;
        else if (d && typeof d.bigUI === 'boolean') big = d.bigUI;
        else big = !!(ctx && ctx.bigUI);
        applyBigUI(big);
      });
    }
  }

  return { init: init, render: render, update: update };
})();
