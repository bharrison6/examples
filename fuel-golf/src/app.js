/* fuel-golf — the LESSON layer.

   game.js is the activity and it does not know this file exists: it exposes
   window.fuelGolf and calls hooks, and that is the whole coupling. Everything
   here is the half the lesson shell cannot know about and the game should not
   have to care about.

   WHAT THIS FILE OWNS
     * the map from four lesson stages to eight levels, in both directions;
     * relocating the ONE flight view between the four .activity-host divs;
     * the three captured A2 predictions, their echoes and the two gates;
     * the A4 observation cues, which are edge-triggered off the live state;
     * the activity half of the in-place Reset.

   WHAT IT DELIBERATELY DOES NOT DO
     * show or hide a stage panel. selectStage() is the only thing that may
       move a stage (ADOPTING.md section 1).
     * render activity state from `stagechange`. That event fires during a
       Reset, BEFORE `lessonreset`, so a handler that paints from activity
       state paints the PRE-reset state into freshly reset chrome — exactly
       what bit the missing-time lane. `stagechange` is treated here as a
       chrome event, and a `resetting` flag (synthesised below, because the kit
       does not yet expose window.lessonShell.resetting) makes that explicit
       rather than merely true by luck of ordering. */
(() => {
  'use strict';

  const G = window.fuelGolf;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const activity = document.getElementById('activity');
  const hosts = $$('.activity-host');
  const gate2 = document.getElementById('gate-2');
  const moonNote = document.getElementById('moon-note');
  const tabs = $$('.stage-tab');

  /* ---- the stage <-> level map ------------------------------------------
     Stages are the lesson's beats; levels are the missions inside a beat.
     Both directions are needed: picking a level from the game's own level list
     has to move the tabs, and picking a tab has to load a level. */
  const STAGE_LEVELS = [[0, 1], [2, 3, 4], [5, 6], [7]];
  const LEVEL_STAGE = [0, 0, 1, 1, 1, 2, 2, 3];
  const ESCAPE_ARTIST = 2;                      // level index of Level 3
  const stageOf = levelIndex => LEVEL_STAGE[levelIndex] || 0;

  /* Entering a stage loads its first level, unless a level from that stage is
     already loaded — a presenter who has flown to Level 5 and stepped away to
     read Details should come back to Level 5, not to Level 3. */
  function levelToEnter(stage) {
    const here = G.levelIndex();
    if (STAGE_LEVELS[stage].indexOf(here) !== -1) return null;
    return STAGE_LEVELS[stage][0];
  }

  /* ---- lesson state ----------------------------------------------------- */
  const PREDICT_STAGES = [0, 1, 2];             // the Sandbox captures nothing
  let picks = [null, null, null, null];
  let syncing = false;                          // re-entry guard, both directions
  let resetting = false;                        // the flag the kit does not expose
  /* The A4 cue's edge detector. 'init' rather than 'none' on purpose: every
     level spawns AT an apsis, so a detector that starts at 'none' sees an
     immediate transition and fires the apsis cue on load, before the learner
     has done anything. A4 wants the cue to name the thing to notice at the
     moment it BECOMES true, and "you are where you started" is not that. The
     first tick after a level load therefore records the zone silently, and the
     cue fires only on a genuine arrival after that. */
  let zone = 'init';
  let lastDv = 0;
  /* A finite burn's summary is owed once the game settles it. Keyed off the
     record rather than off "did dv grow since the last poll", because the final
     increment can round to 0 m/s and the summary would then never fire. */
  let finitePending = false;
  /* Stage 2's gate, opened by the learner's own act: picking a stage-2 level
     from the game's Levels list is itself the choice (R-fuel-golf F3). */
  let gate2Open = false;

  const selectedTab = () => Math.max(0, tabs.findIndex(t => t.getAttribute('aria-selected') === 'true'));

  /* ---- A1: the tabs the demo knows about -------------------------------
     The shell owns selection, keyboard and the hash. Two things only the demo
     knows are synced here: whether stage 3 has been earned, and which stages
     are done. Stage 3's `disabled` is authored in the template, so this only
     ever OPENS it — after a Reset the snapshot closes it again and the cleared
     badges keep it closed. */
  function syncTabs() {
    const prog = G.progress();
    const escaped = Boolean(prog[3] && prog[3].done);
    if (escaped && tabs[2]) {
      tabs[2].disabled = false;
      tabs[2].removeAttribute('title');
    }
    STAGE_LEVELS.forEach((levels, k) => {
      const tab = tabs[k];
      if (!tab || k === 3) return;              // the Sandbox is never marked complete
      const done = levels.every(i => prog[G.LEVELS[i].id] && prog[G.LEVELS[i].id].done);
      tab.classList.toggle('complete', done);
      const mark = tab.querySelector('.stage-mark');
      if (mark) mark.textContent = done ? '✓' : String(k + 1);
    });
  }

  /* ---- A3: where the one flight view lives -----------------------------
     Stage 2's gate is on the evidence, not the tab: until its prediction is
     committed the flight view does not move in, and the gate card stands in
     its place. While gated the view is parked back in host 0, which is inside
     a hidden panel — game.js's draw() guard covers exactly that, so the
     simulation keeps running and only the painting stops.

     The gate protects the FIRST encounter, not the tenth (operator directive:
     replayable, like a game). It consults the evidence it guards: a persisted
     Escape Artist badge proves the level was flown, so on a revisit stage 2 is
     free play. Reset clears the badges, so Reset re-arms it — that is correct.
     The storage read is last in the chain so the 250 ms poll pays it only
     while the gate is actually in question. */
  function escapedBefore() {
    const p = G.progress();
    return Boolean(p[3] && p[3].done);
  }
  function gated(stage) { return stage === 1 && !picks[1] && !gate2Open && !escapedBefore(); }

  function place(stage) {
    if (gate2) gate2.hidden = !gated(1);
    const host = gated(stage) ? hosts[0] : hosts[stage];
    if (host && activity.parentNode !== host) host.appendChild(activity);
    G.remeasure();
  }

  /* ---- A2: the captured predictions ------------------------------------ */
  function echoFor(stage) {
    const strip = $('#stage-' + (stage + 1) + ' .lesson-strip .echo');
    return strip || null;
  }

  function showPick(stage) {
    const group = document.getElementById('predict-' + (stage + 1));
    if (!group) return;
    $$('#predict-' + (stage + 1) + ' .predict-option').forEach(b => {
      const on = b.dataset.pick === picks[stage];
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('selected', on);
    });
    const echo = echoFor(stage);
    if (!echo) return;
    if (!picks[stage]) { echo.hidden = true; echo.innerHTML = ''; return; }
    echo.hidden = false;
    echo.innerHTML = 'You predicted: <b>' + picks[stage] + '</b>';
  }

  /* The observed result, written BESIDE the prediction rather than replacing
     it — that side-by-side is the whole point of capturing one. Every figure
     here is Measured against this same engine; none of it is written until the
     learner has actually flown the thing it reports. */
  const OBSERVED = {
    0: () => 'Observed: the <b>far side</b> moved. The burn at apoapsis lifted periapsis until the ellipse closed into a circle, and apoapsis stayed where it was.',
    1: () => 'Measured on this engine: <b>661 m/s</b> to escape from periapsis against <b>1,835 m/s</b> from apoapsis &mdash; a factor of 2.77.',
    2: () => 'Measured on this engine: <b>775 m/s</b> with the burn centred on periapsis against <b>919 m/s</b> lit at periapsis; the impulsive ideal is 661.'
  };

  function writeObserved(stage, flownMs) {
    const echo = echoFor(stage);
    if (!echo || !picks[stage] || !OBSERVED[stage]) return;
    const right = $$('#predict-' + (stage + 1) + ' .predict-option')
      .some(b => b.classList.contains('correct') && b.dataset.pick === picks[stage]);
    echo.hidden = false;
    echo.className = 'echo ' + (right ? 'echo-right' : 'echo-wrong');
    echo.innerHTML = 'You predicted: <b>' + picks[stage] + '</b> &mdash; ' +
      (right ? 'and that is what happened. ' : 'the flight says otherwise. ') +
      OBSERVED[stage]() +
      (flownMs ? ' You flew it for <b>' + flownMs.toLocaleString('en-US') + ' m/s</b>.' : '');
  }

  PREDICT_STAGES.forEach(stage => {
    $$('#predict-' + (stage + 1) + ' .predict-option').forEach(btn => {
      btn.addEventListener('click', () => {
        picks[stage] = btn.dataset.pick;
        showPick(stage);
        /* Committing stage 2's prediction is what opens its gate, so the
           flight view moves in and Escape Artist loads — but only if the
           learner is standing in stage 2, because the same buttons are
           reachable by a presenter reading ahead. */
        if (stage === 1 && selectedTab() === 1) {
          place(1);
          enterLevel(ESCAPE_ARTIST);
        }
      });
    });
  });

  /* ---- A4: the observation cues ----------------------------------------
     Edge-triggered, not continuous: a cue that rewrites itself sixty times a
     second is not a cue, and an aria-live region that never settles is hostile
     to a screen reader. Three edges fire one: arriving at an apsis, spending
     delta-v, and completing a level.

     Driven by a 250 ms interval rather than off the render loop. That is
     deliberate: it keeps the cue off the frame path, and it keeps the lesson
     layer honest in a browser pane where requestAnimationFrame is throttled. */
  const CUE = {
    peri: [
      o => 'Periapsis: <b>v = ' + o.vKms.toFixed(2) + ' km/s</b>. This is the fastest you will be on this orbit, so it is where a burn would buy the most energy &mdash; and the least change to the side of the orbit you are standing on.',
      o => 'Periapsis: <b>v = ' + o.vKms.toFixed(2) + ' km/s</b>, and the Oberth bar in the HUD is at full width. Every 1 m/s of &Delta;v spent here buys ' + o.vKms.toFixed(2) + ' units of energy &mdash; that number IS your speed.',
      o => 'Periapsis: <b>v = ' + o.vKms.toFixed(2) + ' km/s</b>. With a finite engine the speed peak is a moment, not a place: the burn has to straddle it.',
      o => 'Periapsis: <b>v = ' + o.vKms.toFixed(2) + ' km/s</b> &mdash; peak energy-per-&Delta;v on this orbit.'
    ],
    apo: [
      o => 'Apoapsis: <b>v = ' + o.vKms.toFixed(2) + ' km/s</b> &mdash; your slowest. A burn here buys the least energy anywhere on the orbit, which is why it is the place to <i>reshape</i> an orbit rather than to <i>grow</i> one.',
      o => 'Apoapsis: <b>v = ' + o.vKms.toFixed(2) + ' km/s</b>. Compare that with the periapsis reading: the same &Delta;v spent here does a fraction of the work.',
      o => 'Apoapsis: <b>v = ' + o.vKms.toFixed(2) + ' km/s</b>. A long burn out here is long AND slow &mdash; the worst of both.',
      o => 'Apoapsis: <b>v = ' + o.vKms.toFixed(2) + ' km/s</b> &mdash; minimum energy-per-&Delta;v on this orbit.'
    ]
  };

  function cue(stage, html, warm) {
    const el = document.getElementById('cue-' + (stage + 1));
    if (!el) return;
    el.className = 'obs-cue' + (warm ? ' cue-warm' : '');
    el.innerHTML = html;
  }

  function tick() {
    if (resetting) return;
    const o = G.oberth();
    if (!o) return;
    const stage = selectedTab();
    if (gated(stage)) return;

    /* A burn was spent since the last tick. THE SPEED COMES FROM THE GAME'S
       BURN LOG, never from the live state: this poll runs up to 250 ms late and
       an escaping ship has already slowed a long way by then. Reading it live
       reported a 6.08 km/s burn as a 2.21 km/s one, which inverts the lesson.
       A finite-thrust burn is still accumulating until endBurn() settles it, so
       it gets a provisional line and the summary once it is done. */
    const b = G.lastBurn();
    const burnSummary = () => {
      const atV = b ? b.vKms : o.vKms;
      cue(stage, 'Burn committed: <b>' + (b ? b.dvMs : o.dvUsedMs).toLocaleString('en-US') + ' m/s</b> spent at ' +
        (b && b.finite ? 'a &Delta;v-weighted mean of ' : 'v = ') + atV.toFixed(2) + ' km/s. ' +
        'Specific orbital energy &epsilon; is now <b>' + o.epsKm.toFixed(2) + ' km&sup2;/s&sup2;</b> &mdash; ' +
        (o.bound ? 'still negative, so the orbit is <b>bound</b> and will fall back.'
                 : '<b>above zero: you are escaping.</b>'), true);
      finitePending = false;
      zone = 'burn';
    };
    if (o.dvUsedMs > lastDv) {
      lastDv = o.dvUsedMs;
      if (b && !b.settled) {
        /* The CUMULATIVE for this burn, read from the record — the HUD counts
           the same number up. The per-poll increment was what printed
           "106 m/s delivered so far" on every poll (R-fuel-golf F4). */
        finitePending = true;
        cue(stage, 'Engine lit &mdash; <b>' + b.dvMs.toLocaleString('en-US') + ' m/s</b> delivered so far. ' +
          'Watch the speed while it burns: the &Delta;v arriving now is worth whatever v is <i>now</i>.', true);
        zone = 'burn';
      } else {
        burnSummary();
      }
      return;
    }
    if (o.dvUsedMs < lastDv) {                       // an undo refunded fuel
      lastDv = o.dvUsedMs;
      finitePending = false;                         // the record it awaited is gone
    }
    if (finitePending && b && b.settled) { burnSummary(); return; }

    const now = o.nearPeri ? 'peri' : o.nearApo ? 'apo' : 'none';
    /* Two sentinels, both silent. 'init' is the first observation after a
       level load: every level spawns at an apsis, so announcing it would put a
       cue on screen before the learner has acted. 'burn' is the first
       observation after a burn cue: a tangential burn leaves the ship AT an
       apsis of its new orbit, so a same-position re-evaluation is not an
       arrival, and letting it fire overwrote "Burn committed: 712 m/s…" with
       "Periapsis: v = 6.78 km/s" ~540 ms later on essentially every burn
       (R-fuel-golf F2). The burn cue therefore holds until the learner acts
       again or the ship genuinely leaves for, and arrives at, another apsis. */
    if (zone === 'init' || zone === 'burn') { zone = now; return; }
    if (now !== 'none' && now !== zone) cue(stage, CUE[now][stage](o));
    zone = now;
  }

  /* ---- the two directions of stage/level sync -------------------------- */
  function enterLevel(i) {
    if (syncing) return;
    syncing = true;
    try { G.loadLevel(i); } finally { syncing = false; }
  }

  /* game.js -> here. Chrome that depends on WHICH level is loaded, plus the
     tab follow when the learner picks a level from the game's own level list
     or presses "Next level" past a stage boundary. */
  G.hooks.onLevelLoad = i => {
    if (moonNote) moonNote.hidden = !G.LEVELS[i].moon;
    lastDv = 0;
    zone = 'init';
    finitePending = false;
    if (resetting || syncing) return;
    const want = stageOf(i);
    /* Loading a stage-2 level from the game's own Levels list is the learner's
       choice, and it opens the evidence gate. Before this, a re-gated stage 2
       ran Level 3 in the hidden host (canvas 0 px, gate card showing) and the
       attempt was discarded on the next tab click (R-fuel-golf F3). */
    if (want === 1) gate2Open = true;
    /* The game framed this level against the box it had at load time. If the
       flight view was hidden then (parked in host 0 behind a gate card), that
       box was 0 px and loadLevel fell back to a phantom 900x600 — so once it is
       placed somewhere visible, re-frame through the game's own fit control,
       which is what a fresh load does: fit + camera home. */
    const wasHidden = activity.offsetParent === null;
    if (want === selectedTab()) {
      place(want);
      if (wasHidden && activity.offsetParent !== null) { const z = document.getElementById('zoomFit'); if (z) z.click(); }
      return;
    }
    if (tabs[want] && tabs[want].disabled) return;     // do not route around a gate
    if (gated(want)) return;
    syncing = true;
    try { window.lessonShell.selectStage(want); } finally { syncing = false; }
    place(want);
    if (wasHidden && activity.offsetParent !== null) { const z = document.getElementById('zoomFit'); if (z) z.click(); }
  };

  G.hooks.onSucceed = (levelIndex, dvUsedVu, par) => {
    const stage = stageOf(levelIndex);
    syncTabs();
    /* Stage 1's claim is shown by either of its levels; stage 2's comparison
       belongs to Escape Artist specifically, because 661-against-1,835 is that
       orbit's number and not Level 4's or Level 5's; stage 3's belongs to
       Level 6, whose 775-against-919 it is. */
    const owns = (stage === 0) || (stage === 1 && levelIndex === ESCAPE_ARTIST) || (stage === 2 && levelIndex === 5);
    if (owns) writeObserved(stage, Math.round(dvUsedVu * 158.2));
    if (levelIndex === ESCAPE_ARTIST) {
      cue(1, 'Escaped. The <b>ORBIT</b> chip reads ESCAPING because &epsilon; crossed zero &mdash; ' +
        'and the debrief’s energy plot shows the burn as a vertical jump whose height is v&middot;&Delta;v + ½&Delta;v² ' +
        'evaluated at the speed you actually had. Stage 3 is now unlocked.', true);
    }
  };

  G.hooks.onProgressChange = syncTabs;

  /* ---- stagechange: CHROME ONLY ----------------------------------------
     No activity state is rendered from here. During a Reset the shell calls
     selectStage(0) at step 7 and dispatches `lessonreset` at step 9, so this
     handler runs while `picks` still holds the pre-reset answers; `resetting`
     makes it stand down rather than relying on the later handler to undo it. */
  document.addEventListener('stagechange', e => {
    const stage = e.detail.index;
    if (resetting) return;
    place(stage);
    if (syncing) return;
    const want = levelToEnter(stage);
    if (want !== null && !gated(stage)) enterLevel(want);
  });

  /* Presentation mode changes --u, which changes the flight view's box.
     game.js re-measures itself on the same event; this re-places the activity
     because the host's own width changed underneath it. */
  document.addEventListener('presentationchange', () => G.remeasure());

  /* ---- Reset: the lesson half ------------------------------------------
     The shell has already restored the tabs from its snapshot (so stage 3 is
     locked again and the complete marks are gone), cleared every check card,
     put the .echo spans and .obs-cue lines back to their first-load content,
     reset the Details drawer to stage 1, selected stage 1 and closed every
     dialog. game.js restores the flight view. What is left for this file is
     its own three variables and the two gates' chrome.

     ENUMERATED:
       1. picks[0..3]      -> null, and the three prediction button groups'
                              aria-pressed and .selected cleared with them.
       2. zone, lastDv, finitePending -> the A4 cue edge detectors, or the first
                              tick after a Reset fires a phantom "burn committed"
                              cue from a delta-v total that no longer exists.
       3. gate-2's card    -> visible again: picks[1] is null again, gate2Open
                              is false again, and resetActivity() clears the
                              badge the gate also consults.
       4. the activity's host -> back to host 0. It is ONE element that moves;
                              leaving it parked in stage 2's or 3's host would
                              show stage 1 with an empty panel.
       5. the echo spans' className -> the shell restores innerHTML and hidden
                              from its snapshot but NOT the class, and
                              writeObserved() sets .echo-right/.echo-wrong.
     The onReset veto is used as a flag, not a veto: it returns true so the
     reset proceeds, and sets `resetting` so the stagechange at step 7 stands
     down. That is the window.lessonShell.resetting the kit does not yet
     provide, synthesised in the one place the demo is guaranteed to be called
     before the shell starts. */
  window.lessonShell.onReset = () => { resetting = true; return true; };

  document.addEventListener('lessonreset', () => {
    picks = [null, null, null, null];
    zone = 'init';
    lastDv = 0;
    finitePending = false;
    gate2Open = false;                 // and G.resetActivity() below clears the badge the gate also consults
    PREDICT_STAGES.forEach(stage => {
      const echo = echoFor(stage);
      if (echo) echo.className = 'echo';
      showPick(stage);
    });
    G.resetActivity();
    place(0);
    syncTabs();
    resetting = false;
  });

  /* ---- start-up --------------------------------------------------------
     The shell has already run: it may have selected a stage from a #stage-N
     fragment, and its clamp will have refused a disabled one. So read the tab
     it settled on rather than assuming stage 1 — otherwise a deep link shows
     one stage's panel with another stage's level in it. */
  syncTabs();
  const opened = selectedTab();
  place(opened);
  const want = levelToEnter(opened);
  if (want !== null && !gated(opened)) enterLevel(want);
  if (moonNote) moonNote.hidden = !G.LEVELS[G.levelIndex()].moon;
  lastDv = 0;
  setInterval(tick, 250);
})();
