/*
 * Ladder Lab — src/editor.js
 * window.LL.Editor — the constrained student ladder-logic editor.
 *
 * The editor's in-memory data model IS the SPEC.md program JSON — no
 * translation layer. Elements are mutated in place; deep clones happen only
 * at the API boundary (setProgram in, getProgram out, undo snapshots).
 *
 * Public API (module contract):
 *   LL.Editor.init(containerEl, ctx)            ctx = {getPlc, onSelectElement, bus, bigUI}
 *   LL.Editor.setProgram(programJson)           deep-clones in; resets undo/selection
 *   LL.Editor.getProgram() -> programJson       clean deep clone, element ids stripped
 *   LL.Editor.loadChallengeStarter(programJson|null, lockedNote)
 *                                               null starter = fresh empty program;
 *                                               lockedNote shows as a pinned banner
 * Bus events EMITTED: 'editor:run' {program}   (nothing else)
 * Depends on: LL.Validate.check (engine.js, concatenated earlier in the build),
 *             LL.Util.deepClone when present (JSON round-trip fallback otherwise).
 *
 * Documented decisions (spec: "if unspecified, choose sensibly and document"):
 *  - Undo is a snapshot stack capped at 50 (brief allowed single-level; this is
 *    deeper). Ctrl+Z / Cmd+Z or the toolbar button. setProgram()/
 *    loadChallengeStarter()/init treat the result as a fresh document and clear
 *    the stack; every other mutation (insert, delete, tag/preset/comment edit,
 *    rung ops, path ops, load, clear) pushes one snapshot first.
 *  - Rung numbers DISPLAY 1-based ("0001" style) to match LL.Validate's
 *    plain-English messages ("Rung 3: ..."), which are 1-based. Internally
 *    everything stays 0-based (data-r attributes, validate rung indices).
 *  - Timer presets (TON/TOF) are stored in ms and edited in seconds with a
 *    0.1 s step. Counter presets (CTU/CTD) are edited as a raw count (step 1):
 *    the spec's counter pre is a count ({"t":"CTU","pre":4}), so a seconds
 *    field there would corrupt the JSON contract.
 *  - Newly placed TON/TOF default to pre:1000 (1.0 s), CTU/CTD to pre:1, so a
 *    fresh placement doesn't instantly trip the zero-preset validation error.
 *  - Newly placed elements get a DEFAULT TAG (first unused sensible tag):
 *    contacts/ONS → first free B1..B12; coils → first output not already
 *    coil-driven; TON/TOF → first free T1..T8; CTU/CTD → first free C1..C4;
 *    RES → the first timer/counter the program actually uses (else T1).
 *    The ⚠ ‹tag?› cue remains for loaded programs with missing tags.
 *  - Save downloads "<name>.ladderlab.json" carrying a `"ladderlab": 1`
 *    marker field. Load accepts files with or without the marker (the marker
 *    is stripped on load so it never leaks into the editing model). Dev hook:
 *    if window.__DEV_CAPTURE_SAVE is a function, Save hands it the JSON
 *    string instead of downloading (used by the throwaway test driver).
 *  - New asks for confirmation, then starts a fresh program with ONE empty
 *    rung (id 'student') — students immediately have a place to tap.
 *  - Deleting a rung that has content asks for confirmation; an empty rung
 *    deletes silently (nothing to lose).
 *  - Branch paths always show a per-path ✕. With 3+ paths it removes the
 *    path; at exactly 2 paths it UNWRAPS the branch — the surviving path's
 *    elements splice back into the rung series (a 1-path branch is not a
 *    branch).
 *  - The Branch palette button hides while the selection sits inside a
 *    branch path (no nesting per spec); the armed-BR gap guard also refuses
 *    in-branch drops when nothing is selected.
 *  - Big-UI: listens for bus 'bigui:changed' and mirrors it as the
 *    .ed-bigui class on the editor root (the app's body.bigui also works —
 *    both are CSS-driven).
 *  - After placing an element it is auto-selected (panel opens so the student
 *    immediately picks the tag) and the palette disarms — one placement per arm.
 *  - No-nesting guard: while Branch is armed, + gaps inside branch paths render
 *    forbidden and refuse the drop with a hint. This is the palette-first
 *    equivalent of "Branch button disabled while an in-branch gap is targeted".
 *  - "Wrap in branch" is offered only for a selected top-level non-branch
 *    element (wrapping inside a path would nest branches).
 *  - getProgram() recomputes usesMotor := (program references the MOTOR tag),
 *    so the sim's motor widget tracks what the student actually wired.
 *  - Any mutation closes the validation list — its rung indices go stale the
 *    moment the program changes; re-run Validate for a fresh list.
 *  - A tag present on a loaded element but outside the fixed lists (a named
 *    internal bit like STEP1 from a built-in program) is preserved and offered
 *    in the dropdown under "Program tags", so opening built-ins is lossless.
 *  - Load performs a shape check only (rungs/items/known types/no nested BR);
 *    semantic checks stay LL.Validate's job.
 */
window.LL = window.LL || {};

LL.Editor = (function () {
  'use strict';

  /* ================= fixed tag universe (SPEC.md) ================= */

  var INPUT_TAGS = ['PB_START', 'PB_STOP', 'PED_NS', 'PED_EW', 'LOOP_EW', 'SW_NIGHT', 'SW_STOP'];
  var OUTPUT_TAGS = ['NS_GRN', 'NS_YEL', 'NS_RED', 'EW_GRN', 'EW_YEL', 'EW_RED', 'WALK_NS', 'WALK_EW', 'MOTOR'];
  var BIT_TAGS = [], TIMER_TAGS = [], COUNTER_TAGS = [];
  var TIMER_MEMBER_TAGS = [], COUNTER_MEMBER_TAGS = [];
  (function buildTagLists() {
    var i, j, members = ['.DN', '.TT', '.EN'];
    for (i = 1; i <= 12; i++) BIT_TAGS.push('B' + i);
    for (i = 1; i <= 8; i++) TIMER_TAGS.push('T' + i);
    for (i = 1; i <= 4; i++) COUNTER_TAGS.push('C' + i);
    for (i = 0; i < TIMER_TAGS.length; i++)
      for (j = 0; j < members.length; j++) TIMER_MEMBER_TAGS.push(TIMER_TAGS[i] + members[j]);
    for (i = 0; i < COUNTER_TAGS.length; i++) COUNTER_MEMBER_TAGS.push(COUNTER_TAGS[i] + '.DN');
  })();

  /* ================= element metadata ================= */

  /* cls: 'contact' | 'coil' | 'box' (visual class); preset: 'ms' | 'count' */
  var TYPE_INFO = {
    XIC: { name: 'Examine If Closed', cls: 'contact', glyph: '─┤ ├─',
      desc: 'Normally-open contact. Passes rung power while its tag is ON (1). ' +
            'Think “is this thing on?” — a pressed button, an energized coil, a done timer bit like T1.DN.' },
    XIO: { name: 'Examine If Open', cls: 'contact', glyph: '─┤/├─',
      desc: 'Normally-closed contact. Passes rung power while its tag is OFF (0) and blocks when it is ON. ' +
            'Classic use: a stop button — power flows until the button is pressed.' },
    ONS: { name: 'One-Shot', cls: 'contact', glyph: '─[ONS]─',
      desc: 'Passes power for exactly ONE scan when its input goes false→true, then blocks until the input ' +
            'drops and rises again. The tag is its private storage bit — every ONS needs its own, unshared bit.' },
    OTE: { name: 'Output Energize', cls: 'coil', glyph: '─( )─',
      desc: 'The plain coil. Writes its tag every scan: ON while the rung has power, OFF the instant it does not. ' +
            'If two OTEs write the same tag, the last rung solved wins.' },
    OTL: { name: 'Output Latch', cls: 'coil', glyph: '─(L)─',
      desc: 'When the rung has power it turns the tag ON — and the tag STAYS on after power goes away. ' +
            'Only an OTU on the same tag turns it back off. Latch here, unlatch somewhere else.' },
    OTU: { name: 'Output Unlatch', cls: 'coil', glyph: '─(U)─',
      desc: 'When the rung has power it turns the tag OFF (and it stays off). ' +
            'Partner of OTL — together they make set/reset step logic.' },
    TON: { name: 'Timer On-Delay', cls: 'box', preset: 'ms',
      desc: 'While the rung has power the timer accumulates simulated time; when it reaches the preset, ' +
            'its .DN bit turns ON. Losing rung power resets it to zero. Use the T tag’s .DN/.TT/.EN bits in contacts elsewhere.' },
    TOF: { name: 'Timer Off-Delay', cls: 'box', preset: 'ms',
      desc: '.DN turns ON immediately when the rung has power — and stays ON for the preset time AFTER power is removed. ' +
            'A “keep it going a little longer” timer (fan run-on, door hold).' },
    CTU: { name: 'Count Up', cls: 'box', preset: 'count',
      desc: 'Adds 1 to the counter each time rung power goes false→true (rising edge only — holding power does not keep counting). ' +
            '.DN turns ON once the count reaches the preset. Clear it with a RES.' },
    CTD: { name: 'Count Down', cls: 'box', preset: 'count',
      desc: 'Subtracts 1 from the counter on each rising edge of rung power. .DN stays ON while the count is at or above ' +
            'the preset. Usually paired with a CTU addressing the same counter.' },
    RES: { name: 'Reset', cls: 'coil', glyph: '─(RES)─',
      desc: 'While the rung has power, clears the addressed timer (accumulated time and status bits) or counter ' +
            '(count back to 0) every scan. Point it at a T or C tag.' },
    BR:  { name: 'Branch (parallel paths)', cls: 'branch', glyph: '┲┃┺',
      desc: 'Parallel paths — a ladder OR. Power flows into every path; if ANY path conducts, power continues after ' +
            'the branch. The classic seal-in: start button on one path, the output’s own contact on the other. ' +
            'Branches cannot contain other branches.' }
  };

  var CONTACT_CLASS = { XIC: 1, XIO: 1 }; /* full member lists (T*.DN/.TT/.EN, C*.DN) */
  var PALETTE_GROUPS = [['XIC', 'XIO', 'ONS'], ['OTE', 'OTL', 'OTU'], ['TON', 'TOF'], ['CTU', 'CTD', 'RES'], ['BR']];
  var UNDO_CAP = 50;

  /* ================= state ================= */

  var S = {
    ctx: null,
    root: null,           /* .ed-root */
    rungsEl: null,        /* scrolling rung list */
    zones: {},            /* armbar / note / error / validation / panel containers */
    tb: {},               /* toolbar element refs */
    fileInput: null,
    program: null,
    undo: [],
    armed: null,          /* palette type string, or null */
    selected: null,       /* reference to the selected element object (incl. BR), or null */
    validation: null,     /* array from LL.Validate.check, or null = panel closed */
    runNote: null,        /* status line shown in the validation header after Run */
    starterNote: null,    /* challenge banner text */
    loadError: null,      /* friendly load-failure text */
    hint: null,           /* transient armbar hint */
    hintTimer: 0,
    keysBound: false
  };

  /* ================= small utilities ================= */

  function deepClone(o) {
    if (window.LL && LL.Util && typeof LL.Util.deepClone === 'function') return LL.Util.deepClone(o);
    return JSON.parse(JSON.stringify(o));
  }

  function dom(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function btn(cls, text, title, onclick) {
    var b = dom('button', cls, text);
    b.type = 'button';
    if (title) {
      b.title = title;
      /* symbol-only buttons (✕ ▲ ⧉ …) need the title as their accessible name;
         text buttons keep their visible label as the name */
      if (!text || text.length <= 2) b.setAttribute('aria-label', title);
    }
    if (onclick) b.addEventListener('click', onclick);
    return b;
  }

  function pad4(n) { return String(n).padStart(4, '0'); }
  function fmtSec(ms) { return (Math.round((ms || 0) / 100) / 10).toFixed(1); }
  function hasTag(it) { return typeof it.tag === 'string' && it.tag.length > 0; }
  function needsPreset(t) { return !!TYPE_INFO[t].preset; }

  function newEmptyProgram() {
    return {
      id: 'student',
      name: 'My Program',
      description: 'Student program built in the Ladder Lab editor',
      usesMotor: false,
      rungs: [{ items: [] }]   /* one empty rung, ready for the first tap */
    };
  }

  function newElement(t) {
    if (t === 'BR') return { t: 'BR', paths: [[], []] };
    var el = { t: t, tag: '' };
    if (TYPE_INFO[t].preset === 'ms') el.pre = 1000;
    if (TYPE_INFO[t].preset === 'count') el.pre = 1;
    return el;
  }

  /* strip engine-assigned element ids (and nothing else) from a series, recursing into branch paths */
  function stripIds(series) {
    if (!Array.isArray(series)) return;
    for (var i = 0; i < series.length; i++) {
      var it = series[i];
      if (!it || typeof it !== 'object') continue;
      delete it.id;
      if (it.t === 'BR' && Array.isArray(it.paths))
        for (var p = 0; p < it.paths.length; p++) stripIds(it.paths[p]);
    }
  }

  /* ---- default-tag pick: "first unused sensible tag" ---- */

  /* Walk the whole program once and collect which tags are in use, per role. */
  function scanUsage() {
    var u = { any: {}, coil: {}, timer: {}, counter: {}, boxOrder: [] };
    function walk(series) {
      for (var i = 0; i < series.length; i++) {
        var it = series[i];
        if (!it || typeof it !== 'object') continue;
        if (it.t === 'BR' && Array.isArray(it.paths)) {
          for (var p = 0; p < it.paths.length; p++) walk(it.paths[p]);
          continue;
        }
        if (typeof it.tag === 'string' && it.tag) {
          u.any[it.tag.split('.')[0]] = true;
          if (it.t === 'OTE' || it.t === 'OTL' || it.t === 'OTU') u.coil[it.tag] = true;
          if (it.t === 'TON' || it.t === 'TOF') { u.timer[it.tag] = true; if (u.boxOrder.indexOf(it.tag) < 0) u.boxOrder.push(it.tag); }
          if (it.t === 'CTU' || it.t === 'CTD') { u.counter[it.tag] = true; if (u.boxOrder.indexOf(it.tag) < 0) u.boxOrder.push(it.tag); }
        }
      }
    }
    if (S.program) for (var r = 0; r < S.program.rungs.length; r++) walk(S.program.rungs[r].items);
    return u;
  }

  function firstFree(list, usedMap) {
    for (var i = 0; i < list.length; i++) if (!usedMap[list[i]]) return list[i];
    return list[0];  /* everything taken — B1/first output is still a sane start */
  }

  function defaultTagFor(t) {
    var u = scanUsage();
    if (t === 'XIC' || t === 'XIO' || t === 'ONS') return firstFree(BIT_TAGS, u.any);
    if (t === 'OTE' || t === 'OTL' || t === 'OTU') return firstFree(OUTPUT_TAGS, u.coil);
    if (t === 'TON' || t === 'TOF') return firstFree(TIMER_TAGS, u.timer);
    if (t === 'CTU' || t === 'CTD') return firstFree(COUNTER_TAGS, u.counter);
    if (t === 'RES') return u.boxOrder.length ? u.boxOrder[0] : 'T1';
    return '';
  }

  function seriesMentionsMotor(series) {
    for (var i = 0; i < series.length; i++) {
      var it = series[i];
      if (it.t === 'BR' && Array.isArray(it.paths)) {
        for (var p = 0; p < it.paths.length; p++)
          if (seriesMentionsMotor(it.paths[p])) return true;
      } else if (it.tag === 'MOTOR') return true;
    }
    return false;
  }

  /* Locate an element object in the program. Returns
     {r, series, idx, inBranch, br} or null. A top-level BR is found with inBranch:false. */
  function findLoc(el) {
    if (!S.program) return null;
    for (var r = 0; r < S.program.rungs.length; r++) {
      var items = S.program.rungs[r].items;
      for (var i = 0; i < items.length; i++) {
        if (items[i] === el) return { r: r, series: items, idx: i, inBranch: false, br: null };
        if (items[i].t === 'BR' && Array.isArray(items[i].paths)) {
          for (var p = 0; p < items[i].paths.length; p++) {
            var path = items[i].paths[p];
            for (var j = 0; j < path.length; j++)
              if (path[j] === el) return { r: r, series: path, idx: j, inBranch: true, br: items[i] };
          }
        }
      }
    }
    return null;
  }

  /* ================= mutation / undo ================= */

  function pushUndo() {
    S.undo.push(deepClone(S.program));
    if (S.undo.length > UNDO_CAP) S.undo.shift();
  }

  /* every model change goes through here: snapshot → apply → validation stale */
  function mutate(fn) {
    pushUndo();
    fn();
    S.validation = null;
    S.runNote = null;
  }

  function doUndo() {
    if (!S.undo.length) return;
    S.program = S.undo.pop();
    S.selected = null;         /* object identities changed — selection is stale */
    S.validation = null;
    S.runNote = null;
    renderAll();
  }

  /* ================= transient hint (armbar area) ================= */

  function hint(text) {
    S.hint = text;
    if (S.hintTimer) clearTimeout(S.hintTimer);
    S.hintTimer = setTimeout(function () { S.hint = null; S.hintTimer = 0; renderArmbar(); }, 2600);
    renderArmbar();
  }

  /* ================= tag dropdown data ================= */

  /* Grouped tag options per element type; groups are [label, tags[]] */
  function tagGroupsFor(t) {
    if (CONTACT_CLASS[t]) {
      return [
        ['Inputs', INPUT_TAGS], ['Outputs', OUTPUT_TAGS], ['Bits', BIT_TAGS],
        ['Timers', TIMER_MEMBER_TAGS], ['Counters', COUNTER_MEMBER_TAGS]
      ];
    }
    if (t === 'ONS') return [['Bits (one-shot storage)', BIT_TAGS]];
    if (t === 'OTE' || t === 'OTL' || t === 'OTU') return [['Outputs', OUTPUT_TAGS], ['Bits', BIT_TAGS]];
    if (t === 'TON' || t === 'TOF') return [['Timers', TIMER_TAGS]];
    if (t === 'CTU' || t === 'CTD') return [['Counters', COUNTER_TAGS]];
    if (t === 'RES') return [['Timers', TIMER_TAGS], ['Counters', COUNTER_TAGS]];
    return [];
  }

  /* ================= interaction handlers ================= */

  function armPalette(t) {
    if (S.armed === t) { S.armed = null; renderAll(); return; }  /* click again = cancel */
    S.armed = t;
    S.selected = null;  /* arming closes the selection panel — one mode at a time */
    renderAll();
  }

  function onGapTap(series, at, meta) {
    if (!S.armed) {
      hint('Pick an instruction from the palette first — then tap a ＋ gap.');
      return;
    }
    if (S.armed === 'BR' && meta.inBranch) {
      hint('Branches can’t nest — place the branch on the main rung line instead.');
      return;
    }
    var placed = newElement(S.armed);
    if (placed.t !== 'BR') placed.tag = defaultTagFor(placed.t);  /* first unused sensible tag */
    mutate(function () { series.splice(at, 0, placed); });
    S.armed = null;
    S.selected = placed;   /* open the panel so the tag gets set right away */
    renderAll();
    /* keep the fresh chip visible above the docked panel */
    var chip = S.rungsEl ? S.rungsEl.querySelector('.ed-chip-sel, .ed-branch-sel') : null;
    if (chip && chip.scrollIntoView) chip.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  }

  function selectElement(el) {
    S.armed = null;
    S.selected = (S.selected === el) ? null : el;
    renderAll();
  }

  function deselect() { S.selected = null; renderAll(); }

  function deleteSelected() {
    var loc = findLoc(S.selected);
    if (!loc) { S.selected = null; renderAll(); return; }
    mutate(function () { loc.series.splice(loc.idx, 1); });
    S.selected = null;
    renderAll();
  }

  function wrapSelectedInBranch() {
    var el = S.selected;
    var loc = findLoc(el);
    if (!loc || loc.inBranch || el.t === 'BR') return;
    mutate(function () { loc.series[loc.idx] = { t: 'BR', paths: [[el], []] }; });
    /* keep the element selected — it now lives on path 0 of the new branch */
    renderAll();
  }

  function addBranchPath(br) {
    if (br.paths.length >= 4) return;
    mutate(function () { br.paths.push([]); });
    renderAll();
  }

  function deleteBranchPath(br, pi) {
    if (br.paths.length > 2) {
      mutate(function () { br.paths.splice(pi, 1); });
    } else {
      /* exactly 2 paths: removing one leaves a 1-path "branch", which is no
         branch at all — unwrap the survivor back into the rung series */
      var loc = findLoc(br);
      if (!loc) return;
      var keep = br.paths[pi === 0 ? 1 : 0];
      mutate(function () {
        Array.prototype.splice.apply(loc.series, [loc.idx, 1].concat(keep));
      });
      if (S.selected === br) S.selected = null;
    }
    if (S.selected && !findLoc(S.selected)) S.selected = null;
    renderAll();
  }

  /* --- rung operations --- */

  function addRung() {
    mutate(function () { S.program.rungs.push({ items: [] }); });
    renderAll();
    if (S.rungsEl) S.rungsEl.scrollTop = S.rungsEl.scrollHeight;
  }

  function deleteRung(r) {
    var rung = S.program.rungs[r];
    var hasContent = (rung && ((rung.items && rung.items.length) || rung.comment));
    if (hasContent && !window.confirm('Delete rung ' + (r + 1) + ' and everything on it?')) return;
    mutate(function () { S.program.rungs.splice(r, 1); });
    if (S.selected && !findLoc(S.selected)) S.selected = null;
    renderAll();
  }

  function duplicateRung(r) {
    mutate(function () {
      var copy = deepClone(S.program.rungs[r]);
      stripIds(copy.items);
      S.program.rungs.splice(r + 1, 0, copy);
    });
    renderAll();
  }

  function moveRung(r, dir) {
    var to = r + dir;
    if (to < 0 || to >= S.program.rungs.length) return;
    mutate(function () {
      var tmp = S.program.rungs[r];
      S.program.rungs[r] = S.program.rungs[to];
      S.program.rungs[to] = tmp;
    });
    renderAll();
  }

  /* ================= validation / run ================= */

  function runValidate() {
    var prog = api.getProgram();
    if (!(window.LL && LL.Validate && typeof LL.Validate.check === 'function')) {
      S.loadError = 'Internal: LL.Validate is not available — engine.js must load before the editor.';
      S.validation = null;
      return null;
    }
    try {
      S.validation = LL.Validate.check(prog) || [];
    } catch (e) {
      S.loadError = 'Internal: the validator threw an error (' + e.message + ').';
      S.validation = null;
      return null;
    }
    return S.validation;
  }

  function doValidate() {
    S.runNote = null;
    runValidate();
    renderAll();
  }

  function doRun() {
    var res = runValidate();
    if (res === null) { renderAll(); return; }
    var errors = 0, warns = 0, i;
    for (i = 0; i < res.length; i++) (res[i].level === 'error' ? errors++ : warns++);
    if (errors > 0) {
      S.runNote = 'Not running — fix the ' + errors + (errors === 1 ? ' error' : ' errors') + ' below first (warnings are OK).';
    } else {
      S.runNote = warns > 0 ? 'Sent to the PLC with warnings ▶' : 'Program sent to the PLC ▶';
      S.ctx.bus.emit('editor:run', { program: api.getProgram() });
    }
    renderAll();
  }

  function flashRung(r) {
    if (!S.rungsEl) return;
    var el = S.rungsEl.querySelector('.ed-rung[data-r="' + r + '"]');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('ed-flash');
    /* force restart of the animation */
    void el.offsetWidth;
    el.classList.add('ed-flash');
    setTimeout(function () { el.classList.remove('ed-flash'); }, 1600);
  }

  /* ================= save / load / clear ================= */

  function doSave() {
    var p = Object.assign({ ladderlab: 1 }, api.getProgram());  /* file-format marker first */
    var json = JSON.stringify(p, null, 2);
    /* dev-harness hook: the throwaway test driver intercepts saves here */
    if (typeof window.__DEV_CAPTURE_SAVE === 'function') { window.__DEV_CAPTURE_SAVE(json); return; }
    var base = (p.name || 'ladder-program').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_');
    if (!base) base = 'ladder-program';
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = base + '.ladderlab.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }

  /* Basic shape check with a friendly plain-English reason (semantic checks are LL.Validate's job). */
  function shapeError(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return 'the file is not a Ladder Lab program (expected a JSON object).';
    if (!Array.isArray(p.rungs)) return 'the file has no "rungs" list — is it really a saved ladder program?';
    for (var r = 0; r < p.rungs.length; r++) {
      var rung = p.rungs[r];
      if (!rung || typeof rung !== 'object' || !Array.isArray(rung.items))
        return 'rung ' + r + ' is malformed (each rung needs an "items" list).';
      var err = shapeErrorSeries(rung.items, r, false);
      if (err) return err;
    }
    return null;
  }

  function shapeErrorSeries(series, r, inBranch) {
    for (var i = 0; i < series.length; i++) {
      var it = series[i];
      if (!it || typeof it !== 'object') return 'rung ' + r + ' contains something that is not an instruction.';
      if (it.t === 'BR') {
        if (inBranch) return 'rung ' + r + ' has a branch inside a branch — nesting is not allowed.';
        if (!Array.isArray(it.paths)) return 'rung ' + r + ' has a branch without a "paths" list.';
        for (var p = 0; p < it.paths.length; p++) {
          if (!Array.isArray(it.paths[p])) return 'rung ' + r + ' has a branch path that is not a list.';
          var err = shapeErrorSeries(it.paths[p], r, true);
          if (err) return err;
        }
      } else {
        if (!TYPE_INFO[it.t]) return 'rung ' + r + ' uses an unknown instruction "' + it.t + '".';
        if (it.tag !== undefined && typeof it.tag !== 'string') return 'rung ' + r + ' has a non-text tag.';
        if (it.pre !== undefined && typeof it.pre !== 'number') return 'rung ' + r + ' has a non-numeric preset.';
      }
    }
    return null;
  }

  function doLoadFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var parsed, err;
      try { parsed = JSON.parse(String(reader.result)); }
      catch (e) { err = 'the file is not valid JSON (' + e.message + ').'; }
      if (!err) err = shapeError(parsed);
      if (err) {
        S.loadError = 'Couldn’t load “' + file.name + '” — ' + err;
        renderAll();
        return;
      }
      mutate(function () {  /* load is undoable — snapshot the program it replaces */
        S.program = deepClone(parsed);
        delete S.program.ladderlab;   /* file marker, not program data */
        stripProgramIds(S.program);
      });
      S.selected = null;
      S.armed = null;
      S.loadError = null;
      renderAll();
    };
    reader.onerror = function () {
      S.loadError = 'Couldn’t read “' + file.name + '” from disk.';
      renderAll();
    };
    reader.readAsText(file);
  }

  function stripProgramIds(p) {
    for (var r = 0; r < p.rungs.length; r++) stripIds(p.rungs[r].items);
  }

  function doNew() {
    if (!window.confirm('Start a new program? The current ladder will be replaced (Undo brings it back).')) return;
    mutate(function () { S.program = newEmptyProgram(); });  /* undoable */
    S.selected = null;
    S.armed = null;
    S.loadError = null;
    S.starterNote = null;
    renderAll();
  }

  /* ================= keyboard ================= */

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (S.armed) { S.armed = null; renderAll(); }
      else if (S.selected) { deselect(); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      doUndo();
    }
  }

  /* ================= rendering ================= */

  function renderAll() {
    if (!S.root) return;
    /* drop a selection whose element vanished (undo, path delete, load...) */
    if (S.selected && !findLoc(S.selected)) S.selected = null;
    var st = S.rungsEl ? S.rungsEl.scrollTop : 0;
    renderToolbarState();
    renderArmbar();
    renderBanners();
    renderRungs();
    renderValidation();
    renderPanel();
    if (S.rungsEl) S.rungsEl.scrollTop = st;
  }

  /* --- toolbar (built once; state refreshed here) --- */

  function buildToolbar() {
    var bar = dom('div', 'ed-toolbar');

    var row1 = dom('div', 'ed-tb-row');
    row1.appendChild(btn('ed-btn', '⊕ New', 'Start a new empty program (asks first)', doNew));
    row1.appendChild(btn('ed-btn', '📂 Load', 'Load a saved .ladderlab.json program', function () {
      S.fileInput.value = '';
      S.fileInput.click();
    }));
    row1.appendChild(btn('ed-btn', '💾 Save', 'Download the program as a .ladderlab.json file', doSave));

    var nameWrap = dom('label', 'ed-name');
    nameWrap.appendChild(dom('span', 'ed-name-label', 'Program'));
    S.tb.name = dom('input', 'ed-name-input');
    S.tb.name.type = 'text';
    S.tb.name.spellcheck = false;
    S.tb.name.setAttribute('aria-label', 'Program name');
    S.tb.name.addEventListener('change', function () {
      var v = S.tb.name.value.trim() || 'My Program';
      if (v !== S.program.name) { mutate(function () { S.program.name = v; }); renderAll(); }
    });
    nameWrap.appendChild(S.tb.name);
    row1.appendChild(nameWrap);

    row1.appendChild(dom('span', 'ed-tb-spacer'));
    S.tb.undo = btn('ed-btn', '↶ Undo', 'Undo (Ctrl+Z) — up to ' + UNDO_CAP + ' steps', doUndo);
    row1.appendChild(S.tb.undo);
    row1.appendChild(btn('ed-btn', '✔ Validate', 'Check the program for problems', doValidate));
    row1.appendChild(btn('ed-btn ed-btn-run', '▶ Run My Program', 'Validate, then send the program to the PLC', doRun));
    bar.appendChild(row1);

    var row2 = dom('div', 'ed-tb-row ed-palette');
    row2.appendChild(dom('span', 'ed-pal-label', 'INSTRUCTIONS'));
    S.tb.palette = {};
    for (var g = 0; g < PALETTE_GROUPS.length; g++) {
      if (g > 0) {
        var div = dom('span', 'ed-pal-divider');
        if (PALETTE_GROUPS[g][0] === 'BR') S.tb.brDivider = div;  /* hides along with the Branch button */
        row2.appendChild(div);
      }
      var group = dom('span', 'ed-pal-group');
      for (var k = 0; k < PALETTE_GROUPS[g].length; k++) {
        (function (t) {
          var info = TYPE_INFO[t];
          var b = btn('ed-pal-btn', null, info.name + ' — tap, then tap a ＋ gap', function () { armPalette(t); });
          b.dataset.t = t;
          b.appendChild(dom('span', 'ed-pal-name', t === 'BR' ? 'Branch' : t));
          b.appendChild(dom('span', 'ed-pal-glyph', info.glyph || info.name.split(' ')[0]));
          S.tb.palette[t] = b;
          group.appendChild(b);
        })(PALETTE_GROUPS[g][k]);
      }
      row2.appendChild(group);
    }
    bar.appendChild(row2);
    return bar;
  }

  function renderToolbarState() {
    S.tb.undo.disabled = S.undo.length === 0;
    if (document.activeElement !== S.tb.name) S.tb.name.value = S.program.name || '';
    for (var t in S.tb.palette) {
      if (S.tb.palette.hasOwnProperty(t))
        S.tb.palette[t].classList.toggle('ed-armed', S.armed === t);
    }
    /* no nesting: hide the Branch button while the selection sits inside a branch path */
    var loc = S.selected ? findLoc(S.selected) : null;
    var hideBR = !!(loc && loc.inBranch);
    S.tb.palette.BR.hidden = hideBR;
    if (S.tb.brDivider) S.tb.brDivider.hidden = hideBR;
  }

  /* --- armbar (armed status + transient hints) --- */

  function renderArmbar() {
    var z = S.zones.armbar;
    z.textContent = '';
    if (S.hint) {
      z.className = 'ed-armbar ed-armbar-hint';
      z.appendChild(dom('span', 'ed-armbar-text', S.hint));
      z.hidden = false;
      return;
    }
    if (!S.armed) { z.hidden = true; return; }
    z.className = 'ed-armbar';
    var name = S.armed === 'BR' ? 'Branch' : S.armed;
    var msg = 'Tap a ＋ slot to place ' + name + ' — Esc (or tapping ' + name + ' again) cancels';
    if (S.armed === 'BR') msg += '. Branches go on the main rung line only (no nesting)';
    if (!S.program.rungs.length) msg += ' — add a rung first!';
    z.appendChild(dom('span', 'ed-armbar-text', msg));
    z.appendChild(btn('ed-btn ed-btn-small', 'Cancel (Esc)', 'Cancel placing', function () { S.armed = null; renderAll(); }));
    z.hidden = false;
  }

  /* --- banners --- */

  function renderBanners() {
    var note = S.zones.note;
    note.textContent = '';
    if (S.starterNote) {
      note.appendChild(dom('span', 'ed-note-pin', '📌'));
      note.appendChild(dom('span', 'ed-note-text', S.starterNote));
      note.hidden = false;
    } else note.hidden = true;

    var errz = S.zones.error;
    errz.textContent = '';
    if (S.loadError) {
      errz.appendChild(dom('span', 'ed-errb-text', S.loadError));
      errz.appendChild(btn('ed-iconbtn ed-errb-close', '✕', 'Dismiss', function () { S.loadError = null; renderAll(); }));
      errz.hidden = false;
    } else errz.hidden = true;
  }

  /* --- rung list --- */

  function renderRungs() {
    var host = S.rungsEl;
    host.textContent = '';
    if (!S.program.rungs.length) {
      var empty = dom('div', 'ed-empty');
      empty.appendChild(dom('div', 'ed-empty-icon', '─┤ ├─'));
      empty.appendChild(dom('p', 'ed-empty-title', 'No rungs yet.'));
      empty.appendChild(dom('p', 'ed-empty-text',
        'Add a rung, then tap an instruction in the palette and tap a ＋ gap to place it. ' +
        'Tap any placed element to set its tag. When it looks right, hit ▶ Run My Program.'));
      host.appendChild(empty);
    } else {
      for (var r = 0; r < S.program.rungs.length; r++) host.appendChild(buildRungRow(r));
    }
    /* "+ Rung" lives at the bottom of the list, where the new rung appears */
    host.appendChild(btn('ed-btn ed-addrung', '＋ Rung', 'Add an empty rung at the bottom', addRung));
  }

  function buildRungRow(r) {
    var rung = S.program.rungs[r];
    var row = dom('section', 'ed-rung');
    row.dataset.r = r;

    var head = dom('div', 'ed-rung-head');
    head.appendChild(dom('span', 'ed-rung-num', pad4(r + 1)));  /* display 1-based, like validator messages */
    head.appendChild(buildComment(rung));
    var ops = dom('span', 'ed-rung-btns');
    var up = btn('ed-iconbtn', '▲', 'Move rung up', function () { moveRung(r, -1); });
    up.disabled = r === 0;
    var dn = btn('ed-iconbtn', '▼', 'Move rung down', function () { moveRung(r, +1); });
    dn.disabled = r === S.program.rungs.length - 1;
    ops.appendChild(up);
    ops.appendChild(dn);
    ops.appendChild(btn('ed-iconbtn', '⧉', 'Duplicate rung', function () { duplicateRung(r); }));
    ops.appendChild(btn('ed-iconbtn ed-iconbtn-danger', '✕', 'Delete rung', function () { deleteRung(r); }));
    head.appendChild(ops);
    row.appendChild(head);

    var body = dom('div', 'ed-rung-body');
    body.appendChild(buildStrip(rung.items, { r: r, inBranch: false }));
    row.appendChild(body);
    return row;
  }

  function buildComment(rung) {
    var has = typeof rung.comment === 'string' && rung.comment.length > 0;
    var c = dom('span', 'ed-comment' + (has ? '' : ' ed-comment-empty'), has ? rung.comment : '✎ add a comment');
    c.title = 'Click to edit the rung comment';
    c.setAttribute('role', 'button');
    c.tabIndex = 0;
    function openEditor() {
      var input = dom('input', 'ed-comment-input');
      input.type = 'text';
      input.value = rung.comment || '';
      input.spellcheck = false;
      input.setAttribute('aria-label', 'Rung comment');
      var cancelled = false;
      input.addEventListener('keydown', function (e) {
        e.stopPropagation();  /* keep Esc/Ctrl+Z local while typing */
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') { cancelled = true; input.blur(); }
      });
      input.addEventListener('blur', function () {
        if (!cancelled) {
          var v = input.value.trim();
          if (v !== (rung.comment || '')) {
            mutate(function () { if (v) rung.comment = v; else delete rung.comment; });
          }
        }
        renderAll();
      });
      c.replaceWith(input);
      input.focus();
      input.select();
    }
    c.addEventListener('click', openEditor);
    c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditor(); } });
    return c;
  }

  /* --- series strip: gap el gap el ... gap --- */

  function buildStrip(series, meta) {
    var strip = dom('div', 'ed-strip' + (meta.inBranch ? ' ed-strip-branch' : ''));
    strip.appendChild(buildGap(series, 0, meta));
    for (var i = 0; i < series.length; i++) {
      var it = series[i];
      strip.appendChild(it.t === 'BR' ? buildBranch(it, meta) : buildChip(it));
      strip.appendChild(buildGap(series, i + 1, meta));
    }
    return strip;
  }

  function buildGap(series, at, meta) {
    var forbid = S.armed === 'BR' && meta.inBranch;
    var g = btn('ed-gap' + (S.armed ? (forbid ? ' ed-gap-forbid' : ' ed-gap-hot') : ''),
      null,
      forbid ? 'Branches can’t nest' : 'Insert here',
      function () { onGapTap(series, at, meta); });
    g.appendChild(dom('span', 'ed-gap-plus', '＋'));
    return g;
  }

  function buildChip(it) {
    var info = TYPE_INFO[it.t] || { name: it.t, cls: 'contact', glyph: it.t };
    var missing = !hasTag(it);
    var cls = 'ed-chip ed-chip-' + info.cls;
    if (missing) cls += ' ed-chip-warn';
    if (S.selected === it) cls += ' ed-chip-sel';
    var c = btn(cls, null, it.t + ' — ' + info.name, function () { selectElement(it); });
    c.appendChild(dom('span', 'ed-chip-tag' + (missing ? ' ed-chip-tag-warn' : ''),
      missing ? '⚠ ‹tag?›' : it.tag));
    if (info.cls === 'box') {
      c.appendChild(dom('span', 'ed-chip-glyph', it.t));
      var preTxt = info.preset === 'ms' ? 'PRE ' + fmtSec(it.pre) + ' s' : 'PRE ' + (it.pre || 0);
      c.appendChild(dom('span', 'ed-chip-pre' + (it.pre ? '' : ' ed-chip-pre-warn'), preTxt));
    } else {
      c.appendChild(dom('span', 'ed-chip-glyph', info.glyph));
    }
    return c;
  }

  /* --- branch group: selectable handle + stacked path rows + add-path --- */

  function buildBranch(br, meta) {
    var wrap = dom('div', 'ed-branch' + (S.selected === br ? ' ed-branch-sel' : ''));

    var handle = btn('ed-br-handle', null, 'Branch — tap to select', function () { selectElement(br); });
    handle.appendChild(dom('span', 'ed-br-handle-glyph', 'BR'));
    wrap.appendChild(handle);

    var main = dom('div', 'ed-br-main');
    var paths = Array.isArray(br.paths) ? br.paths : [];
    for (var p = 0; p < paths.length; p++) {
      (function (pi) {
        var rowEl = dom('div', 'ed-br-path');
        rowEl.appendChild(buildStrip(paths[pi], { r: meta.r, inBranch: true }));
        rowEl.appendChild(btn('ed-iconbtn ed-iconbtn-danger ed-br-delpath', '✕',
          paths.length === 2 ? 'Delete this path (unwraps the branch back to a series)' : 'Delete this path',
          function () { deleteBranchPath(br, pi); }));
        main.appendChild(rowEl);
      })(p);
    }
    var add = btn('ed-btn ed-btn-small ed-br-addpath', '＋ path',
      'Add a parallel path (max 4)', function () { addBranchPath(br); });
    add.disabled = paths.length >= 4;
    main.appendChild(add);
    wrap.appendChild(main);
    return wrap;
  }

  /* --- validation results panel --- */

  function renderValidation() {
    var z = S.zones.validation;
    z.textContent = '';
    if (S.validation === null) { z.hidden = true; return; }
    z.hidden = false;

    var errors = 0, warns = 0, i;
    for (i = 0; i < S.validation.length; i++) (S.validation[i].level === 'error' ? errors++ : warns++);

    var head = dom('div', 'ed-vhead');
    var counts = S.validation.length === 0 ? 'No problems found'
      : (errors + (errors === 1 ? ' error' : ' errors') + ', ' + warns + (warns === 1 ? ' warning' : ' warnings'));
    head.appendChild(dom('span', 'ed-vhead-title', 'Validation — ' + counts));
    if (S.runNote) head.appendChild(dom('span', 'ed-vhead-note' + (errors ? ' ed-vhead-note-bad' : ''), S.runNote));
    head.appendChild(dom('span', 'ed-tb-spacer'));
    head.appendChild(btn('ed-iconbtn', '✕', 'Close validation list', function () {
      S.validation = null; S.runNote = null; renderAll();
    }));
    z.appendChild(head);

    if (S.validation.length === 0) {
      z.appendChild(dom('div', 'ed-vok', '✓ Clean — no errors, no warnings. Ready to run.'));
      return;
    }
    for (i = 0; i < S.validation.length; i++) {
      (function (v) {
        var isErr = v.level === 'error';
        var whole = typeof v.rung !== 'number' || v.rung < 0;  /* -1 = whole-program issue */
        var item = btn('ed-vitem ' + (isErr ? 'ed-verr' : 'ed-vwarn'), null,
          whole ? 'Whole-program issue' : 'Show rung ' + (v.rung + 1),
          function () { if (!whole) flashRung(v.rung); });
        item.appendChild(dom('span', 'ed-vbadge', isErr ? 'ERROR' : 'WARN'));
        item.appendChild(dom('span', 'ed-vrung', whole ? 'Program' : 'Rung ' + pad4(v.rung + 1)));
        item.appendChild(dom('span', 'ed-vmsg', v.msg));
        z.appendChild(item);
      })(S.validation[i]);
    }
  }

  /* --- selection panel (docked at the bottom of the editor pane) --- */

  function renderPanel() {
    var z = S.zones.panel;
    z.textContent = '';
    if (!S.selected) { z.hidden = true; return; }
    z.hidden = false;

    var it = S.selected;
    var info = TYPE_INFO[it.t] || { name: it.t, desc: '', cls: 'contact' };
    var loc = findLoc(it);

    var head = dom('div', 'ed-panel-head');
    head.appendChild(dom('span', 'ed-panel-type ed-panel-type-' + info.cls, it.t === 'BR' ? 'BR' : it.t));
    head.appendChild(dom('span', 'ed-panel-name', info.name + (loc ? ' — rung ' + pad4(loc.r + 1) : '')));
    head.appendChild(dom('span', 'ed-tb-spacer'));
    head.appendChild(btn('ed-iconbtn ed-panel-close', '✕', 'Close (Esc)', deselect));
    z.appendChild(head);

    var body = dom('div', 'ed-panel-body');
    body.appendChild(dom('p', 'ed-panel-desc', info.desc));

    if (it.t === 'BR') {
      var pcount = dom('div', 'ed-field');
      pcount.appendChild(dom('span', 'ed-field-label', 'Paths'));
      pcount.appendChild(dom('span', 'ed-field-static', it.paths.length + ' of 4'));
      body.appendChild(pcount);
      var addp = btn('ed-btn', '＋ Add path', 'Add a parallel path (max 4)', function () { addBranchPath(it); });
      addp.disabled = it.paths.length >= 4;
      body.appendChild(addp);
      body.appendChild(btn('ed-btn ed-btn-danger', 'Delete Branch', 'Delete the whole branch and its paths', deleteSelected));
    } else {
      body.appendChild(buildTagField(it));
      if (needsPreset(it.t)) body.appendChild(buildPresetField(it));
      if (it.t === 'ONS') body.appendChild(dom('p', 'ed-panel-hint',
        'Each ONS needs its OWN storage bit — don’t reuse it anywhere else.'));
      if (loc && !loc.inBranch) {
        body.appendChild(btn('ed-btn', 'Wrap in branch (seal-in)',
          'Replace this element with a 2-path branch holding it — the classic seal-in move',
          wrapSelectedInBranch));
      }
      body.appendChild(btn('ed-btn ed-btn-danger', 'Delete Element', 'Remove this element', deleteSelected));
    }
    z.appendChild(body);
  }

  function buildTagField(it) {
    var f = dom('label', 'ed-field');
    f.appendChild(dom('span', 'ed-field-label', 'Tag'));
    var sel = dom('select', 'ed-select');
    sel.setAttribute('aria-label', 'Tag for ' + it.t);

    var unset = dom('option', null, '‹tag?› — choose…');
    unset.value = '';
    sel.appendChild(unset);

    var groups = tagGroupsFor(it.t);
    var found = !hasTag(it);
    for (var g = 0; g < groups.length; g++) {
      var og = document.createElement('optgroup');
      og.label = groups[g][0];
      var tags = groups[g][1];
      for (var i = 0; i < tags.length; i++) {
        var o = dom('option', null, tags[i]);
        o.value = tags[i];
        if (it.tag === tags[i]) found = true;
        og.appendChild(o);
      }
      sel.appendChild(og);
    }
    if (!found) {
      /* keep custom/internal tags from loaded programs (e.g. STEP1) lossless */
      var og2 = document.createElement('optgroup');
      og2.label = 'Program tags';
      var oc = dom('option', null, it.tag);
      oc.value = it.tag;
      og2.appendChild(oc);
      sel.appendChild(og2);
    }
    sel.value = hasTag(it) ? it.tag : '';
    sel.addEventListener('change', function () {
      var v = sel.value;
      mutate(function () { it.tag = v; });
      renderAll();
    });
    f.appendChild(sel);
    return f;
  }

  function buildPresetField(it) {
    var isMs = TYPE_INFO[it.t].preset === 'ms';
    var f = dom('label', 'ed-field');
    f.appendChild(dom('span', 'ed-field-label', isMs ? 'Preset (seconds)' : 'Preset (count)'));
    var inp = dom('input', 'ed-num');
    inp.type = 'number';
    inp.min = '0';
    inp.step = isMs ? '0.1' : '1';
    inp.value = isMs ? String(Math.round((it.pre || 0) / 100) / 10) : String(it.pre || 0);
    inp.setAttribute('aria-label', f.firstChild.textContent + ' for ' + it.t + ' ' + (it.tag || ''));
    inp.addEventListener('change', function () {
      var v = parseFloat(inp.value);
      if (isNaN(v) || v < 0) v = 0;
      var stored = isMs ? Math.round(v * 10) * 100 : Math.round(v);  /* snap ms to the 0.1 s grid */
      mutate(function () { it.pre = stored; });
      renderAll();
    });
    f.appendChild(inp);
    return f;
  }

  /* ================= public API ================= */

  var api = {
    init: function (containerEl, ctx) {
      S.ctx = ctx || { bus: { on: function () {}, emit: function () {} } };
      if (!S.program) S.program = newEmptyProgram();

      containerEl.classList.add('ed-host');
      containerEl.textContent = '';

      S.root = dom('div', 'ed-root');
      S.root.appendChild(buildToolbar());
      S.zones.armbar = dom('div', 'ed-armbar');
      S.zones.armbar.hidden = true;
      S.root.appendChild(S.zones.armbar);
      S.zones.note = dom('div', 'ed-note');
      S.zones.note.hidden = true;
      S.root.appendChild(S.zones.note);
      S.zones.error = dom('div', 'ed-errb');
      S.zones.error.hidden = true;
      S.root.appendChild(S.zones.error);
      S.rungsEl = dom('div', 'ed-rungs');
      S.root.appendChild(S.rungsEl);
      S.zones.validation = dom('div', 'ed-vpanel');
      S.zones.validation.hidden = true;
      S.root.appendChild(S.zones.validation);
      S.zones.panel = dom('div', 'ed-panel');
      S.zones.panel.hidden = true;
      S.root.appendChild(S.zones.panel);

      S.fileInput = dom('input');
      S.fileInput.type = 'file';
      S.fileInput.accept = '.json,application/json';
      S.fileInput.hidden = true;
      S.fileInput.addEventListener('change', function () {
        if (S.fileInput.files && S.fileInput.files[0]) doLoadFile(S.fileInput.files[0]);
      });
      S.root.appendChild(S.fileInput);

      containerEl.appendChild(S.root);

      if (!S.keysBound) {
        document.addEventListener('keydown', onKeyDown);
        S.keysBound = true;
      }

      /* Big-UI scaling is CSS-class driven: mirror ctx.bigUI now and follow
         the app's 'bigui:changed' bus event afterwards. */
      S.root.classList.toggle('ed-bigui', !!S.ctx.bigUI);
      if (S.ctx.bus && typeof S.ctx.bus.on === 'function') {
        S.ctx.bus.on('bigui:changed', function (d) {
          var on = (d && typeof d === 'object')
            ? !!(d.bigUI !== undefined ? d.bigUI : d.on)
            : !!d;
          S.root.classList.toggle('ed-bigui', on);
        });
      }
      renderAll();
    },

    /* Deep-clone a program in. Fresh document: undo stack, selection, armed
       state, validation and any stale challenge note are all cleared. */
    setProgram: function (programJson) {
      var p = programJson ? deepClone(programJson) : newEmptyProgram();
      delete p.ladderlab;   /* tolerate being handed a saved file object */
      if (!Array.isArray(p.rungs)) p.rungs = [];
      for (var r = 0; r < p.rungs.length; r++) {
        if (!p.rungs[r] || typeof p.rungs[r] !== 'object') p.rungs[r] = { items: [] };
        if (!Array.isArray(p.rungs[r].items)) p.rungs[r].items = [];
      }
      stripProgramIds(p);
      S.program = p;
      S.undo = [];
      S.selected = null;
      S.armed = null;
      S.validation = null;
      S.runNote = null;
      S.loadError = null;
      S.starterNote = null;
      renderAll();
    },

    /* Clean deep-cloned JSON out: engine ids stripped, usesMotor recomputed. */
    getProgram: function () {
      var p = deepClone(S.program || newEmptyProgram());
      stripProgramIds(p);
      var motor = false;
      for (var r = 0; r < p.rungs.length; r++) {
        if (p.rungs[r].comment === '') delete p.rungs[r].comment;
        if (seriesMentionsMotor(p.rungs[r].items)) motor = true;
      }
      p.usesMotor = motor;
      if (!p.id) p.id = 'student';
      if (!p.name) p.name = 'My Program';
      delete p.ladderlab;   /* never carry the file marker in program JSON */
      return p;
    },

    /* Challenges module: preload a starter (null = start empty) + pinned note. */
    loadChallengeStarter: function (programJson, lockedNote) {
      api.setProgram(programJson || null);
      S.starterNote = lockedNote || null;
      renderAll();
    }
  };

  return api;
})();
