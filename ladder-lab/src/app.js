/* ============================================================
 * Ladder Lab — app shell (LL.App)
 * Owns: the PLC instance, the deterministic main loop, mode switching,
 * program selector, run controls, teacher features, and all bus wiring.
 *
 * Determinism: scans advance simulated time by plc.scanMs per scan.
 * Wall clock (performance.now) is used ONLY to pace how many scans run
 * per animation frame — never inside logic. Order per tick (per SPEC):
 *   LL.Sim.prePlcTick(plc) -> plc.scan() -> LL.Sim.postPlcTick(plc, scanMs)
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
  var mode = 'trainer';           // trainer | editor | challenges | troubleshoot
  var running = true;
  var speed = 1;
  var accMs = 0;
  var lastWall = null;
  var hideLadderPref = false;

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
      if (LL.Programs.byId(prog.id)) { sel.value = prog.id; }
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
      if (mode === 'trainer' || mode === 'troubleshoot') LL.Ladder.update();
      LL.Watch.update();
      LL.Sim.update();
      refreshReadout();
    }
    requestAnimationFrame(frame);
  }

  /* ---------- modes ---------- */
  function setMode(m) {
    mode = m;
    document.body.setAttribute('data-mode', m);
    var tabs = document.querySelectorAll('#mode-tabs button');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i].getAttribute('data-mode') === m);
    /* Challenges needs the room for the editor — tuck the watch drawer away,
       unless the user has explicitly set it themselves. */
    if (!watchTouched) setWatchCollapsed(m === 'challenges');
    show('ladder-host', m === 'trainer' || m === 'troubleshoot');
    show('editor-host', m === 'editor' || m === 'challenges');
    show('challenge-host', m === 'challenges');
    show('fault-host', m === 'troubleshoot');
    applyHideLadder();
    bus.emit('mode:changed', { mode: m });
    if (m === 'troubleshoot') toast('Troubleshoot: inject a fault, watch the intersection, diagnose from the ladder.', 3200);
  }
  function show(id, v) {
    var el = document.getElementById(id);
    if (el) el.hidden = !v;
  }
  /* ---- watch drawer ---------- */
  var watchTouched = false;   // true once the user works the collapse button
  function setWatchCollapsed(v) {
    var bp = document.getElementById('bottom-pane');
    var btn = document.getElementById('btn-watch-collapse');
    if (!bp || !btn) return;
    bp.classList.toggle('collapsed', v);
    btn.textContent = v ? '▴ Show tags' : '▾ Hide';
  }

  function applyHideLadder() {
    var active = hideLadderPref && (mode === 'trainer' || mode === 'troubleshoot');
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

  /* ---------- self-test overlay ---------- */
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
    document.getElementById('selftest-overlay').hidden = false;
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

    /* bus wiring */
    bus.on('editor:run', function (d) {
      if (!d || !d.program) return;
      loadProgram(d.program);
      setRunning(true);
      toast('Your program is now running the intersection.', 2400);
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
    });
    bus.on('fault:revealed', function () {
      if (faultSourceId) showRestore();
    });

    /* topbar controls */
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
    var tabs = document.querySelectorAll('#mode-tabs button');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () { setMode(this.getAttribute('data-mode')); });
    }
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

    /* settings menu
       Presentation mode = the projector big-UI scale PLUS the presenter's-notes
       affordance in the top bar. The notes sheet itself stays openable from the
       menu at any time; body.presentation only surfaces the one-tap button. */
    document.getElementById('chk-bigui').addEventListener('change', function () {
      ctx.bigUI = this.checked;
      document.body.classList.toggle('bigui', this.checked);
      document.body.classList.toggle('presentation', this.checked);
      bus.emit('bigui:changed', { bigUI: this.checked });
      if (this.checked) toast('Presentation mode on — presenter’s notes are in the top bar.', 3000);
    });
    document.getElementById('chk-hideladder').addEventListener('change', function () {
      hideLadderPref = this.checked;
      applyHideLadder();
      if (this.checked) toast('Ladder hidden — have the class predict the logic from the intersection!', 3000);
    });
    document.getElementById('btn-resetall').addEventListener('click', function () {
      if (confirm('Reset EVERYTHING? This restores the app to its just-opened state.\nUnsaved student programs in the editor will be lost.')) {
        location.reload();
      }
    });
    document.getElementById('btn-selftest').addEventListener('click', function () {
      document.getElementById('teacher-menu').removeAttribute('open');
      runSelfTest();
    });
    document.getElementById('btn-selftest-close').addEventListener('click', function () {
      document.getElementById('selftest-overlay').hidden = true;
    });

    /* close teacher menu when clicking elsewhere */
    document.addEventListener('pointerdown', function (e) {
      var men = document.getElementById('teacher-menu');
      if (men.hasAttribute('open') && !men.contains(e.target)) men.removeAttribute('open');
    });

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
    setMode('trainer');
    setRunning(true);
    requestAnimationFrame(frame);

    if (/[?&]selftest=1/.test(location.search)) runSelfTest();
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
    setMode: setMode,
    stepOnce: stepOnce,
    setRunning: setRunning
  };
})();
