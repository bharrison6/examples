/* ============================================================
 * Ladder Lab — app shell (LL.App)
 * Owns: the PLC instance, the deterministic main loop, stage switching,
 * program selector, run controls, teacher features, and all bus wiring.
 *
 * Determinism: scans advance simulated time by plc.scanMs per scan.
 * Wall clock (performance.now) is used ONLY to pace how many scans run
 * per animation frame — never inside logic. Order per tick (per SPEC):
 *   LL.Sim.prePlcTick(plc) -> plc.scan() -> LL.Sim.postPlcTick(plc, scanMs)
 *
 * KIT ADOPTION (lesson-shell v2): the four former mode tabs (Trainer /
 * Editor / Challenges / Troubleshoot) are now the shell's four stages.
 * `stage` (0-3) replaces the old `mode` string throughout. This file no
 * longer owns navigation, dialogs, presentation-mode toggling or Reset —
 * those are the shell's (see ../tools/lesson-shell/ADOPTING.md). It reacts
 * to the shell's two events: `stagechange` (onStageChange, below) and
 * `lessonreset` (resetActivity, below — REQUIRED, not optional: the shell
 * restores only what it owns and cannot know what this engine holds).
 * ============================================================ */
window.LL = window.LL || {};
LL.App = (function () {
  'use strict';

  /* ---------- tiny event bus ---------- */
  function makeBus() {
    var map = {};
    return {
      on: function (evt, cb) { (map[evt] = map[evt] || []).push(cb); },
      emit: function (evt, data) {
        var list = map[evt] || [];
        for (var i = 0; i < list.length; i++) {
          try { list[i](data); } catch (e) { if (window.console) console.error('bus handler for ' + evt, e); }
        }
      }
    };
  }

  var bus = makeBus();
  var plc = null;                 // current PLC instance
  var currentProgramId = null;    // id of the loaded program (pristine or fault-patched)
  var faultSourceId = null;       // program id a fault was injected into (for restore)
  var stage = 0;                  // 0 Trainer | 1 Editor | 2 Challenges | 3 Troubleshoot
  var running = true;
  var speed = 1;
  var accMs = 0;
  var lastWall = null;
  var hideLadderPref = false;
  var watchTouched = false;       // true once the user works the collapse button

  var ctx = {
    getPlc: function () { return plc; },
    bus: bus,
    bigUI: false,
    onSelectElement: function (info) {
      var el = document.getElementById('sel-status');
      if (!el || !info) return;
      var bits = [info.type || '?', info.tag || ''];
      if (typeof info.rung === 'number') bits.push('(rung ' + (info.rung + 1) + ')');
      el.textContent = 'Selected: ' + bits.join(' ');
    }
  };

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(msg, ms) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2600);
  }

  /* ---------- A4 observation cue ---------- */
  function cue(text) {
    var el = document.getElementById('cue-engine');
    if (el) el.textContent = text;
  }

  /* ---------- program loading ---------- */
  function loadProgram(progJson, opts) {
    opts = opts || {};
    plc = new LL.Engine.PLC(progJson, { scanMs: getScanMs() });
    currentProgramId = progJson.id || 'student';
    if (!opts.keepFault) {
      faultSourceId = null;
      hideRestore();
    }
    bus.emit('program:loaded', { program: plc.program, plc: plc });
    LL.Ladder.render();
    syncVariantToggle(progJson);
    updateRunUI();
  }

  function loadById(id) {
    var p = LL.Programs.byId(id);
    if (p) { loadProgram(p); }
  }

  /* ---------- selector + A/B variant toggle ---------- */
  function populateSelector() {
    var sel = document.getElementById('program-select');
    sel.innerHTML = '';
    var list = LL.Programs.list;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p.variant === 'B') continue;   // B reachable via the A/B toggle
      var o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name;
      sel.appendChild(o);
    }
    var so = document.createElement('option');
    so.value = '__student__';
    so.textContent = '✎ Student program (from editor)';
    so.disabled = true;
    so.id = 'student-option';
    sel.appendChild(so);
  }

  function syncVariantToggle(prog) {
    var wrap = document.getElementById('variant-toggle');
    var sel = document.getElementById('program-select');
    var stud = document.getElementById('student-option');
    if (prog.variant) {
      wrap.classList.add('show');
      var bA = document.getElementById('btn-var-a'), bB = document.getElementById('btn-var-b');
      bA.classList.toggle('active', prog.variant === 'A');
      bB.classList.toggle('active', prog.variant === 'B');
      sel.value = prog.variant === 'A' ? prog.id : prog.variantOf;
    } else {
      wrap.classList.remove('show');
      if (LL.Programs.byId(prog.id)) { sel.value = prog.id; stud.disabled = true; }
      else { stud.disabled = false; sel.value = '__student__'; }
    }
  }

  /* ---------- run controls ---------- */
  function getScanMs() {
    var sel = document.getElementById('scan-select');
    return sel ? parseInt(sel.value, 10) : 20;
  }
  function updateRunUI() {
    var led = document.getElementById('run-led');
    var btn = document.getElementById('btn-run');
    led.className = running ? 'on' : 'paused';
    led.id = 'run-led';
    btn.textContent = running ? '⏸ Pause' : '▶ Run';
    btn.classList.toggle('toggled', running);
  }
  function setRunning(v) {
    running = v;
    if (v) { accMs = 0; lastWall = null; }
    updateRunUI();
  }
  function tick() {
    LL.Sim.prePlcTick(plc);
    plc.scan();
    LL.Sim.postPlcTick(plc, plc.scanMs);
  }
  function stepOnce() {
    if (running) setRunning(false);
    tick();
    refreshReadout();
    toast('Stepped 1 scan → scan #' + plc.scanCount, 1200);
    cue('Scan #' + plc.scanCount + ' complete — outputs were written from that scan’s image table.');
  }
  function refreshReadout() {
    var el = document.getElementById('scan-readout');
    if (el && plc) {
      el.textContent = 'scan ' + String(plc.scanCount).padStart(6, '0') +
        ' · t=' + (plc.simTimeMs / 1000).toFixed(2) + ' s' +
        (running ? '' : ' · STEP MODE');
    }
  }

  /* ---------- main loop ---------- */
  function frame(now) {
    if (running && plc) {
      if (lastWall === null) lastWall = now;
      accMs += (now - lastWall) * speed;
      lastWall = now;
      var scanMs = plc.scanMs;
      var n = Math.floor(accMs / scanMs);
      if (n > 0) {
        if (n > 200) { n = 200; accMs = 0; } else { accMs -= n * scanMs; }
        for (var i = 0; i < n; i++) tick();
      }
    } else {
      lastWall = now;
    }
    /* renderers run per frame regardless (popovers, paused inspection) */
    if (plc) {
      if (stage === 0 || stage === 3) LL.Ladder.update();
      LL.Watch.update();
      LL.Sim.update();
      refreshReadout();
    }
    requestAnimationFrame(frame);
  }

  /* ---------- stages ----------
     Reacts to the shell's `stagechange` (window.lessonShell.selectStage /
     the stage tabs / a #stage-N hash all funnel through it). This function
     only shows and hides existing containers and toggles which engine-strip
     controls are visible — it renders NOTHING from program state, which
     matters because the shell's in-place Reset fires `stagechange` (back to
     stage 0) BEFORE `lessonreset` (see ADOPTING.md §4 step 7's ordering
     hazard). A handler that re-rendered activity state here would resurrect
     pre-reset content into freshly reset chrome, exactly as missing-time's
     lane found; this one only flips `hidden`/`display`, which is idempotent
     and safe to run before the state itself is reset. */
  function onStageChange(i) {
    stage = i;
    /* Challenges (2) needs the room the watch drawer takes; every other
       stage gets it back unless the user explicitly touched the collapse
       button, exactly as before the retrofit. */
    if (!watchTouched) setWatchCollapsed(stage === 2);
    show('ladder-host', stage === 0 || stage === 3);
    show('editor-host', stage === 1 || stage === 2);
    show('challenge-host', stage === 2);
    show('fault-host', stage === 3);
    /* A3 control budget (plan §D.8): the shared engine-run controls are only
       primary controls where a learner is directly operating the PLC's
       timing (Trainer, Troubleshoot). Nothing is deleted — Run/Pause/Step/
       Reset/Timing are one stage-tab away in every case, and the live
       intersection + watch window keep running underneath regardless of
       which stage is selected. */
    show('engine-strip', stage === 0 || stage === 3);
    applyHideLadder();
    if (stage === 3) toast('Troubleshoot: inject a fault, watch the intersection, diagnose from the ladder.', 3200);
  }
  function show(id, v) {
    var el = document.getElementById(id);
    if (el) el.hidden = !v;
  }
  /* ---- watch drawer ---------- */
  function setWatchCollapsed(v) {
    var bp = document.getElementById('bottom-pane');
    var btn = document.getElementById('btn-watch-collapse');
    if (!bp || !btn) return;
    bp.classList.toggle('collapsed', v);
    btn.textContent = v ? '▴ Show tags' : '▾ Hide';
  }

  /* Predict-then-reveal (promoted from a buried Settings toggle into the
     Troubleshoot stage's Predict card — plan §B). Scoped to stage 3: hiding
     the ladder only makes pedagogical sense while diagnosing a fault. */
  function applyHideLadder() {
    var active = hideLadderPref && stage === 3;
    document.body.classList.toggle('hide-ladder', active);
  }

  /* ---------- restore-pristine chip ---------- */
  function showRestore() {
    var b = document.getElementById('btn-restore');
    if (b) b.classList.add('show');
  }
  function hideRestore() {
    var b = document.getElementById('btn-restore');
    if (b) b.classList.remove('show');
  }

  /* ---------- self-test dialog ---------- */
  function runSelfTest() {
    var res = LL.Engine.runSelfTests();
    var host = document.getElementById('selftest-body');
    host.innerHTML = '';
    var sum = document.createElement('div');
    sum.className = 'st-sum';
    sum.textContent = res.passed + ' passed, ' + res.failed + ' failed ' + (res.failed === 0 ? '— engine OK ✓' : '— PROBLEM');
    host.appendChild(sum);
    for (var i = 0; i < res.results.length; i++) {
      var r = res.results[i];
      var row = document.createElement('div');
      row.className = 'st-row ' + (r.pass ? 'pass' : 'fail');
      row.textContent = (r.pass ? '✓ ' : '✗ ') + r.name + (r.pass || !r.detail ? '' : ' — ' + r.detail);
      host.appendChild(row);
    }
    document.getElementById('selftest-dialog').showModal();
  }

  /* ---------- boot ---------- */
  function init() {
    populateSelector();

    /* module inits */
    LL.Ladder.init(document.getElementById('ladder-host'), ctx);
    LL.Watch.init(document.getElementById('watch-host'), ctx);
    LL.Sim.init(document.getElementById('sim-host'), ctx);
    LL.Editor.init(document.getElementById('editor-host'), ctx);
    LL.Challenges.initPanel(document.getElementById('challenge-host'), ctx);
    LL.Faults.initPanel(document.getElementById('fault-host'), ctx);
    /* faults.js attaches ctx.faultsReset during initPanel — the shared ctx
       object is the existing inter-module channel (getPlc/bus/bigUI already
       travel this way), used here rather than a new LL.Faults export. */

    /* bus wiring */
    bus.on('editor:run', function (d) {
      if (!d || !d.program) return;
      loadProgram(d.program);
      setRunning(true);
      toast('Your program is now running the intersection.', 2400);
      cue('Program sent to the live intersection — scan #' + plc.scanCount + ' is now running it.');
    });
    bus.on('challenge:starter', function (d) {
      if (d && d.program && LL.Editor.loadChallengeStarter) {
        LL.Editor.loadChallengeStarter(d.program);
        toast('Starter program loaded into the editor.', 2000);
      }
    });
    bus.on('fault:injected', function (d) {
      if (!d || !d.program) return;
      loadProgram(d.program, { keepFault: true });
      faultSourceId = d.programId || null;
      setRunning(true);
      hideRestore();
      cue('Fault injected — watch the intersection, then diagnose before revealing.');
    });
    bus.on('fault:revealed', function (d) {
      if (faultSourceId) showRestore();
      var title = (d && d.faultId && LL.Faults.byId(d.faultId) && LL.Faults.byId(d.faultId).title) || 'the fault';
      cue('Revealed: ' + title + '.');
    });

    /* engine strip */
    document.getElementById('program-select').addEventListener('change', function () {
      if (this.value !== '__student__') loadById(this.value);
      else if (plc && plc.program) {
        /* The Student option is a status label, not a second program to
           load.  Do not leave the selector claiming Student while a built-in
           remains live. */
        syncVariantToggle(plc.program);
      }
    });
    document.getElementById('btn-var-a').addEventListener('click', function () {
      var p = plc && plc.program;
      if (p && p.variant === 'B') loadById(p.variantOf);
    });
    document.getElementById('btn-var-b').addEventListener('click', function () {
      var p = plc && plc.program;
      if (p && p.variant === 'A') loadById(p.variantOf);
    });
    document.getElementById('btn-run').addEventListener('click', function () { setRunning(!running); });
    document.getElementById('btn-step').addEventListener('click', stepOnce);
    document.getElementById('btn-reset').addEventListener('click', function () {
      plc.reset();
      LL.Sim.reset(12345);
      accMs = 0;
      toast('PLC + intersection reset. Program unchanged.', 2000);
    });
    document.getElementById('speed-select').addEventListener('change', function () {
      speed = parseFloat(this.value);
    });
    document.getElementById('scan-select').addEventListener('change', function () {
      if (plc) plc.scanMs = parseInt(this.value, 10);
      toast('Scan time: ' + this.value + ' ms per scan.', 1600);
    });
    document.getElementById('btn-restore').addEventListener('click', function () {
      if (faultSourceId) loadById(faultSourceId);
      toast('Working (pristine) program restored.', 2000);
    });

    /* Troubleshoot's Predict card: predict-then-reveal, promoted out of
       Settings (plan §B). */
    document.getElementById('chk-hideladder').addEventListener('change', function () {
      hideLadderPref = this.checked;
      applyHideLadder();
      if (this.checked) toast('Ladder hidden — predict the fault from the intersection, then reveal!', 3000);
    });

    /* React to the shell's own presentation-mode toggle (Settings, or the
       header Notes button) rather than owning a checkbox — ADOPTING.md §2:
       "your presentation/projector toggle... listen for presentationchange
       instead." ctx.bigUI / the 'bigui:changed' bus event / body.bigui are
       this demo's OWN larger-scale mode for pixel-sized sim/editor/challenge
       controls (~1.35x) that --u's em-based scaling does not reach — kept
       exactly as before, just re-triggered by the shell's event instead of a
       Settings checkbox this demo no longer owns. */
    function applyBigUI(on) {
      ctx.bigUI = on;
      document.body.classList.toggle('bigui', on);
      bus.emit('bigui:changed', { bigUI: on });
    }
    document.addEventListener('presentationchange', function (e) { applyBigUI(!!(e.detail && e.detail.on)); });

    document.getElementById('btn-selftest').addEventListener('click', runSelfTest);

    /* stage + reset, dispatched by the shell */
    document.addEventListener('stagechange', function (e) { onStageChange(e.detail.index); });
    document.addEventListener('lessonreset', resetActivity);

    /* watch collapse */
    document.getElementById('btn-watch-collapse').addEventListener('click', function () {
      watchTouched = true;
      setWatchCollapsed(!document.getElementById('bottom-pane').classList.contains('collapsed'));
    });

    /* keyboard: Space = run/pause, "." = step (ignored while typing) */
    document.addEventListener('keydown', function (e) {
      var t = e.target;
      var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.tagName === 'BUTTON' || t.isContentEditable);
      if (typing) return;
      if (e.code === 'Space') { e.preventDefault(); setRunning(!running); }
      else if (e.key === '.') { e.preventDefault(); stepOnce(); }
    });

    /* short screens (Chromebooks/projectors): start with the watch drawer
       collapsed so the ladder and intersection get the room. */
    if (window.innerHeight < 780) { watchTouched = true; setWatchCollapsed(true); }

    /* first load */
    loadProgram(LL.Programs.byId('stoplight_basic'));
    onStageChange(0);
    setRunning(true);
    requestAnimationFrame(frame);

    if (/[?&]selftest=1/.test(location.search)) runSelfTest();
  }

  /* ============================ reset, in place =============================
     Kit v2. By the time this fires, the shell has already put back everything
     it owns — stage 1 selected (which already ran onStageChange(0) above,
     applying the container show/hide, and closed the self-test <dialog> along
     with its own four). This is the half only this file can know about.

     THE ENUMERATION, written out because in place is only correct if the
     list is complete (ADOPTING.md §4):

       plc / currentProgramId / faultSourceId — replaced wholesale by
              loadProgram() on the boot program, which also re-renders the
              ladder and re-syncs the program selector + A/B toggle.
       running / accMs / lastWall — set by setRunning(true).
       speed, #speed-select — both back to 1×.
       plc.scanMs (via getScanMs()), #scan-select — both back to 20 ms;
              the select's value is reset BEFORE loadProgram() reads it, so
              the fresh plc is constructed with the right scanMs directly
              rather than constructed wrong and patched after.
       #student-option.disabled — put back to true. syncVariantToggle() only
              flips it false when a non-built-in program loads; nothing ever
              flipped it back, which is a pre-existing quirk this reset now
              has to correct explicitly (a page reload used to hide it).
       hideLadderPref, #chk-hideladder, body.hide-ladder — all cleared.
       watchTouched, the watch drawer — un-touched and expanded, the
              first-load default (stage 0 is not stage 2, so
              setWatchCollapsed(false) matches what onStageChange(0) would
              already compute; set explicitly so a user who had pinned it
              open on Challenges does not carry that choice past a reset).
       #sel-status — the ladder-inspector readout, cleared.
       #selftest-body — cleared (the dialog itself the shell already closed).
       #cue-engine — the A4 observation cue, cleared (:empty hides it).
       Editor — LL.Editor.setProgram(null): a fresh empty program, undo stack,
              selection and armed tool all cleared (see editor.js).
       Challenges — LL.Challenges.reset(): challenge 1 active, no hints
              shown, no status or check result recorded (added for this kit
              adoption — see challenges.js).
       Faults — ctx.faultsReset(): fault abandoned, best-times list cleared,
              the specific-fault <details> closed (added for this kit
              adoption — see faults.js).
       LL.Watch / LL.Ladder's popover — NOT touched directly. Both modules
              already detect "the plc object changed" and rebuild their own
              internal state from it (watch.js's `lastPlc` comparison; the
              ladder inspector re-renders from the new plc on the next
              frame) — this was true before the retrofit too (Reset always
              swapped in a fresh plc), so nothing here needs to reproduce it.
     ========================================================================= */
  function resetActivity() {
    document.getElementById('speed-select').value = '1';
    document.getElementById('scan-select').value = '20';
    loadProgram(LL.Programs.byId('stoplight_basic'));
    document.getElementById('student-option').disabled = true;
    LL.Sim.reset(12345);
    speed = 1;
    setRunning(true);

    hideLadderPref = false;
    document.getElementById('chk-hideladder').checked = false;
    applyHideLadder();

    watchTouched = false;
    setWatchCollapsed(false);

    var sel = document.getElementById('sel-status'); if (sel) sel.textContent = '';
    var stb = document.getElementById('selftest-body'); if (stb) stb.innerHTML = '';
    cue('');

    if (LL.Editor && LL.Editor.setProgram) LL.Editor.setProgram(null);
    if (LL.Challenges && LL.Challenges.reset) LL.Challenges.reset();
    if (ctx.faultsReset) ctx.faultsReset();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    get plc() { return plc; },
    bus: bus,
    loadById: loadById,
    stepOnce: stepOnce,
    setRunning: setRunning
  };
})();
