/* bridge-works — the LESSON layer.

   game.js is the activity and does not know this file exists: it exposes
   window.bridgeWorks and calls a handful of hooks, and that is the whole
   coupling. Everything here is the half the lesson shell cannot know about
   and the game should not have to care about.

   WHAT THIS FILE OWNS
     * the map from four lesson stages to six levels, in both directions;
     * relocating the ONE activity between the four .activity-host divs;
     * the A2 capture — "what goes first?" — committed before EVERY load test,
       the gate that withholds the test until it is, and the echo of the call
       against the engine's record afterwards;
     * the A4 observation cues, edge-triggered off the build analysis and
       written from the test record;
     * the A6 feedback prefix, overridden demo-side (THE KIT STRING below);
     * the lesson half of the in-place Reset.

   WHAT IT DELIBERATELY DOES NOT DO
     * show or hide a stage panel. selectStage() is the only thing that may
       move a stage (ADOPTING.md section 1).
     * render activity state from `stagechange`. That event fires during a
       Reset BEFORE `lessonreset`, so a handler that paints from activity state
       paints the PRE-reset state into freshly reset chrome. `stagechange` is a
       chrome event here, and a `resetting` flag (synthesised below, because
       the kit does not yet expose window.lessonShell.resetting) makes that
       explicit rather than true by luck of ordering.

   THE KIT STRING. lesson-shell v2's shared A6 handler hardcodes ion-flight's
   wording — a wrong option is prefixed "Not what the detector showed." There
   is no detector in a bridge simulator. The kit is FROZEN, so the fix belongs
   on a kit branch and not in this lane; this file re-renders the feedback line
   after the shell's handler has run, which works because the shell's script is
   injected before this one and listeners fire in registration order. Fourth
   demo to pay for this independently; recorded in the lane's friction list. */
(() => {
  'use strict';

  const G = window.bridgeWorks;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const activity = document.getElementById('activity');
  const hosts = $$('.activity-host');
  const tabs = $$('.stage-tab');
  const testcall = document.getElementById('testcall');
  const callButtons = $$('.call-option');

  /* ---- the stage <-> level map ------------------------------------------
     Stages are the lesson's beats; levels are the puzzles inside a beat. Both
     directions are needed: picking a level from the game's own level list has
     to move the tabs, and picking a tab has to load a level. */
  const STAGE_LEVELS = [[0, 1], [2], [3, 4], [5]];
  const LEVEL_STAGE = [0, 0, 1, 2, 2, 3];
  const stageOf = levelIndex => LEVEL_STAGE[levelIndex] || 0;

  /* Entering a stage loads its first level, unless a level from that stage is
     already loaded — a presenter who has moved on to Level 5 and stepped away
     to read Details should come back to Level 5, not to Level 4. */
  function levelToEnter(stage) {
    const here = G.levelIndex();
    if (STAGE_LEVELS[stage].indexOf(here) !== -1) return null;
    return STAGE_LEVELS[stage][0];
  }

  /* ---- lesson state ----------------------------------------------------- */
  let call = null;            // the committed call for the NEXT load test
  /* REPLAYABILITY (operator directive 2026-09-16: a learning goal AND a game
     you can keep playing). The evidence gate protects the FIRST load test in a
     stage, not the tenth: once a stage has had a called-and-run test, its Load
     test button no longer waits for a call, though a call is still offered and
     still echoed if made. Persisted in the demo's own storage so a page reload
     mid-lesson does not re-gate; cleared by Reset. The kit has no primitive for
     "this stage has been done once" — every demo invents its own; noted in the
     friction list. */
  const LESSON_K = 'bw.lesson.v1';
  let tested = loadTested();
  let syncing = false;        // re-entry guard, both directions
  let resetting = false;      // the flag the kit does not expose
  /* The build-phase cue's edge detector. 'init' on purpose: Level 2 opens with
     a rectangular frame that IS a mechanism, so a detector starting at 'ok'
     would fire the mechanism cue on load, before the learner has acted. The
     first observation after a level load is recorded silently. */
  let mechState = 'init';

  const selectedTab = () => Math.max(0, tabs.findIndex(t => t.getAttribute('aria-selected') === 'true'));

  function loadTested() {
    try { const v = JSON.parse(localStorage.getItem(LESSON_K) || '{}'); return Array.isArray(v.tested) ? v.tested.slice(0, 4).map(Boolean) : [false, false, false, false]; }
    catch (e) { return [false, false, false, false]; }
  }
  function saveTested() { try { localStorage.setItem(LESSON_K, JSON.stringify({ tested })); } catch (e) { /* storage may be blocked; the gate then re-arms on reload, which is safe */ } }
  const freePlay = stage => Boolean(tested[stage]);

  const CALL_TEXT = {
    mechanism: 'it folds as a mechanism',
    buckling: 'a compression member buckles',
    tension: 'a member tears in tension',
    held: 'it holds'
  };

  /* ---- A3: where the one activity lives ------------------------------- */
  function place(stage) {
    const host = hosts[stage] || hosts[0];
    if (host && activity.parentNode !== host) host.appendChild(activity);
    G.remeasure();
  }

  /* ---- A2: the call, captured before every test ------------------------
     The gate is the hook: game.js's refresh() disables the Load test button
     (and the Space shortcut respects the button) while canTest() is false. */
  G.hooks.canTest = () => Boolean(call) || freePlay(selectedTab());

  const callLabel = document.getElementById('testcall-label');
  const CALL_LABEL_GATED = 'Before you test &mdash; what goes first? <span class="why">Commit a call to unlock <b>Load test</b>. Being wrong costs nothing; committing first is what turns the crossing into a measurement.</span>';
  const CALL_LABEL_FREE = 'Call it &mdash; what goes first? <span class="why">You have tested this stage once, so <b>Load test</b> is open: replay for a lower cost, compare designs, chase par. A call is still echoed against the record if you make one.</span>';
  function showCall() {
    callButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.call === call)));
    if (testcall) {
      testcall.classList.toggle('committed', Boolean(call));
      testcall.classList.toggle('free', freePlay(selectedTab()));
    }
    if (callLabel) callLabel.innerHTML = freePlay(selectedTab()) ? CALL_LABEL_FREE : CALL_LABEL_GATED;
  }
  callButtons.forEach(btn => btn.addEventListener('click', () => {
    call = btn.dataset.call;
    showCall();
    G.refresh();                                  // re-evaluates the gate
  }));

  function echoFor(stage) {
    return $('#stage-' + (stage + 1) + ' .lesson-strip .echo');
  }
  function cue(stage, html, warm) {
    const el = document.getElementById('cue-' + (stage + 1));
    if (!el) return;
    el.className = 'obs-cue' + (warm ? ' cue-warm' : '');
    el.innerHTML = html;
  }

  /* The call echoed AGAINST THE RECORD. `d.weakest` is written by finishTest()
     from T.first / T.maxU — the engine's own account of what went first and at
     what force — never from the live analysis, which by now has re-solved,
     collapsed or been cleared. Written beside the prediction, in the stage's
     Predict card and in the debrief, so the side-by-side is what the learner
     sees. */
  function echoCall(d) {
    const stage = stageOf(d.levelIndex);
    const actual = d.weakest ? d.weakest.mode : (d.survived ? 'held' : 'mechanism');
    if (!call) return { stage, right: null, actual };     // free play, no call made
    const right = call === actual;
    const line = 'You called <b>' + (CALL_TEXT[call] || 'nothing') + '</b> &mdash; ' +
      (right ? 'and the record agrees. ' : 'the record says otherwise. ') + G.weakestSentence(d.weakest);
    const echo = echoFor(stage);
    if (echo) {
      echo.hidden = false;
      echo.className = 'echo ' + (right ? 'echo-right' : 'echo-wrong');
      echo.innerHTML = line + ' <i>(Level ' + G.LEVELS[d.levelIndex].n + ')</i>';
    }
    const body = document.getElementById('dbBody');
    if (body) {
      const div = document.createElement('div');
      div.className = 'call-echo ' + (right ? 'right' : 'wrong');
      div.innerHTML = '<b>Your call.</b> ' + line;
      const verdictSub = body.querySelector('.verdict + .sub');
      if (verdictSub && verdictSub.nextSibling) body.insertBefore(div, verdictSub.nextSibling);
      else body.insertBefore(div, body.firstChild);
    }
    return { stage, right, actual };
  }

  /* ---- A4: the observation cues ----------------------------------------
     Two edges fire one. (1) In the build phase, the design becoming a
     mechanism or ceasing to be one — read off the analysis the game already
     ran for X-ray, and edge-triggered so a cue is not rewritten on every edit.
     (2) A load test finishing — the weakest link from the record. */
  G.hooks.onRefresh = S => {
    if (resetting || S.phase !== 'build') return;
    const a = S.analysis;
    const now = (a && a.mechanism && S.members.length && (a.mode || (a.modes && a.modes.length))) ? 'mech' : 'ok';
    if (mechState === 'init') { mechState = now; return; }
    if (now === mechState) return;
    mechState = now;
    const stage = selectedTab();
    if (now === 'mech') {
      const nz = a.nullity || 1;
      cue(stage, 'The solver’s stiffness matrix just went <b>singular</b>: it found ' +
        (nz === 1 ? 'one way' : nz + ' independent ways') + ' this frame can move without stretching a single member. ' +
        'That motion is the dashed ghost rocking on the canvas &mdash; a <b>mechanism</b>, and no amount of steel strength fixes it. Each well-placed diagonal removes exactly one.');
    } else {
      cue(stage, '<b>Rigid.</b> Every fold is gone &mdash; the stiffness matrix has full rank again, so the frame now resists the load by <i>straining</i> members, and X-ray shows which ones. ' +
        'Read the colours: red is pulled, blue is squashed, brighter is nearer its limit.');
    }
  };

  G.hooks.onTestStart = () => {
    /* nothing to render; the record is written at the end */
  };

  G.hooks.onTestEnd = d => {
    if (resetting) return;
    const r = echoCall(d);
    if (!tested[r.stage]) { tested[r.stage] = true; saveTested(); }
    const w = d.weakest;
    let html = G.weakestSentence(w);
    if (w && w.mode === 'buckling') {
      html += ' Compare the two ratings in that sentence: same steel, same length, and the pushed limit is a fraction of the pulled one. That gap is P<sub>cr</sub> = &pi;&sup2;EI/L&sup2; doing its work.';
    } else if (w && w.mode === 'mechanism') {
      html += ' Find the four-sided panel in the debrief’s <b>How it moved</b> table and put a diagonal across it.';
    } else if (w && w.mode === 'tension') {
      html += ' Tension is the strong direction, so this member was simply carrying too much alone &mdash; deepen the truss or split the load.';
    } else if (w && w.mode === 'held') {
      html += ' A member at under 5% of its limit is steel you paid for and did not use; the debrief flags them.';
    }
    cue(r.stage, html, true);
    /* The next test needs a fresh call. */
    call = null;
    showCall();
    G.refresh();
  };

  /* ---- A6: the feedback prefix, overridden demo-side -------------------
     See THE KIT STRING at the top of this file. The shell has already written
     its own prefix by the time this runs; this replaces the line wholesale. */
  $$('.check').forEach(card => {
    const out = card.querySelector('.check-feedback');
    $$('.check-option').filter(b => card.contains(b)).forEach(btn => {
      btn.addEventListener('click', () => {
        if (!out) return;
        out.innerHTML = (btn.classList.contains('correct')
          ? '<b>Supported.</b> '
          : '<b>Not what the solver showed.</b> ') + (btn.dataset.feedback || '');
      });
    });
  });

  /* ---- the two directions of stage/level sync -------------------------- */
  function enterLevel(i) {
    if (syncing) return;
    syncing = true;
    try { G.loadLevel(i); } finally { syncing = false; }
  }

  /* game.js -> here: a level was loaded (tab click, the Levels dialog, "Next
     level", or Reset). The call and the build-cue detector belong to the level
     that was just left; the tabs follow the level when the learner chose it
     from inside the activity. */
  G.hooks.onLevelLoad = i => {
    call = null;
    showCall();
    mechState = 'init';
    if (resetting || syncing) return;
    const want = stageOf(i);
    if (want === selectedTab()) return;
    syncing = true;
    try { window.lessonShell.selectStage(want); } finally { syncing = false; }
    place(want);
  };

  /* ---- stagechange: CHROME ONLY ----------------------------------------
     No activity state is rendered from here. During a Reset the shell calls
     selectStage(0) at step 7 and dispatches `lessonreset` at step 9, so this
     runs while `call` and the game's state are still pre-reset; `resetting`
     makes it stand down rather than relying on the later handler to undo it. */
  document.addEventListener('stagechange', e => {
    const stage = e.detail.index;
    if (resetting) return;
    place(stage);
    showCall();                                    // the gate label is per stage
    if (syncing) return;
    const want = levelToEnter(stage);
    if (want !== null) enterLevel(want);
  });

  /* Presentation mode changes --u and --fs, which changes the canvas box.
     game.js re-measures on the same event; this re-places for the host's own
     width change. */
  document.addEventListener('presentationchange', () => G.remeasure());

  /* ---- Reset: the lesson half ------------------------------------------
     The shell has already closed every dialog, restored the tabs from its
     snapshot, cleared every check card, put the .echo spans and .obs-cue lines
     back to their first-load content, reset the Details drawer to stage 1 and
     selected stage 1. game.js restores the activity. What is left here:

       1. call            -> null, and the four call buttons' aria-pressed and
                             the group's .committed class with it.
       2. mechState       -> 'init', or the first refresh after Reset fires a
                             cue against a design that no longer exists.
       3. the echo spans' className -> the shell restores innerHTML and hidden
                             from its snapshot but NOT the class, and echoCall()
                             sets .echo-right/.echo-wrong.
       4. the activity's host -> back to host 0. It is ONE element that moves;
                             left in stage 3's host, stage 1 would show an
                             empty panel.
     The onReset veto is used as a flag, not a veto: it returns true so the
     reset proceeds, and sets `resetting` so the stagechange at step 7 and the
     refreshes inside resetActivity() stand down. */
  window.lessonShell.onReset = () => { resetting = true; return true; };

  document.addEventListener('lessonreset', () => {
    call = null;
    tested = [false, false, false, false];
    try { localStorage.removeItem(LESSON_K); } catch (e) { /* nothing to remove */ }
    showCall();
    mechState = 'init';
    $$('.lesson-strip .echo').forEach(e => { e.className = 'echo'; });
    G.resetActivity();
    place(0);
    mechState = 'init';                            // resetActivity refreshed once
    resetting = false;
  });

  /* ---- start-up --------------------------------------------------------
     The shell has already run. Two cases:
       * a #stage-N fragment chose a stage: honour it and load that stage's
         first level, unless the saved level already belongs to it;
       * no fragment: the game restored the learner's saved level, so move the
         tabs to ITS stage — a presenter who left on Level 3 comes back to
         Level 3, in stage 2. */
  const hashChose = Array.from(window.lessonShell.flags || []).some(f => /^stage-\d+$/.test(f));
  let opened = selectedTab();
  if (hashChose) {
    const want = levelToEnter(opened);
    if (want !== null) enterLevel(want);
  } else {
    const want = stageOf(G.levelIndex());
    if (want !== opened) {
      syncing = true;
      try { window.lessonShell.selectStage(want); } finally { syncing = false; }
      opened = want;
    }
  }
  place(opened);
  mechState = 'init';
  showCall();
  G.refresh();
})();
