/* =====================================================================
   TOPPING OUT — APP
   Setup, the weekly meeting loop, the HUD, the debrief, the
   leaderboard and the instructor controls.
   ===================================================================== */
'use strict';

var TO = (typeof TO !== 'undefined' && TO) || {};

TO.App = (function () {

  var U = TO.Util;
  var g = null;                 // current game
  var baseline = null;          // no-intervention run, for the debrief
  var view = '4d';
  var phase = 'news';           // news | report | done
  var pending = null;           // { crews, ot, alloc, expedite }
  var lastProjection = null;
  var animating = false;
  /* The previous week's critical set, joined, so the A4 cue can say "the
     path MOVED" rather than reprinting it every week. null means "no week
     has run yet", which is why the first commit does not claim a move. */
  var lastCriticalKey = null;

  /* ---------- persistence (degrades gracefully) ------------------- */
  var memStore = {};
  function store(k, v) {
    try {
      if (v === undefined) {
        var raw = window.localStorage.getItem(k);
        return raw == null ? (memStore[k] == null ? null : memStore[k]) : JSON.parse(raw);
      }
      window.localStorage.setItem(k, JSON.stringify(v));
      memStore[k] = v;
    } catch (e) {
      if (v === undefined) return memStore[k] == null ? null : memStore[k];
      memStore[k] = v;
    }
  }

  /* ---------- glossary -------------------------------------------- */
  var GLOSSARY = {
    'critical path': 'The longest chain of dependent activities through the network. Every activity on it has zero total float, so a day lost on any of them is a day lost on the whole project. It is computed fresh every week, not fixed at baseline — it moves.',
    'total float': 'How many working days an activity can slip before it delays PROJECT COMPLETION. Total float is shared along a chain: if you spend it on one activity, the ones after it no longer have it.',
    'free float': 'How many days an activity can slip before it delays the very next activity. Free float belongs to that activity alone — spending it hurts nobody else. Free float is always less than or equal to total float.',
    'float': 'Spare time in the schedule. Total float is spare time before the project slips; free float is spare time before the next activity slips. Float is not free time to spend casually — it is shared, and it is contingency against the events you have not seen yet.',
    'lag': 'An enforced wait built into a relationship. "FS+4" means the next activity starts four working days after this one finishes. Concrete cure and inspection holds are modelled as activities rather than lags so you can see them sitting on the critical path.',
    'FS': 'Finish-to-Start. The successor cannot start until the predecessor finishes (plus any lag). The ordinary case.',
    'SS': 'Start-to-Start. The successor can start once the predecessor has been going for the lag period — how overlapping floor-by-floor work is really scheduled.',
    'FF': 'Finish-to-Finish. The successor cannot finish until the predecessor finishes (plus lag). Commissioning cannot close out before finishes do.',
    'liquidated damages': 'A fixed sum per calendar day owed to the owner for every day past contract completion. Not a penalty in law — it is an agreed estimate of the owner\'s loss. It accrues on calendar days, including weekends.',
    'general conditions': 'The cost of simply being on site: supervision, trailer, temp power, fencing, dumpsters, insurance. It burns per calendar day whether or not anybody is productive, which is why an idle week still costs real money.',
    'crash': 'Shortening an activity by adding resources — more crews, more hours. Crashing always costs more per day saved than working normally, so it only pays on the critical path.',
    'trade stacking': 'More crews in a zone than the zone can hold. Everybody loses productivity: they share the same hoist, the same laydown, the same access, and they work around each other. Four crews in a two-crew zone do not do four crews of work.',
    'total float remaining': 'The sum of total float across every activity still to be done. Think of it as how much cushion is left in the whole schedule. It falls as events consume it.',
    'buyout': 'The subcontracts and materials committed at award. It is fixed at this point in the job — you are managing the schedule and the crews, not renegotiating the buyout.',
    'expedite': 'Paying a premium to recover time on a late delivery: premium freight, buying somebody else\'s production slot, a substitute assembly. It buys back days, never all of them.',
    'overtime decay': 'Sustained overtime loses productivity week over week — fatigue, absenteeism, and the difficulty of keeping extended crews supplied with work and material. Past a point, a 60-hour week produces less than a 40-hour week did and costs 75% more.',
    'free float tail': 'The thin bar after an activity on the Gantt: the days it could slip before it pushes something else.',
    'proof roll': 'A loaded truck driven slowly across prepared subgrade while the inspector watches the ground under the tyres. It is how you find soft spots before you build on them.',
    'pumping': 'When subgrade flexes and rebounds in a visible wave behind a truck tyre. It means the soil is too wet or too soft to carry a slab, and it has to be undercut and replaced.',
    'undercut': 'Digging out unsuitable soil and replacing it with compacted stone so the slab has something to bear on.',
    'bearing capacity': 'How much load the soil under a footing can carry before it settles or fails, in pounds per square foot. The geotechnical report gives a design value and the footings are sized to it.',
    'EOR': 'Engineer of Record — the licensed engineer who sealed the structural drawings. A field determination from them is a written call that an inspector will accept.',
    'cylinder breaks': 'Sample cans filled from the same concrete truck and crushed in a lab at 7 and 28 days to prove the pour reached its design strength. Low breaks mean you cannot strip or load the element yet.',
    'embeds': 'Steel plates and anchor bolts cast into concrete for the next trade to bolt to. Out of position means the piece that lands on them does not fit, and the fix is chipping out finished concrete.',
    'special inspection': 'A code-required independent check of specific structural work by an inspector working for the owner, not for the contractor.',
    'dry-in': 'The point at which the roof and exterior walls keep weather out of the building. Interior work before dry-in is finished work under an open sky.',
    'rough-in': 'The ductwork, pipe and conduit installed inside walls and above ceilings before they are closed up.',
    'fire-caulk': 'Rated sealant packed around every pipe and conduit where it passes through a fire-rated wall. Each of those holes is a penetration, and a missed one voids the wall\'s rating.',
    'punchlist': 'The list of small defects that must be corrected before the owner accepts the building. Walking floors as they finish beats calling every sub back at the end.',
    'buyout': 'The period after award when the contractor actually purchases the subcontracts and materials. Long-lead items sit in manufacturing queues measured in months, and your place in the queue is set by the day you release the order.',
    'shop drawings': 'The fabricator\'s detailed drawings of exactly what they intend to build, reviewed and approved by the architect and engineer before fabrication starts.',
    'hot shot': 'A dedicated truck sent for a single load instead of waiting for the next scheduled delivery run. Fast and expensive.',
    'kickers': 'Temporary diagonal braces, sized by the engineer, that hold a foundation wall until the permanent structure does.',
    'pay application': 'The monthly invoice to the owner for the value of work in place, billed against the schedule of values. The owner typically pays about thirty days later.',
    'retainage': 'The share of every payment — here 5% — the owner holds back until the job is complete and accepted. It protects the owner and starves the contractor, which is why its release is a closeout event worth chasing.',
    'schedule of values': 'The agreed price breakdown of the contract by activity, which every pay application bills against. Loading it heavy early is called front-loading; owners know the trick.',
    'line of credit': 'The bank facility that carries the job while you wait to be paid. Interest on it is a real project cost that never appears on a schedule.',
    'standing': 'How much this subcontractor still likes working for you. Grind them with sustained overtime, joint checks and idle weeks and they answer slower: a wary sub takes an extra week to field a crew, a burned one drags.',
    'contract completion': 'The date in the contract. Finish after it and liquidated damages accrue per calendar day; finish before it and you earn a modest early-completion bonus.'
  };

  function gl(term, label) {
    return '<span class="gl" data-term="' + term + '">' + (label || term) + '</span>';
  }

  function initTooltips() {
    var tip = document.getElementById('tip');
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest ? e.target.closest('.gl') : null;
      if (!t) return;
      var key = t.getAttribute('data-term');
      var def = GLOSSARY[key] || GLOSSARY[key.toLowerCase()];
      if (!def) return;
      tip.innerHTML = '<b>' + key.toUpperCase() + '</b>' + def;
      tip.classList.add('on');
      place(tip, t);
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest && e.target.closest('.gl')) tip.classList.remove('on');
    });
    /* touch: tap to show, tap anywhere to hide */
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('.gl') : null;
      if (!t) { tip.classList.remove('on'); return; }
      var def = GLOSSARY[t.getAttribute('data-term')];
      if (!def) return;
      tip.innerHTML = '<b>' + t.getAttribute('data-term').toUpperCase() + '</b>' + def;
      tip.classList.add('on');
      place(tip, t);
    });
    function place(tip, t) {
      var r = t.getBoundingClientRect();
      var top = r.bottom + 8, left = Math.min(r.left, window.innerWidth - 320);
      if (top + tip.offsetHeight > window.innerHeight - 10) top = r.top - tip.offsetHeight - 8;
      tip.style.top = Math.max(8, top) + 'px';
      tip.style.left = Math.max(8, left) + 'px';
    }
  }

  function toast(msg, ms) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('on'); }, ms || 2600);
  }

  /* ---------- the demo's own two dialogs --------------------------
     DELETED in the lesson-shell retrofit: openOverlay / closeOverlay /
     topOverlay, the Escape handler, the backdrop-click handler and the
     [data-close] wiring. The shell's four dialogs are native <dialog>
     elements and do every one of those things — ADOPTING.md §2.

     What is left is the two dialogs that belong to the ACTIVITY rather than
     to the lesson: the per-run Debrief and the Engine self-test. They are
     NOT folded into the kit's per-stage #details drawer (ADOPTING.md §5 —
     that drawer is fixed content about the stage; these are outputs of this
     particular run), so they keep their own ids and are opened here.

     Both are native <dialog>, which matters for Reset: the shell closes
     every open <dialog>, not only its own four, so a debrief left up when
     someone presses Reset does not survive it. */
  function openSheet(id) {
    var d = document.getElementById(id);
    if (!d) return;
    if (d.open) return;
    try { d.showModal(); } catch (e) { d.setAttribute('open', ''); }
  }
  function closeSheet(id) {
    var d = document.getElementById(id);
    if (d && d.open) { try { d.close(); } catch (e) { d.removeAttribute('open'); } }
  }

  /* ---------- presentation mode -----------------------------------
     The shell owns the toggle and the body class now. This listens for the
     shell's `presentationchange` and does the one thing the shell cannot:
     re-render the activity, because the HUD and the views lay out
     differently at the larger type scale.

     `big` is this demo's own class name for its own activity rules and is
     kept; `presenter` is the shell's and is set by the shell. Storing the
     preference stays here — it is this demo's localStorage key, and an
     instructor's machine should remember it. */
  function applyPresentation(on) {
    document.body.classList.toggle('big', !!on);
    store('to.big', !!on);
    if (g) renderAll();
  }

  /* =================================================================
     SETUP
     ================================================================= */
  var setupState = { team: '', seed: '', project: 'tutorial', difficulty: 'standard' };

  function randomSeedCode() {
    /* Deterministic-looking but arbitrary; instructors normally type
       their own. Built from the page load counter, never Math.random,
       so nothing in the engine depends on it. */
    var n = (store('to.seedcount') || 0) + 1;
    store('to.seedcount', n);
    var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    var h = U.hashSeed('MSU' + n + 'x' + (n * 2654435761 % 100000));
    return A[h % 24] + A[(h >> 5) % 24] + '-' + (1000 + (h % 9000));
  }

  function renderSetup() {
    var host = document.getElementById('setup-inner');
    var lb = store('to.leaderboard') || [];
    host.innerHTML =
      '<div class="sheet">' +
        '<div class="sheet-title">' +
          '<div><div class="msu-line"><svg width="15" height="15" viewBox="0 0 20 20"><path d="M4 4 A 7.6 8.2 0 1 0 16 4" stroke="#ECAC00" stroke-width="3.6" fill="none" stroke-linecap="round"/></svg>MURRAY STATE UNIVERSITY</div><h1>CONSTRUCTION SCHEDULING</h1>' +
            '<div class="tagline"><b>Topping Out</b> — competitive construction scheduling. Same building, same weather, same bad luck: the only variable is what you decide. Go Racers.</div></div>' +
          '<div class="stamp">RACER CONSTRUCTION MGMT<br>SCHEDULING SIMULATION<br>REV 3.0</div>' +
        '</div>' +
        '<div class="sheet-body">' +
          '<div class="grid2">' +
            '<div>' +
              '<div class="field"><label>Team name</label>' +
                '<input type="text" id="in-team" maxlength="26" placeholder="Team 4 — Nguyen, Ruiz, Patel" value="' + esc(setupState.team) + '"></div>' +
              '<div class="field"><label>Seed code</label>' +
                '<input type="text" id="in-seed" class="seed" maxlength="14" placeholder="MSU-2601" value="' + esc(setupState.seed) + '">' +
                '<div class="help">Everyone in the class types the <b>same</b> seed. Same seed means the same project and the exact same sequence of events for every team, so the leaderboard measures decisions, not luck. ' +
                '<button class="btn sm ghost" id="btn-rollseed" style="margin-top:6px">Suggest a code</button></div></div>' +
            '</div>' +
            '<div>' +
              '<div class="field"><label>Project</label>' +
                '<div class="choice" id="ch-project">' +
                  '<button data-v="tutorial"><b>Tutorial</b><span class="d">Shoe Tree Annex · 10 activities · ~8 turns. Learn the loop and the views.</span></button>' +
                  '<button data-v="main"><b>Full game</b><span class="d">Racer Commons — Chestnut Street · 38 activities · 3 storeys. The competitive run.</span></button>' +
                '</div></div>' +
              '<div class="field"><label>Difficulty (instructor)</label>' +
                '<div class="choice" id="ch-diff">' +
                  '<button data-v="easy"><b>Easy</b><span class="d">Fewer, milder events</span></button>' +
                  '<button data-v="standard"><b>Standard</b><span class="d">The default run</span></button>' +
                  '<button data-v="hard"><b>Hard</b><span class="d">More events, harder hits</span></button>' +
                '</div></div>' +
            '</div>' +
          '</div>' +
          /* The Guide button carries the shell's `guide-open` class and needs
             no id and no handler of its own — the shell delegates on that
             class. The Presentation-mode checkbox that used to sit here is
             gone: the shell owns presentation mode, and a second control for
             it would be a second source of truth. */
          '<div style="display:flex;gap:10px;align-items:center;margin-top:6px;flex-wrap:wrap">' +
            '<button class="btn primary" id="btn-start" style="font-size:1rem;padding:11px 24px">Start the job</button>' +
            '<button class="btn ghost guide-open" type="button">? Guide</button>' +
            '<a class="btn ghost" href="teacher-guide.html" target="_blank" rel="noopener">📄 Session guide</a>' +
            '<a class="btn ghost" href="appendix.html" target="_blank" rel="noopener">📐 CPM appendix</a>' +
            '<button class="btn ghost" id="btn-selftest2" type="button">🧪 Engine self-test</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      (lb.length ? leaderboardHTML(lb, null, true) : '');

    ['ch-project', 'ch-diff'].forEach(function (id) {
      var key = id === 'ch-project' ? 'project' : 'difficulty';
      var box = document.getElementById(id);
      Array.prototype.forEach.call(box.children, function (b) {
        b.classList.toggle('on', b.getAttribute('data-v') === setupState[key]);
        b.onclick = function () { setupState[key] = b.getAttribute('data-v'); renderSetup(); };
      });
    });
    document.getElementById('in-team').oninput = function () { setupState.team = this.value; };
    document.getElementById('in-seed').oninput = function () { setupState.seed = this.value.toUpperCase(); };
    document.getElementById('btn-rollseed').onclick = function () {
      setupState.seed = randomSeedCode();
      document.getElementById('in-seed').value = setupState.seed;
    };
    document.getElementById('btn-start').onclick = startGame;
    document.getElementById('btn-selftest2').onclick = showSelfTest;
    /* The setup sheet's own leaderboard control. Settings has a second one
       under a DIFFERENT id (btn-lb-clear) — check-shell.js fails a built file
       that defines any id twice, and both of these are real controls in two
       real places, so they are two ids rather than one shared one. */
    var reset = document.getElementById('btn-lb-reset');
    if (reset) reset.onclick = clearLeaderboard;
  }

  function clearLeaderboard() {
    if (!window.confirm('Clear the leaderboard for every seed on this computer?')) return;
    store('to.leaderboard', []);
    toast('Leaderboard cleared.');
    if (!g) renderSetup();
  }

  /* A row is a score only if the game that wrote it had finished. Between
     the lesson-shell retrofit and 2026-09-16 the Stage 4 "Open the debrief"
     button could reach showDebrief() mid-game, and that wrote
     {profit: null, finish: "NaN/NaN"} rows and then blocked the real score
     from ever being recorded. Those rows are dropped on load, once, with a
     console note rather than an alert: the learner did nothing wrong. */
  function isScoreRow(e) {
    return !!e && typeof e.profit === 'number' && isFinite(e.profit) &&
      typeof e.finish === 'string' && !/NaN|undefined/.test(e.finish) &&
      typeof e.late === 'number' && isFinite(e.late);
  }
  function cleanLeaderboard() {
    var lb = store('to.leaderboard');
    if (!Array.isArray(lb)) return;
    var kept = lb.filter(isScoreRow);
    if (kept.length === lb.length) return;
    store('to.leaderboard', kept);
    if (window.console && console.info) {
      console.info('[topping-out] dropped ' + (lb.length - kept.length) +
        ' leaderboard row(s) written by an unfinished game (no profit / NaN finish); ' +
        kept.length + ' kept.');
    }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  function leaderboardHTML(lb, highlight, withReset) {
    var rows = lb.slice().sort(function (a, b) { return b.profit - a.profit; });
    var body = rows.map(function (e, i) {
      return '<tr' + (highlight && e.id === highlight ? ' class="me"' : '') + '>' +
        '<td class="rank">' + (i + 1) + '</td>' +
        '<td>' + esc(e.team) + '</td>' +
        '<td class="num">' + esc(e.seed) + '</td>' +
        '<td class="num">' + esc(e.finish) + '</td>' +
        '<td class="num">' + (e.late > 0 ? '+' + e.late : e.late) + 'd</td>' +
        '<td class="num">' + U.money(e.profit) + '</td></tr>';
    }).join('');
    return '<div class="sheet" style="margin-top:22px"><div class="sheet-title" style="padding:12px 24px">' +
      '<h2 style="font-size:1rem;letter-spacing:.1em">LEADERBOARD</h2>' +
      (withReset ? '<button class="btn sm danger" id="btn-lb-reset">Reset leaderboard</button>' : '') +
      '</div><div class="sheet-body" style="padding:10px 24px 18px">' +
      '<table class="lb"><thead><tr><th></th><th>Team</th><th>Seed</th><th>Finish</th><th>vs contract</th><th>Profit</th></tr></thead>' +
      '<tbody>' + body + '</tbody></table></div></div>';
  }

  function startGame() {
    var seed = (setupState.seed || '').trim();
    if (!seed) { toast('Enter a seed code — everyone in the class needs the same one.'); return; }
    if (!setupState.team.trim()) setupState.team = 'Team';
    var net = setupState.project === 'main' ? MAIN_NETWORK : TUTORIAL_NETWORK;
    var opts = {
      network: net, trades: TRADES, zones: ZONES, deck: EVENT_DECK, calls: CALLS,
      seed: seed, difficulty: setupState.difficulty, teamName: setupState.team
    };
    g = new TO.Game.Game(opts);
    baseline = TO.Baseline(opts);
    /* Clear the previous run's projection, or week 1 of the next game
       shows a delta against the last week of the game before it. */
    lastProjection = null;
    g.autoAllocate();
    resetPending();
    phase = 'news';
    document.getElementById('setup').hidden = true;
    document.getElementById('app').hidden = false;
    renderAll();

    /* The lesson half of starting a job. Stage 2 opens because there is now
       a schedule to run a week against - a real prerequisite, which is why
       it is a gate rather than a lock. */
    unlockStage(1, 'Run a week');
    answerCushion();
    predictCriticalUI();
    var cpm0 = g.computeCPM(null, null);
    cue('Schedule solved: ' + cpm0.projectEnd + ' working days against a ' +
        g.net.contractWorkingDays + '-day contract. ' +
        (cpm0.criticalIds || []).length + ' activities are on the critical path - read the float column.');
  }

  function resetPending() {
    g.autoAllocate();
    pending = {
      crews: U.deepClone(g.crews),
      ot: U.deepClone(g.ot),
      alloc: U.deepClone(g.alloc),
      expedite: [], calls: {}, pourThrough: false
    };
    /* a crew already on order stays on order unless you cancel it */
    g.crewOrders.forEach(function (o) { pending.crews[o.trade] = o.to; });
    Object.keys(pending.ot).forEach(function (t) { pending.ot[t] = 0; });
  }

  /* =================================================================
     HUD
     ================================================================= */
  function renderHUD(cpm, proj) {
    var net = g.net;
    var finishWd = g.finished ? g.finishWorkingDay : cpm.projectEnd;
    var lateCal = U.calDays(finishWd) - U.calDays(net.contractWorkingDays);
    var totalFloat = 0, minFloat = Infinity, critNext = null;
    g.net.activities.forEach(function (a) {
      if (g.state[a.id].finishDay !== null) return;
      var r = cpm.results[a.id];
      totalFloat += r.tf;
      if (r.tf < minFloat) minFloat = r.tf;
    });
    for (var i = 0; i < cpm.chain.length; i++) {
      if (g.state[cpm.chain[i]].finishDay === null) { critNext = cpm.chain[i]; break; }
    }
    var profit = g.finished ? g.profit : proj.projectedProfit;

    document.getElementById('project-block').innerHTML =
      '<div class="pname">' + esc(net.name) + '</div>' +
      '<div class="pmeta">SEED ' + esc(g.seed) + ' · ' + esc(g.teamName) + ' · ' +
      TO.Events.DIFFICULTY[g.difficulty].label.toUpperCase() + '</div>';

    var hud = document.getElementById('hud');
    hud.innerHTML =
      cell('Week / Day', 'WK ' + (g.finished ? g.week : g.week), 'Working day ' + g.day + ' · ' + U.fmtDate(net.startDate, g.day)) +
      cell('Contract completion', U.fmtDate(net.startDate, net.contractWorkingDays),
        net.contractWorkingDays + ' working days', '', 'opt2') +
      cell('Projected finish', U.fmtDate(net.startDate, finishWd),
        (lateCal === 0 ? 'on the date' : (lateCal > 0 ? '+' + lateCal + ' calendar days late' : Math.abs(lateCal) + ' days early')),
        lateCal > 0 ? 'bad' : (lateCal < 0 ? 'good' : '')) +
      cell(g.finished ? 'Final profit' : 'Projected profit', U.money(profit),
        g.finished ? 'final' : 'if this posture holds', profit < 0 ? 'bad' : (profit > 0 ? 'good' : '')) +
      (g.cashCfg ? cell('Cash position', U.money(g.cash),
        g.cash < 0 ? 'on the line of credit' : 'in the account',
        g.cash < 0 ? 'bad' : 'good') : '') +
      cell('Critical path', critNext ? critNext : '—',
        critNext ? esc(g.byId[critNext].name) : 'complete', '', 'grow') +
      cell('Total float left', totalFloat + ' wd',
        'lowest non-critical: ' + (isFinite(minFloat) ? minFloat : 0) + ' wd', '', 'opt');

    function cell(lab, val, sub, cls, extra) {
      return '<div class="hud-cell ' + (extra || '') + '">' +
        '<div class="hud-lab">' + lab + '</div>' +
        '<div class="hud-val ' + (cls || '') + '">' + val + '</div>' +
        '<div class="hud-sub">' + (sub || '') + '</div></div>';
    }
  }

  /* =================================================================
     VIEWS
     ================================================================= */
  function renderView(cpm) {
    var host = document.getElementById('view-host');
    if (view === '4d') TO.Views.render4D(host, g, cpm);
    else if (view === 'gantt') TO.Views.renderGantt(host, g, cpm);
    else TO.Views.renderNetwork(host, g, cpm);
    Array.prototype.forEach.call(document.querySelectorAll('#view-tabs button[data-view]'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === view);
    });
  }

  function renderAll() {
    var cpm = g.computeCPM(pending ? pending.alloc : null, pending ? pending.ot : null);
    var proj = g.finished ? null : g.project(pending.alloc, pending.ot, expediteCost(), pending.crews);
    renderHUD(cpm, proj || { projectedProfit: g.profit });
    renderView(cpm);
    if (phase === 'news') renderMeeting(cpm, proj);
  }

  /* =================================================================
     THE WEEKLY MEETING
     ================================================================= */
  function expediteCost() {
    var c = 0;
    g.weekEvents().forEach(function (e) {
      if (e.expedite && pending.expedite.indexOf(e.id) !== -1) c += e.expedite.fee;
    });
    /* crew mobilisation for anything above the high-water mark */
    Object.keys(pending.crews).forEach(function (t) {
      var hw = g.crewHighWater[t] || 0;
      if (pending.crews[t] > hw) c += (pending.crews[t] - hw) * Math.round(TRADES[t].weekly * 0.60);
    });
    /* calls answered this week */
    g.openCalls().forEach(function (call) {
      var pick = pending.calls[call.id];
      if (!pick) return;
      call.options.forEach(function (o) { if (o.id === pick) c += (o.cost || 0); });
    });
    if (pending.pourThrough) {
      var wx = g.weekEvents().filter(function (e) { return e.cat === 'weather'; })[0];
      if (wx && wx.rainActual > 0) c += Math.round(wx.rainActual * 2600);
    }
    return c;
  }

  function renderMeeting(cpm, proj) {
    document.getElementById('meeting-head').innerHTML =
      '<div class="wk">PROJECT WEEK ' + g.week + ' · MONDAY 7:00 AM · ' + U.fmtDate(g.net.startDate, g.day).toUpperCase() + '</div>' +
      '<div class="ttl">The weekly meeting</div>';

    var body = document.getElementById('meeting-body');
    var events = g.weekEvents();
    var html = '';

    /* ---- 1. THE NEWS -------------------------------------------- */
    html += '<div class="phase-tag">1 · The news</div>';
    events.forEach(function (e) {
      html += newsCard(e, cpm);
    });

    /* ---- 2. DECISIONS -------------------------------------------- */
    html += '<div class="phase-tag">2 · Decisions</div>';
    html += warnings(cpm);
    html += callsSection(cpm);
    html += weatherCall(events);
    var exp = expediteSection(events, cpm);
    if (exp) html += exp;
    html += crewBoard(cpm);

    body.innerHTML = html;
    wireMeeting(cpm);
    renderPreview(proj);
  }

  function newsCard(e, cpm) {
    var good = e.flavorOnly || e.bonus;
    var h = '<div class="news ' + (good ? 'good' : e.cat) + '">' +
      '<div class="cat">' + catLabel(e.cat) + '</div>' +
      '<div class="ttl">' + esc(e.title) + '</div>' +
      '<div class="txt">' + esc(e.text) + '</div>';
    var eff = [];
    if (e.cat === 'weather') {
      var f = e.forecast;
      eff.push('Forecast: ' + (f[0] === f[1] ? (f[0] === 0 ? 'no lost days' : f[0] + ' lost day(s)') : f[0] + '–' + f[1] + ' lost days') +
        (e.affects ? ' — ' + e.affects.join(', ') + ' only' : ' — weather-exposed work only') +
        '. <i>Actual may differ.</i>');
    }
    if (e.delay) {
      var target = firstOpen(e.delay.targets);
      eff.push(target
        ? '+' + e.delay.days + ' working day(s) on <b>' + target + '</b> ' + esc(g.byId[target].name) +
          ' — that activity has ' + floatLabel(cpm, target)
        : '<span class="none">No impact — that work is already behind us.</span>');
    }
    if (e.holdExtend) {
      var t2 = firstOpen(e.holdExtend.targets);
      eff.push(t2 ? '+' + e.holdExtend.days + ' day(s) added to the hold <b>' + t2 + '</b> — and a hold cannot be shortened by anything.'
        : '<span class="none">No impact — that inspection is already behind us.</span>');
    }
    if (e.productivity) eff.push(Math.round((1 - e.productivity.factor) * 100) + '% productivity loss for ' +
      e.productivity.trades.join(', ') + ' for ' + e.productivity.weeks + ' week(s).');
    if (e.bonus) { var t3 = firstOpen(e.bonus.targets); if (t3) eff.push('Picks up ' + e.bonus.days + ' day(s) on <b>' + t3 + '</b>.'); }
    if (e.cost) eff.push(U.money(e.cost) + ' cost — ' + esc(e.costNote || ''));
    if (e.revenue) eff.push('+' + U.money(e.revenue) + ' change order revenue.');
    if (e.flavorOnly && !eff.length) eff.push('<span class="none">No schedule or cost effect.</span>');

    h += '<div class="eff">' + eff.map(function (x) { return '<div>' + x + '</div>'; }).join('') + '</div></div>';
    return h;
  }

  function catLabel(c) {
    return ({ weather: 'Weather', delivery: 'Material delivery', subcontractor: 'Subcontractor',
      inspection: 'Inspection', design: 'RFI / design change', labor: 'Workforce' })[c] || c;
  }
  function firstOpen(ids) {
    for (var i = 0; i < ids.length; i++) {
      if (g.state[ids[i]] && g.state[ids[i]].finishDay === null) return ids[i];
    }
    return null;
  }
  function floatLabel(cpm, id) {
    var r = cpm.results[id];
    if (!r) return 'no schedule data';
    if (r.tf === 0) return '<b>no float — it is on the ' + gl('critical path') + '</b>';
    return r.tf + ' days of ' + gl('total float') + ' to absorb it';
  }

  /* ---- warnings ------------------------------------------------- */
  function warnings(cpm) {
    var h = '';
    /* zone stacking under the pending allocation */
    var zoneLoad = {};
    Object.keys(pending.alloc).forEach(function (id) {
      var a = g.byId[id];
      if (!a || a.fixed) return;
      var n = Math.min(pending.alloc[id], a.maxCrews || 1);
      if (n > 0) zoneLoad[a.zone] = (zoneLoad[a.zone] || 0) + n;
    });
    var over = Object.keys(zoneLoad).filter(function (z) { return zoneLoad[z] > g.zones[z].cap; });
    if (over.length) {
      h += '<div class="warnbox bad"><b>' + gl('trade stacking', 'Trade stacking') + ' in ' + over.join(', ') + '</b>' +
        over.map(function (z) {
          var n = zoneLoad[z], cap = g.zones[z].cap;
          return z + ': ' + n + ' crews in a ' + cap + '-crew zone — every crew there drops to ' +
            Math.round(TO.Model.stackFactor(n, cap) * 100) + '% productivity.';
        }).join(' ') + '</div>';
    }
    /* trades with critical work open and nobody on it */
    var starved = [];
    g.openActivities(g.day).forEach(function (o) {
      if (o.act.fixed || !o.act.trade) return;
      if (cpm.results[o.id].tf > 0) return;
      if ((pending.alloc[o.id] || 0) > 0) return;
      starved.push(o.id);
    });
    if (starved.length) {
      h += '<div class="warnbox"><b>Critical work with no crew on it</b>' +
        starved.map(function (id) { return id + ' ' + esc(g.byId[id].name); }).join('; ') +
        '. Every day it waits is a day on the end of the job.</div>';
    }
    return h;
  }

  /* ---- JUDGMENT CALLS ----------------------------------------------
     The decision that matters most is usually not how many crews to
     put on a front — it is a call made before the work starts whose
     consequence lands weeks later. Each option shows what it costs
     today and the chance it leaves behind.                            */
  function riskBand(r) {
    if (r <= 0) return ['none', 'no exposure'];
    if (r <= 0.08) return ['low', 'low'];
    if (r <= 0.2) return ['med', 'moderate'];
    return ['high', 'high'];
  }

  function callsSection(cpm) {
    var open = g.openCalls();
    if (!open.length) return '';
    var h = '<div class="dec-group"><h4>Calls to make ' +
      '<span class="hint">decide now, find out later</span></h4>';
    open.forEach(function (c) {
      var picked = pending.calls[c.id];
      h += '<div class="call' + (picked ? ' answered' : '') + (c.procurement ? ' proc' : '') + '">' +
        '<div class="call-kind">' + (c.procurement ? 'Procurement' : 'Judgment call') +
          (c.resolveAt && g.byId[c.resolveAt]
            ? ' · shows up at ' + c.resolveAt + ' ' + esc(g.byId[c.resolveAt].name)
            : ' · protects you all job') + '</div>' +
        '<div class="call-ttl">' + esc(c.title) + '</div>' +
        '<div class="call-txt">' + esc(c.text) + '</div>' +
        (c.detail ? '<details class="call-detail"><summary>What this actually means</summary>' +
          '<div>' + esc(c.detail) + '</div></details>' : '');
      c.options.forEach(function (o) {
        var band = riskBand(o.risk);
        var on = picked === o.id;
        h += '<button class="call-opt' + (on ? ' on' : '') + (o.unsafe ? ' unsafe' : '') +
            '" data-call="' + c.id + '" data-opt="' + o.id + '">' +
          '<span class="co-main"><span class="co-lab">' +
            (o.unsafe ? '<span class="unsafe-badge">⚠ UNSAFE</span> ' : '') + esc(o.label) + '</span>' +
            '<span class="co-note">' + esc(o.note || '') + '</span>' +
            (o.unsafe ? '<span class="co-why">' + esc(o.unsafeWhy) + '</span>' : '') + '</span>' +
          '<span class="co-price">' +
            (o.cost ? U.money(o.cost) : 'no cost') +
            (o.delay ? '<br>+' + o.delay + ' wd' : '') + '</span>' +
          '<span class="co-risk r-' + band[0] + '">' +
            (c.procurement
              ? (o.sets ? 'covered' : 'exposed')
              : Math.round(o.risk * 100) + '%<br><i>' + band[1] + '</i>') + '</span>' +
          '</button>';
      });
      if (!picked) h += '<div class="call-warn">Not answering is answering — the first option is what happens.</div>';
      h += '</div>';
    });
    h += '</div>';
    return h;
  }

  /* ---- THE WEATHER CALL --------------------------------------------- */
  function weatherCall(events) {
    var wx = null;
    events.forEach(function (e) { if (e.cat === 'weather') wx = e; });
    if (!wx || !wx.forecast || wx.forecast[1] <= 0) return '';
    var exposed = [];
    g.openActivities(g.day).forEach(function (o) {
      if (!o.act.weather || o.act.fixed) return;
      if ((pending.alloc[o.id] || 0) <= 0) return;
      if (wx.affects && wx.affects.indexOf(o.act.trade) === -1) return;
      exposed.push(o.id);
    });
    if (!exposed.length) return '';
    var on = pending.pourThrough;
    var likely = Math.max(1, Math.round((wx.forecast[0] + wx.forecast[1]) / 2));
    var cost = Math.round(likely * 2600);
    var risk = Math.min(0.62, 0.16 * likely);
    return '<div class="dec-group"><h4>The weather call ' +
      '<span class="hint">' + wx.forecast[0] + '–' + wx.forecast[1] + ' days forecast</span></h4>' +
      '<div class="wxcall">' +
        '<div class="wx-txt">Exposed this week: <b>' + exposed.join(', ') + '</b>. ' +
          'Stand down on the rain days and you lose them. Work through and you keep most of them — ' +
          'at 70% production, a pumping and protection bill, and a chance of placing something you will ' +
          'be taking back out — a chance that grows with every day you keep at it.</div>' +
        '<div class="wx-opts">' +
          '<button class="call-opt' + (!on ? ' on' : '') + '" data-wx="0">' +
            '<span class="co-main"><span class="co-lab">Stand down on the rain days</span>' +
            '<span class="co-note">Lose the days. Nothing else.</span></span>' +
            '<span class="co-price">no cost</span><span class="co-risk r-none">safe</span></button>' +
          '<button class="call-opt' + (on ? ' on' : '') + '" data-wx="1">' +
            '<span class="co-main"><span class="co-lab">Work through it</span>' +
            '<span class="co-note">Pumps, covers and a wet crew.</span></span>' +
            '<span class="co-price">' + U.money(cost) + '</span>' +
            '<span class="co-risk ' + (risk > 0.3 ? 'r-high' : 'r-med') + '">' +
              Math.round(risk * 100) + '%<br><i>bad pour</i></span></button>' +
        '</div></div></div>';
  }

  /* ---- THE CREW BOARD ---------------------------------------------
     One board instead of three lists. Everything about a trade lives
     in one place: how many crews you are paying for, what overtime
     they are on, which work fronts are open to them, and how many
     crews are standing around. Trades with nothing open collapse to a
     single line so week 1 is not a wall of irrelevant steppers.       */
  function crewBoard(cpm) {
    var open = g.openActivities(g.day);

    /* group open fronts by trade */
    var byTrade = {}, holds = [];
    open.forEach(function (o) {
      if (o.act.fixed || !o.act.trade) { holds.push(o); return; }
      (byTrade[o.act.trade] = byTrade[o.act.trade] || []).push(o);
    });

    var active = [], idleTrades = [], offTrades = [];
    Object.keys(TRADES).forEach(function (t) {
      if (g.net.maxHire[t] == null) return;
      var hasWork = g.net.activities.some(function (a) {
        return a.trade === t && g.state[a.id].finishDay === null;
      });
      if (!hasWork) return;
      if (byTrade[t]) active.push(t);
      else if ((pending.crews[t] || 0) > 0 && g.onRoster[t]) idleTrades.push(t);
      else offTrades.push(t);
    });

    /* sort so the trade holding the critical path comes first */
    active.sort(function (x, y) {
      return minFloat(byTrade[x], cpm) - minFloat(byTrade[y], cpm);
    });

    var h = '<div class="dec-group"><h4>The crew board ' +
      '<span class="hint">who is on site, where they go, what it costs</span></h4>';

    if (!active.length && !holds.length) {
      h += '<div class="board-empty">Nothing to assign this week. Work is waiting on a ' +
        gl('lag', 'cure or a hold') + '.</div>';
    }

    active.forEach(function (t) { h += tradeCard(t, byTrade[t], cpm); });

    /* non-compressible holds get their own quiet block — you cannot
       act on them, and saying so is the whole point */
    if (holds.length) {
      h += '<div class="hold-block"><div class="hold-h">Running on their own — nothing you can do</div>';
      holds.forEach(function (o) {
        var r = cpm.results[o.id];
        h += '<div class="hold-row"><span class="id">' + o.id + '</span>' +
          esc(o.act.name) + '<span class="hold-tag">' +
          (o.act.kind === 'cure' ? 'CURE' : 'INSPECTION') + ' · ' +
          Math.ceil(g.state[o.id].remaining + g.state[o.id].holdExtra) + ' wd left</span></div>';
      });
      h += '</div>';
    }

    if (idleTrades.length) {
      h += '<div class="dec-sub">On site with nothing open</div>';
      idleTrades.forEach(function (t) { h += tradeCard(t, [], cpm, true); });
    }

    if (offTrades.length) {
      h += '<div class="board-off">Not on site yet: ' +
        offTrades.map(function (t) { return esc(TRADES[t].name); }).join(', ') +
        '. They mobilise when their work opens.</div>';
    }

    h += '<div style="margin-top:8px"><button class="btn sm ghost" id="btn-auto">' +
      '↻ Auto-assign (critical path first)</button></div></div>';
    return h;
  }

  function minFloat(list, cpm) {
    if (!list || !list.length) return 999;
    return list.reduce(function (m, o) { return Math.min(m, cpm.results[o.id].tf); }, 999);
  }

  function tradeCard(t, fronts, cpm, idleOnly) {
    var max = g.net.maxHire[t];
    var n = pending.crews[t] || 0;
    var assigned = 0;
    fronts.forEach(function (o) { assigned += Math.min(pending.alloc[o.id] || 0, o.act.maxCrews || 1); });
    var idle = Math.max(0, n - assigned);
    var lvl = pending.ot[t] || 0;
    var streak = (g.otStreak[t] || 0) + (lvl > 0 ? 1 : 0);
    var prod = TO.Model.otProductivity(lvl, streak);
    var costMult = TO.Model.otCost(lvl);
    var daily = TRADES[t].weekly / 5;
    var crit = minFloat(fronts, cpm) === 0;

    /* crew pips: filled = working, hollow amber = idle and still billing */
    var here = g.crews[t] || 0;                 // actually on site now
    var order = null;
    g.crewOrders.forEach(function (o) { if (o.trade === t) order = o; });
    if (n > here) order = { to: n, arrivesWeek: (order ? order.arrivesWeek : g.week + 2) };

    var pips = '';
    for (var i = 0; i < here; i++) pips += '<span class="pip' + (i < assigned ? '' : ' idle') + '"></span>';
    for (var j = here; j < n; j++) pips += '<span class="pip onorder" title="ordered, not here yet"></span>';
    if (!n) pips = '<span class="pip none"></span>';

    var h = '<div class="trade-card' + (crit ? ' crit' : '') + (idleOnly ? ' dim' : '') + '">';

    /* header: name, crew count, overtime */
    var stLabel = g.standingLabel ? g.standingLabel(t) : 'SOLID';
    h += '<div class="tc-head">' +
      '<span class="tc-name"><span class="tc-tag" style="background:' + TRADES[t].color + '">' +
        (TRADES[t].short || t) + '</span>' + esc(TRADES[t].name) +
        '<span class="st-chip st-' + stLabel.toLowerCase() + '" title="' +
          (stLabel === 'SOLID' ? 'This sub takes your calls first.'
            : (stLabel === 'WARY' ? 'You have been grinding them — their next crew takes an extra week to arrive.'
              : 'Burned out on this job. They mobilize slower and they work like it (−5%).')) +
        '">' + stLabel + '</span></span>' +
      '<span class="tc-crews">' + pips +
        '<span class="stepper">' +
          '<button data-crew="' + t + '" data-d="-1"' + (n <= 0 ? ' disabled' : '') + ' title="Release a crew">–</button>' +
          '<span class="n">' + n + '</span>' +
          '<button data-crew="' + t + '" data-d="1"' + (n >= max ? ' disabled' : '') + ' title="Add a crew">+</button>' +
        '</span></span>' +
      '</div>';

    /* cost + overtime line */
    var otNote = lvl === 0 ? 'straight time'
      : (TO.Model.OT[lvl].hours + ' hr week' + (streak > 1 ? ', week ' + streak : ''));
    var idleNow = Math.max(0, here - assigned);
    h += '<div class="tc-meta">' +
      '<span class="tc-cost">' + U.money(daily * costMult) + '/crew-day' +
        (idleNow > 0 ? ' · <b class="warn-txt">' + idleNow + ' idle: ' + U.money(idleNow * daily * 0.5) + '/day for nothing</b>' : '') +
        (order && order.to > here ? ' · <b class="order-txt">+' + (order.to - here) +
          ' arrives wk ' + order.arrivesWeek + '</b>' : '') +
      '</span>' +
      '<span class="seg" title="Hours per week for this trade">' +
        segBtn(t, 0, lvl, '40') + segBtn(t, 1, lvl, '50') + segBtn(t, 2, lvl, '60') +
      '</span></div>';

    if (lvl > 0) {
      h += '<div class="tc-ot' + (prod < 1 ? ' bad' : '') + '">' +
        (prod < 1
          ? '⚠ ' + otNote + ' — now producing ' + Math.round((1 - prod) * 100) + '% LESS than 40 hours, at ' +
            Math.round((costMult - 1) * 100) + '% more cost'
          : otNote + ' — ×' + prod.toFixed(2) + ' work for ×' + costMult.toFixed(2) + ' cost') +
        '</div>';
    }

    /* work fronts */
    if (!fronts.length) {
      h += '<div class="tc-front none">No work front open for them this week.</div>';
    }
    fronts.forEach(function (o) {
      var r = cpm.results[o.id], a = o.act;
      var c = pending.alloc[o.id] || 0;
      var usedElsewhere = 0;
      fronts.forEach(function (q) {
        if (q.id !== o.id) usedElsewhere += Math.min(pending.alloc[q.id] || 0, q.act.maxCrews || 1);
      });
      var canAdd = Math.min(a.maxCrews || 1, (g.crews[t] || 0) - usedElsewhere);
      var left = Math.ceil(g.state[o.id].remaining);
      var floatTag = r.tf === 0
        ? '<span class="f crit">CRITICAL PATH</span>'
        : '<span class="f">' + r.tf + ' wd float</span>';
      var wait = o.opensOffset > 0 ? '<span class="f wait">opens ' + dayName(o.opensOffset) + '</span>' : '';
      var wx = a.weather ? '<span class="f wx" title="Rain days stop this work">WEATHER</span>' : '';

      h += '<div class="tc-front' + (c > 0 ? ' on' : '') + (r.tf === 0 && c === 0 ? ' starved' : '') + '">' +
        '<span class="fr-loc">' + zoneLabel(a.zone) + '</span>' +
        '<span class="fr-name"><span class="id">' + o.id + '</span>' + esc(a.name) + '</span>' +
        '<span class="fr-tags">' + floatTag + wait + wx +
          '<span class="f days">' + left + ' wd left</span></span>' +
        '<span class="stepper">' +
          '<button data-alloc="' + o.id + '" data-d="-1"' + (c <= 0 ? ' disabled' : '') + '>–</button>' +
          '<span class="n">' + c + '</span>' +
          '<button data-alloc="' + o.id + '" data-d="1"' + (c >= canAdd ? ' disabled' : '') + '>+</button>' +
        '</span></div>';
    });

    h += '</div>';
    return h;
  }

  function segBtn(t, v, cur, label) {
    return '<button data-ot="' + t + '" data-v="' + v + '" class="' +
      (cur === v ? 'on' + (v === 2 ? ' hot' : '') : '') + '">' + label + '</button>';
  }
  function dayName(off) {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][Math.max(0, Math.min(4, off))];
  }
  function zoneLabel(z) {
    return '<span class="zbadge z-' + z + '">' + z + '</span>';
  }

  /* ---- expedite ---------------------------------------------------- */
  function expediteSection(events, cpm) {
    var opts = events.filter(function (e) { return e.expedite && firstOpen(e.delay ? e.delay.targets : []); });
    if (!opts.length) return '';
    var h = '<div class="dec-group"><h4>' + gl('expedite', 'Expedite') + '<span class="hint">buy days back</span></h4>';
    opts.forEach(function (e) {
      var on = pending.expedite.indexOf(e.id) !== -1;
      var target = firstOpen(e.delay.targets);
      h += '<div class="row"><span class="nm">' + esc(e.expedite.label) +
        '<br><span style="font-size:.72rem;color:var(--ink-3)">buys back ' + e.expedite.recover +
        ' of the ' + e.delay.days + ' days on ' + target + ' · ' + floatLabelPlain(cpm, target) +
        (e.expedite.detail ? '<br><i>' + esc(e.expedite.detail) + '</i>' : '') + '</span></span>' +
        '<button class="btn sm' + (on ? ' primary' : '') + '" data-exp="' + e.id + '">' +
        (on ? '✓ ' : '') + U.money(e.expedite.fee) + '</button></div>';
    });
    h += '</div>';
    return h;
  }
  function floatLabelPlain(cpm, id) {
    var r = cpm.results[id];
    return r ? (r.tf === 0 ? 'on the critical path' : r.tf + ' wd float') : '';
  }

  /* ---- preview ------------------------------------------------------ */
  function renderPreview(proj) {
    var foot = document.getElementById('meeting-foot');
    if (!proj) { foot.innerHTML = ''; return; }
    var base = lastProjection;
    var dDate = base ? (proj.projectEnd - base.projectEnd) : 0;
    var dProfit = base ? (proj.projectedProfit - base.projectedProfit) : 0;
    var lateTxt = proj.lateCalendarDays > 0
      ? '<span style="color:var(--red)">' + proj.lateCalendarDays + ' calendar days late</span>'
      : (proj.lateCalendarDays < 0
        ? '<span style="color:var(--green)">' + Math.abs(proj.lateCalendarDays) + ' days early</span>'
        : 'on the contract date');

    foot.innerHTML =
      '<div id="preview">' +
        '<div class="ph">Live preview — before you commit</div>' +
        '<div class="pv-row"><span class="k">Projected finish</span><span class="v">' + proj.finishDate +
          (dDate ? '<span class="delta ' + (dDate > 0 ? 'up' : 'down') + '">' + (dDate > 0 ? '+' : '') + dDate + ' wd</span>' : '') +
          '</span></div>' +
        '<div class="pv-row"><span class="k">Against ' + gl('contract completion', 'contract') + '</span><span class="v">' + lateTxt + '</span></div>' +
        '<div class="pv-row"><span class="k">This week\'s added cost</span><span class="v">' + U.money(expediteCost()) + '</span></div>' +
        '<div class="pv-row"><span class="k">Projected profit</span><span class="v ' +
          (proj.projectedProfit < 0 ? 'bad' : '') + '">' + U.money(proj.projectedProfit) +
          (dProfit ? '<span class="delta ' + (dProfit < 0 ? 'up' : 'down') + '">' + (dProfit > 0 ? '+' : '') + U.money(dProfit) + '</span>' : '') +
          '</span></div>' +
        '<div class="pv-note">The projection assumes this week\'s crews and overtime hold for the rest of the job. ' +
          'Overtime that looks free this week decays if you keep it on.</div>' +
      '</div>' +
      '<button class="btn commit" id="btn-commit">COMMIT WEEK ' + g.week + ' — NO UNDO</button>';
    document.getElementById('btn-commit').onclick = commitWeek;
  }

  /* ---- wiring -------------------------------------------------------- */
  function wireMeeting(cpm) {
    var body = document.getElementById('meeting-body');
    body.onclick = function (ev) {
      var b = ev.target.closest('button');
      if (!b) return;
      if (b.id === 'btn-auto') {
        g.crews = U.deepClone(pending.crews);
        g.autoAllocate();
        pending.alloc = U.deepClone(g.alloc);
        return renderAll();
      }
      if (b.hasAttribute('data-alloc')) {
        var id = b.getAttribute('data-alloc'), d = +b.getAttribute('data-d');
        var a = g.byId[id];
        var used = 0;
        Object.keys(pending.alloc).forEach(function (k) {
          var aa = g.byId[k];
          if (aa && aa.trade === a.trade && k !== id) used += Math.min(pending.alloc[k], aa.maxCrews || 1);
        });
        var next = (pending.alloc[id] || 0) + d;
        next = Math.max(0, Math.min(next, a.maxCrews || 1, (g.crews[a.trade] || 0) - used));
        pending.alloc[id] = next;
        return renderAll();
      }
      if (b.hasAttribute('data-crew')) {
        var t = b.getAttribute('data-crew'), dd = +b.getAttribute('data-d');
        var max = g.net.maxHire[t];
        pending.crews[t] = Math.max(0, Math.min(max, (pending.crews[t] || 0) + dd));
        /* trim allocation that no longer has crews behind it */
        var cap = Math.min(pending.crews[t], g.crews[t] || 0), seen = 0;
        Object.keys(pending.alloc).forEach(function (k) {
          var aa = g.byId[k];
          if (!aa || aa.trade !== t) return;
          var allow = Math.max(0, Math.min(pending.alloc[k], cap - seen));
          pending.alloc[k] = allow; seen += allow;
        });
        return renderAll();
      }
      if (b.hasAttribute('data-ot')) {
        pending.ot[b.getAttribute('data-ot')] = +b.getAttribute('data-v');
        return renderAll();
      }
      if (b.hasAttribute('data-call')) {
        pending.calls[b.getAttribute('data-call')] = b.getAttribute('data-opt');
        return renderAll();
      }
      if (b.hasAttribute('data-wx')) {
        pending.pourThrough = b.getAttribute('data-wx') === '1';
        return renderAll();
      }
      if (b.hasAttribute('data-exp')) {
        var eid = b.getAttribute('data-exp');
        var i = pending.expedite.indexOf(eid);
        if (i === -1) pending.expedite.push(eid); else pending.expedite.splice(i, 1);
        return renderAll();
      }
    };
  }

  /* =================================================================
     COMMIT + THE WEEK RUNS
     ================================================================= */
  function commitWeek() {
    if (animating) return;
    animating = true;
    lastProjection = g.project(pending.alloc, pending.ot, expediteCost(), pending.crews);
    var rec = g.runWeek({
      crews: pending.crews, ot: pending.ot, alloc: pending.alloc,
      expedite: pending.expedite, calls: pending.calls, pourThrough: pending.pourThrough
    });
    document.getElementById('meeting-foot').innerHTML = '';
    document.getElementById('meeting-body').innerHTML =
      '<div class="phase-tag">3 · The week runs</div>' +
      '<div style="font-size:.85rem;color:var(--ink-2);padding:8px 0">Monday through Friday…</div>';
    if (TO.App._mSet && window.innerWidth <= 820) TO.App._mSet('site');
    animateWeek(rec, function () {
      animating = false;
      phase = 'report';
      renderAll();
      renderReport(rec);
      if (TO.App._mSet && window.innerWidth <= 820) TO.App._mSet('meet');

      /* A week has run, so a decision now has a consequence to look at:
         stage 3 (make a call) and stage 4 (debrief) both open here. */
      unlockStage(2, 'Make a call');
      unlockStage(3, 'Debrief');
      /* Stage 2's signature prediction is judged against the network the
         engine has just re-solved, and the widget is rebuilt for the next
         week off the new state. */
      answerCritical();
      predictCriticalUI();

      /* A4: the week the critical path moves is the observation that
         matters most in this demo, so it is said out loud rather than left
         for the learner to notice in a bar chart. */
      var after = g.computeCPM(null, null);
      var crit = (after.criticalIds || []);
      if (lastCriticalKey !== null && crit.join(',') !== lastCriticalKey) {
        cue('The critical path MOVED this week - it now runs through ' +
            crit.slice(0, 3).join(', ') + (crit.length > 3 ? '...' : '') +
            '. Who was watching the float column last week?');
      } else {
        cue('Week committed. Critical path unchanged: ' +
            (crit.length ? crit.slice(0, 3).join(', ') : 'nothing left') +
            (crit.length > 3 ? '...' : '') + '.');
      }
      lastCriticalKey = crit.join(',');

      if (g.finished) setTimeout(function () { showDebrief(); }, 900);
    });
  }

  function animateWeek(rec, done) {
    var host = document.getElementById('view-host');
    if (view !== '4d') { view = '4d'; renderView(g.computeCPM()); }
    var chip = document.getElementById('daychip');
    var rain = document.getElementById('rainfx');
    var bar = document.querySelector('#runbar i');
    var days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    var i = 0;
    var STEP = 190;
    function tick() {
      if (i >= 5) {
        if (chip) chip.classList.remove('on');
        if (rain) rain.classList.remove('on');
        if (bar) bar.style.width = '0%';
        return done();
      }
      var d = rec.dayLog[i];
      if (chip) {
        chip.classList.add('on');
        chip.textContent = days[i] + (d && d.rain ? ' · RAIN' : '') + ' · ' + (d ? d.working : 0) + ' fronts working';
      }
      if (rain) rain.classList.toggle('on', !!(d && d.rain));
      if (bar) bar.style.width = ((i + 1) / 5 * 100) + '%';
      i++;
      setTimeout(tick, STEP);
    }
    tick();
  }

  function renderReport(rec) {
    document.getElementById('meeting-head').innerHTML =
      '<div class="wk">WEEK ' + rec.week + ' IN THE BOOKS</div>' +
      '<div class="ttl">' + (g.finished ? 'Project complete' : 'What happened') + '</div>';

    var h = '';
    if (rec.chainChanged && rec.movedTo) {
      h += '<div class="cp-move"><b>The ' + gl('critical path') + ' has moved</b> — it now runs through <b>' +
        rec.movedTo + ' ' + esc(g.byId[rec.movedTo].name) + '</b>. What you were protecting last week may not be what matters this week.</div>';
    } else if (rec.chainChanged) {
      var driver = null;
      for (var ci = 0; ci < rec.chain.length; ci++) {
        if (g.state[rec.chain[ci]].finishDay === null) { driver = rec.chain[ci]; break; }
      }
      h += '<div class="cp-move">The ' + gl('critical path') + ' has changed shape' +
        (driver ? ' — it now runs into <b>' + driver + ' ' + esc(g.byId[driver].name) + '</b>' : '') +
        '. Same finish date, different chain driving it.</div>';
    }

    h += '<div class="phase-tag">Week ' + rec.week + ' results</div>';
    if (rec.rainDays > 0) {
      h += line('☔', rec.rainDays + ' rain day' + (rec.rainDays === 1 ? '' : 's') +
        ' — earthwork, concrete, roofing and envelope only. Everything else worked.', 'bad');
    }
    rec.newsEffects.forEach(function (e) {
      if (/rain day/.test(e)) return;                 // already reported above
      h += line('•', e, /no impact|recovered|picked up/.test(e) ? 'good' : 'bad');
    });
    rec.expediteNotes.forEach(function (e) { h += line('$', e, ''); });
    (rec.callNotes || []).forEach(function (n) {
      h += line(n.good ? '✓' : '✗', n.text, n.good ? 'good' : 'bad');
    });
    (rec.cashNotes || []).forEach(function (n) {
      h += line('$', n.text, n.good ? 'good' : 'bad');
    });
    (rec.standingNotes || []).forEach(function (n) {
      h += line(n.good ? '☺' : '☹', n.text, n.good ? 'good' : 'bad');
    });
    (rec.unsafeChosen || []).forEach(function (u) {
      h += '<div class="unsafe-flag"><b>⚠ You authorised something unsafe: ' + esc(u.title) + '</b>' +
        esc(u.unsafeWhy) + '</div>';
    });
    (rec.arrivals || []).forEach(function (a) {
      h += line('+', TRADES[a.trade].name + ' second crew arrived on site.', 'good');
    });
    if (rec.completed.length) {
      h += line('✓', 'Completed: ' + rec.completed.map(function (id) { return id + ' ' + g.byId[id].name; }).join(', '), 'good');
    }
    var stacked = Object.keys(rec.stackedZones);
    if (stacked.length) {
      h += line('!', 'Trade stacking in ' + stacked.map(function (z) {
        return z + ' (' + rec.stackedZones[z] + ' crews, cap ' + g.zones[z].cap + ')';
      }).join(', ') + ' — everyone there worked slower.', 'bad');
    }
    var idle = Object.keys(rec.idleCrewDays).filter(function (t) { return rec.idleCrewDays[t] > 0; });
    if (idle.length) {
      h += line('◦', 'Idle crew-days: ' + idle.map(function (t) {
        return TRADES[t].name + ' ' + rec.idleCrewDays[t];
      }).join(', ') + ' — ' + U.money(rec.idleCost) + ' for people with nowhere to go.', 'bad');
    }
    h += line('$', 'Labour ' + U.money(rec.laborCost) +
      (rec.otPremium > 0 ? ' (incl. ' + U.money(rec.otPremium) + ' overtime premium)' : '') + '.', '');

    h += '<div style="margin-top:14px">' +
      (g.finished
        ? '<button class="btn primary" id="btn-debrief" style="width:100%;padding:11px">See the debrief</button>'
        : '<button class="btn primary" id="btn-next" style="width:100%;padding:11px">Start week ' + (g.week) + '</button>') +
      '</div>';

    document.getElementById('meeting-body').innerHTML = h;
    var nb = document.getElementById('btn-next');
    if (nb) nb.onclick = function () { resetPending(); phase = 'news'; renderAll(); };
    var db = document.getElementById('btn-debrief');
    if (db) db.onclick = showDebrief;

    function line(ic, txt, cls) {
      return '<div class="report-line ' + cls + '"><span class="ic">' + ic + '</span><span>' + txt + '</span></div>';
    }
  }

  /* =================================================================
     DEBRIEF
     ================================================================= */
  /* Two shapes. Mid-game (Stage 4's "Open the debrief" button, reachable
     from the first commit) it prints the calls table so far under an
     in-progress header and WRITES NOTHING — every final figure below
     (profit, completion date, days against contract) is undefined until
     Game.finish() has run, and a leaderboard row recorded here would be
     the null row cleanLeaderboard() exists to remove. At finish it records
     the score once and prints the full scoresheet. */
  function showDebrief() {
    if (!g.finished) {
      var contractWeeks = Math.ceil(g.net.contractWorkingDays / 5);
      document.getElementById('debrief-body').innerHTML =
        '<h3>Result</h3>' +
        '<p class="debrief-progress">Week <b>' + g.week + '</b> of a ' + contractWeeks +
        '-week contract is still open. Final profit, the completion date and the leaderboard row are ' +
        'recorded when the last activity finishes — <b>the full debrief is available at finish</b>. ' +
        'The calls so far are below; the roll on each one is already fixed by the seed.</p>' +
        '<h3>The calls you made</h3>' + callsTable();
      document.getElementById('debrief-head-sub').textContent =
        g.teamName + ' · seed ' + g.seed + ' · week ' + g.week + ' in progress';
      openSheet('debrief-sheet');
      return;
    }

    var lb = (store('to.leaderboard') || []).filter(isScoreRow);
    var entryId = g.seed + '|' + g.teamName + '|' + lb.length;
    if (!g._recorded) {
      g._recorded = true;
      lb.push({
        id: entryId, team: g.teamName, seed: g.seed, profit: Math.round(g.profit),
        finish: U.fmtShortDate(g.net.startDate, g.finishWorkingDay),
        late: g.lateCalendarDays, project: g.net.id
      });
      store('to.leaderboard', lb);
      g._entryId = entryId;
    }

    var m = g.money;
    var items = [
      ['Contract value', g.net.contractValue],
      ['Change orders', m.changeOrders],
      ['Subcontract buyout', -m.buyout],
      ['Crew labour (worked)', -(m.labor - (m.idle || 0))],
      ['Idle crew time', -(m.idle || 0)],
      ['General conditions', -m.gc],
      ['Event costs', -m.events],
      ['Expedite fees', -m.expedite],
      ['Crew mobilisation', -m.hiring],
      ['Liquidated damages', -m.ld],
      ['Line-of-credit interest', -m.financing],
      ['Early completion bonus', m.bonus]
    ].filter(function (x) { return Math.abs(x[1]) > 0.5; });
    var maxAbs = Math.max.apply(null, items.map(function (x) { return Math.abs(x[1]); }));

    var wf = items.map(function (x) {
      var w = Math.abs(x[1]) / maxAbs * 100;
      return '<div class="wf-row"><span class="k">' + x[0] + '</span>' +
        '<span class="bar-wrap"><span class="bar ' + (x[1] >= 0 ? 'pos' : 'neg') + '" style="left:0;width:' + w + '%"></span></span>' +
        '<span class="v">' + U.money(x[1]) + '</span></div>';
    }).join('');

    /* decision timeline */
    var tl = g.history.map(function (r) {
      var bits = [];
      var otOn = Object.keys(r.ot).filter(function (t) { return r.ot[t] > 0; });
      if (otOn.length) bits.push('overtime: ' + otOn.map(function (t) {
        return TRADES[t].name + ' ' + TO.Model.OT[r.ot[t]].hours + 'h';
      }).join(', '));
      var extra = Object.keys(r.crews).filter(function (t) { return r.crews[t] > 1; });
      if (extra.length) bits.push('extra crews: ' + extra.map(function (t) { return TRADES[t].name + ' ×' + r.crews[t]; }).join(', '));
      if (r.expediteNotes.length) bits.push('expedited');
      if (r.pourThrough) bits.push('worked through the weather');
      (r.callNotes || []).forEach(function (n) {
        if (/^Called it: /.test(n.text)) bits.push(n.text.replace(/^Called it: /, ''));
      });
      var stacked = Object.keys(r.stackedZones);
      if (stacked.length) bits.push('STACKED ' + stacked.join(', '));
      var cons = [];
      if (r.chainChanged) cons.push(r.movedTo ? 'critical path moved to ' + r.movedTo : 'critical path changed shape');
      if (r.rainDays) cons.push(r.rainDays + ' rain day(s)');
      var idleDays = Object.keys(r.idleCrewDays).reduce(function (s, t) { return s + r.idleCrewDays[t]; }, 0);
      if (idleDays) cons.push(idleDays + ' idle crew-days (' + U.money(r.idleCost) + ')');
      cons.push('finish projection ' + U.fmtShortDate(g.net.startDate, r.projectEnd));
      return '<div class="tl-item' + (r.chainChanged ? ' cp' : '') + '">' +
        '<span class="w">WK ' + r.week + '</span>' +
        (bits.length ? bits.join(' · ') : 'no intervention — absorbed it') +
        '<span class="cons">' + cons.join(' · ') + '</span></div>';
    }).join('');

    /* critical path movement chart */
    var chart = cpChart();

    var lateTxt = g.lateCalendarDays > 0 ? g.lateCalendarDays + ' calendar days late'
      : (g.lateCalendarDays < 0 ? Math.abs(g.lateCalendarDays) + ' days early' : 'exactly on the contract date');
    var bProfit = baseline ? baseline.profit : 0;
    var bLate = baseline ? baseline.lateCalendarDays : 0;
    var diff = g.profit - bProfit;

    var html =
      unsafeBlock() +
      '<h3>Result</h3>' +
      '<div class="big-score">' +
        '<div><div class="lab">Final profit</div><div class="n ' + (g.profit >= 0 ? 'good' : 'bad') + '">' + U.money(g.profit) + '</div></div>' +
        '<div><div class="lab">Completed</div><div class="n" style="font-size:1.5rem">' + U.fmtDate(g.net.startDate, g.finishWorkingDay) + '</div></div>' +
        '<div><div class="lab">Against contract</div><div class="n" style="font-size:1.5rem;color:' +
          (g.lateCalendarDays > 0 ? 'var(--red)' : 'var(--green)') + '">' + lateTxt + '</div></div>' +
        '<div><div class="lab">Weeks run</div><div class="n" style="font-size:1.5rem">' + g.history.length + '</div></div>' +
      '</div>' +

      '<h3>Where every dollar went</h3><div class="waterfall">' + wf + '</div>' +

      '<h3>Against the no-intervention baseline</h3>' +
      '<p style="font-size:.88rem;line-height:1.5;margin:0 0 10px">The baseline is the same seed, the same events, one crew per trade, ' +
      'straight time, never expedited — the schedule managed by simply letting it happen.</p>' +
      '<table class="lb cmp-table"><thead><tr><th></th><th>Baseline</th><th>Your run</th><th>Difference</th></tr></thead><tbody>' +
        cmpRow('Profit', U.money(bProfit), U.money(g.profit), (diff >= 0 ? '+' : '') + U.money(diff), diff >= 0) +
        cmpRow('Days vs contract', bLate + 'd', g.lateCalendarDays + 'd',
          (g.lateCalendarDays - bLate >= 0 ? '+' : '') + (g.lateCalendarDays - bLate) + 'd', g.lateCalendarDays <= bLate) +
        cmpRow('Weeks run', baseline.weeks, g.history.length,
          (g.history.length - baseline.weeks >= 0 ? '+' : '') + (g.history.length - baseline.weeks), g.history.length <= baseline.weeks) +
      '</tbody></table>' +

      (g.cashCfg ? '<h3>Cash: the valley you financed</h3>' + cashChart() : '') +
      '<h3>How the critical path moved</h3>' + chart +

      '<h3>The calls you made</h3>' + callsTable() +
      '<h3>Your decisions, week by week</h3><div class="timeline">' + tl + '</div>' +

      '<h3>Leaderboard</h3>' + leaderboardHTML(
        (store('to.leaderboard') || []).filter(function (e) { return e.seed === g.seed; }), g._entryId, false);

    document.getElementById('debrief-body').innerHTML = html;
    document.getElementById('debrief-head-sub').textContent =
      g.teamName + ' · seed ' + g.seed + ' · ' + g.net.name;
    openSheet('debrief-sheet');

    function cmpRow(k, a, b, d, good) {
      return '<tr><td>' + k + '</td><td class="num">' + a + '</td><td class="num">' + b +
        '</td><td class="num ' + (good ? 'win' : 'lose') + '">' + d + '</td></tr>';
    }
  }

  /* This block prints whether or not the gamble paid. A wall that did
     not fall does not make it a defensible decision, and the one thing
     a construction management course cannot afford to teach by accident
     is that schedule pressure justifies it. */
  function unsafeBlock() {
    var u = g.unsafeChoices || [];
    if (!u.length) return '';
    return '<div class="unsafe-block">' +
      '<h3 class="unsafe-h">⚠ Stop — read this before you look at the score</h3>' +
      u.map(function (e) {
        return '<div class="unsafe-item">' +
          '<div class="ui-ttl">Week ' + e.week + ' · ' + esc(e.title) + '</div>' +
          '<div class="ui-opt">You chose: <b>' + esc(e.option) + '</b> — ' +
            (e.failed === false
              ? 'and it held. That is the most dangerous possible outcome, because it teaches you it was fine.'
              : 'and it went exactly the way it goes.') + '</div>' +
          '<div class="ui-why">' + esc(e.unsafeWhy) + '</div></div>';
      }).join('') +
      '<p class="ui-foot">No schedule is worth this, and no profit on this screen is worth this. ' +
      'On a real job the person who authorised it is named in the citation and in the lawsuit, ' +
      'and somebody\'s family gets a phone call. If this run scored well, it scored well anyway — ' +
      'that is the point of printing it above the number.</p></div>';
  }

  /* Every team on a seed faced the same roll on every call. What
     differed is the threshold they bought. Showing roll against risk
     is the only way to tell a good decision from a lucky one, which is
     the single most useful thing in the debrief. */
  function callsTable() {
    if (!g.callLog.length) return '<p style="font-size:.88rem">No calls were reached this run.</p>';
    var rows = g.callLog.map(function (e) {
      var verdict, cls;
      if (e.procurement) { verdict = e.option; cls = ''; }
      else if (e.unsafe) {
        verdict = e.failed ? '⚠ Unsafe — and it went wrong' : '⚠ Unsafe — and you got away with it';
        cls = 'unsafe-cell';
      }
      else if (e.failed) {
        verdict = e.risk >= 0.3 ? 'Went against you — and you were exposed' : 'Unlucky: you covered it and it still bit';
        cls = 'bad';
      } else if (e.risk >= 0.3) { verdict = 'Got away with it'; cls = 'lucky'; }
      else { verdict = 'Covered — never in doubt'; cls = 'good'; }
      return '<tr><td class="num">wk ' + e.week + '</td>' +
        '<td>' + esc(e.title) + '</td>' +
        '<td>' + esc(e.option) + '</td>' +
        '<td class="num">' + (e.cost ? U.money(e.cost) : '—') + '</td>' +
        '<td class="num">' + (e.procurement ? '—' : Math.round(e.risk * 100) + '%') + '</td>' +
        '<td class="num">' + (e.procurement ? '—' : e.roll.toFixed(2)) + '</td>' +
        '<td class="' + cls + '">' + verdict + '</td></tr>';
    }).join('');
    var gotAway = g.callLog.filter(function (e) { return !e.procurement && !e.failed && e.risk >= 0.3; }).length;
    var bit = g.callLog.filter(function (e) { return e.failed; }).length;
    return '<table class="lb calls-table"><thead><tr><th>Week</th><th>Call</th><th>You chose</th>' +
      '<th>Cost</th><th>Exposure</th><th>The roll</th><th>Outcome</th></tr></thead><tbody>' + rows +
      '</tbody></table>' +
      '<p class="call-verdict">Every team on seed <b>' + esc(g.seed) + '</b> faced these exact rolls. ' +
      'The column that separates the teams is <i>exposure</i> — the threshold you bought. ' +
      (gotAway ? 'You left yourself exposed on ' + gotAway + ' call' + (gotAway === 1 ? '' : 's') +
        ' and the roll went your way; that is luck, not judgment, and it will not hold next time. ' : '') +
      (bit ? bit + ' call' + (bit === 1 ? '' : 's') + ' came back on you. ' : '') +
      'A good decision can still have a bad outcome. Grade the decision.</p>';
  }

  /* The classic cash valley: costs go out weekly, the owner pays
     monthly and a month behind, and the gap is what the line of
     credit carried. The deepest point is the number a surety and a
     banker both ask about. */
  function cashChart() {
    var hist = g.cashHistory;
    if (!hist || hist.length < 3) return '<p>Not enough weeks to chart.</p>';
    var W = 860, H = 190, PADL = 58, PADB = 24, PADT = 10;
    var lo = Math.min.apply(null, hist.map(function (h) { return h.cash; }));
    var hi = Math.max.apply(null, hist.map(function (h) { return h.cash; }));
    lo = Math.min(lo, 0); hi = Math.max(hi, 0);
    var x = function (i) { return PADL + i * (W - PADL - 10) / Math.max(1, hist.length - 1); };
    var y = function (v) { return PADT + (hi - v) * (H - PADT - PADB) / Math.max(1, hi - lo); };
    var pts = hist.map(function (h, i) { return x(i) + ',' + y(h.cash); }).join(' ');
    var out = '<svg id="cash-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
    /* red below the waterline */
    out += '<rect x="' + PADL + '" y="' + y(0) + '" width="' + (W - PADL - 10) + '" height="' +
      Math.max(0, H - PADB - y(0)) + '" fill="#b3261e" opacity="0.07"/>';
    out += '<line x1="' + PADL + '" y1="' + y(0) + '" x2="' + (W - 10) + '" y2="' + y(0) +
      '" stroke="#77839a" stroke-width="1"/>';
    out += '<polygon points="' + x(0) + ',' + y(0) + ' ' + pts + ' ' + x(hist.length - 1) + ',' + y(0) +
      '" fill="#002144" opacity="0.10"/>';
    out += '<polyline points="' + pts + '" fill="none" stroke="#002144" stroke-width="2"/>';
    /* mark the bottom of the valley */
    var minI = 0;
    hist.forEach(function (h, i) { if (h.cash < hist[minI].cash) minI = i; });
    out += '<circle cx="' + x(minI) + '" cy="' + y(hist[minI].cash) + '" r="4.5" fill="#b3261e"/>';
    out += '<text x="' + Math.min(x(minI) + 8, W - 180) + '" y="' + (y(hist[minI].cash) - 8) +
      '" font-size="10" font-family="monospace" fill="#b3261e">valley: ' + U.money(hist[minI].cash) + '</text>';
    out += '<text x="6" y="' + (y(hi) + 8) + '" font-size="9" font-family="monospace" fill="#77839a">' + U.money(hi) + '</text>';
    out += '<text x="6" y="' + y(lo) + '" font-size="9" font-family="monospace" fill="#77839a">' + U.money(lo) + '</text>';
    out += '</svg>' +
      '<p style="font-size:.8rem;color:var(--ink-3);margin:4px 0 0">Costs go out weekly; the owner pays ' +
      'monthly, a month behind the work, holding 5% to the end. The shaded dip is what your line of credit carried — ' +
      'it cost ' + U.money(g.money.financing) + ' in interest, and the red dot is the week the job needed the most ' +
      'of somebody else\'s money.</p>';
    return out;
  }

  /* Critical path movement: which activity was driving the finish each
     week, and what the projected completion was. */
  function cpChart() {
    var hist = g.cpHistory;
    if (hist.length < 2) return '<p>Not enough weeks to chart.</p>';
    var W = 860, H = 190, PADL = 46, PADB = 26, PADT = 12;
    var ends = hist.map(function (h) { return h.projectEnd; });
    var lo = Math.min.apply(null, ends.concat([g.net.contractWorkingDays])) - 3;
    var hi = Math.max.apply(null, ends.concat([g.net.contractWorkingDays])) + 3;
    var x = function (i) { return PADL + i * (W - PADL - 10) / Math.max(1, hist.length - 1); };
    var y = function (v) { return PADT + (hi - v) * (H - PADT - PADB) / Math.max(1, hi - lo); };

    var pts = hist.map(function (h, i) { return x(i) + ',' + y(h.projectEnd); }).join(' ');
    var s = '<svg id="cp-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
    s += '<line x1="' + PADL + '" y1="' + y(g.net.contractWorkingDays) + '" x2="' + (W - 10) +
      '" y2="' + y(g.net.contractWorkingDays) + '" stroke="#b3261e" stroke-width="1.5" stroke-dasharray="5 4"/>';
    s += '<text x="' + (PADL + 4) + '" y="' + (y(g.net.contractWorkingDays) - 4) +
      '" font-size="10" font-family="monospace" fill="#b3261e">CONTRACT COMPLETION</text>';
    s += '<polyline points="' + pts + '" fill="none" stroke="#1f4e79" stroke-width="2"/>';

    var lastDriver = null;
    hist.forEach(function (h, i) {
      /* the activity in the middle of the driving chain is a stable
         label for "what this path runs through"; on the final week the
         chain is empty, and an empty chain has no label */
      var driver = h.chain.length ? h.chain[Math.floor(h.chain.length / 2)] : null;
      var moved = lastDriver && driver && driver !== lastDriver;
      s += '<circle cx="' + x(i) + '" cy="' + y(h.projectEnd) + '" r="' + (moved ? 4.5 : 2.6) +
        '" fill="' + (moved ? '#b3261e' : '#1f4e79') + '"/>';
      if (moved) {
        s += '<text x="' + x(i) + '" y="' + (y(h.projectEnd) - 9) + '" font-size="9" font-family="monospace" ' +
          'fill="#b3261e" text-anchor="middle">' + driver + '</text>';
      }
      if (driver) lastDriver = driver;
    });
    for (var i2 = 0; i2 < hist.length; i2 += Math.ceil(hist.length / 12)) {
      s += '<text x="' + x(i2) + '" y="' + (H - 8) + '" font-size="9" font-family="monospace" fill="#77839a" text-anchor="middle">wk' + hist[i2].week + '</text>';
    }
    s += '<text x="4" y="' + y(hi - 1) + '" font-size="9" font-family="monospace" fill="#77839a">' + hi + ' wd</text>';
    s += '<text x="4" y="' + y(lo + 1) + '" font-size="9" font-family="monospace" fill="#77839a">' + lo + ' wd</text>';
    s += '</svg>' +
      '<p style="font-size:.8rem;color:var(--ink-3);margin:4px 0 0">Blue line: projected completion, recomputed every week. ' +
      'Red dots mark the weeks the driving activity changed — those are the weeks the critical path moved under you.</p>';
    return s;
  }

  /* =================================================================
     SELF TEST
     ================================================================= */
  function showSelfTest() {
    var D = {
      TRADES: TRADES, ZONES: ZONES, MAIN_NETWORK: MAIN_NETWORK,
      TUTORIAL_NETWORK: TUTORIAL_NETWORK, TUTORIAL_EXPECTED_CPM: TUTORIAL_EXPECTED_CPM,
      EVENT_DECK: EVENT_DECK, CALLS: CALLS
    };
    var rep = TO.runSelfTests(D);
    document.getElementById('selftest-body').innerHTML = rep.results.map(function (r) {
      return '<div class="t ' + (r.pass ? 'p' : 'f') + '">' + esc(r.name) + '</div>' +
        (r.pass ? '' : '<div class="d">' + esc(r.detail) + '</div>');
    }).join('');
    document.getElementById('selftest-sum').textContent =
      rep.passed + ' passed, ' + rep.failed + ' failed, ' + rep.total + ' total';
    document.getElementById('selftest-sum').style.color = rep.failed ? 'var(--red)' : 'var(--green)';
    openSheet('selftest-sheet');
  }

  /* ---------- Reset: the demo half of the kit's in-place contract ---
     The shell restores what the kit named — the stage tabs and their
     `disabled` gates, the A6 check answers, the A2 prediction echoes, the
     A4 cue, the Details drawer, the selected stage — from a snapshot taken
     before this file ran, then dispatches `lessonreset`. It cannot know what
     the activity holds. This is that part.

     ENUMERATED BEFORE IT WAS WRITTEN, per ADOPTING.md §4, because in-place
     reset is correct only if the list is complete and the failure mode is
     quiet. Walking the module's own closed-over state:

       g               the game            -> null
       baseline        the no-intervention run for the debrief -> null
       lastProjection  the previous week's projection, or week 1 of the
                       next game shows a delta against the last week of
                       the game before it -> null
       pending         { crews, ot, alloc, expedite } -> null
       animating       the week-runs animation guard -> false
       phase           news | report | done -> 'news'
       view            4d | gantt | network -> '4d'
       setupState      team, seed, project, difficulty -> fresh object
       toast._t        a pending toast timeout -> cleared, or a stale
                       "Reset" message fires over the fresh sheet
       memStore        the localStorage fallback cache. NOT cleared: it
                       backs the leaderboard and the presentation
                       preference, both of which survive a reload and are
                       therefore not demo state.

     DOM this file generated or toggled:
       #app / #setup   the hidden/shown pair -> back to setup
       #view-host      innerHTML from the renderers -> emptied, so a stale
                       Gantt cannot flash before the next render
       #project-block, #hud, #meeting-{head,body,foot} -> emptied
       body.m-site and the #m-nav button classes -> back to MEETING
       #board-host     MOVED between stage slots by the stagechange handler
                       -> moved back to stage 1's slot (ADOPTING.md §4
                       step 6 names exactly this case)
       the two <dialog>s -> the shell already closed them in step 2

     Two things deliberately survive, because they survive a reload too and
     so are not demo state: Presentation mode (a display preference for the
     room, and the shell leaves it alone by design) and the leaderboard,
     which holds earlier sections' scores and has its own control. */
  function resetActivity() {
    g = null;
    baseline = null;
    lastProjection = null;
    pending = null;
    animating = false;
    phase = 'news';
    view = '4d';
    lastCriticalKey = null;
    clearTimeout(toast._t);

    var setEmpty = function (id) { var el = document.getElementById(id); if (el) el.innerHTML = ''; };
    ['view-host', 'project-block', 'hud', 'meeting-head', 'meeting-body', 'meeting-foot',
     'debrief-body', 'selftest-body', 'selftest-sum'].forEach(setEmpty);

    var cue = document.getElementById('cue-board');
    if (cue) cue.textContent = '';

    document.body.classList.remove('m-site');
    var ms = document.getElementById('m-site'), mm = document.getElementById('m-meet');
    if (ms) ms.classList.remove('on');
    if (mm) mm.classList.add('on');

    /* The view tab strip is markup, not generated, so its `active` class is
       the demo's to put back. */
    var vt = document.getElementById('view-tabs');
    if (vt) Array.prototype.forEach.call(vt.querySelectorAll('button[data-view]'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === '4d');
    });

    document.getElementById('app').hidden = true;
    document.getElementById('setup').hidden = false;
    setupState = { team: '', seed: '', project: 'tutorial', difficulty: 'standard' };
    renderSetup();
    moveBoardTo(0);
  }

  /* =================================================================
     THE LESSON — four stages around one activity
     =================================================================

     There is exactly ONE board (#board-host). The four stages are lesson
     framings of the same continuous game, so the board is MOVED between
     their .board-slot elements rather than duplicated. See the structural
     note at the top of src/template.html.
     ================================================================= */

  var STAGE_COUNT = 4;

  function moveBoardTo(index) {
    var host = document.getElementById('board-host');
    var slot = document.querySelector('.board-slot[data-slot="' + index + '"]');
    if (!host || !slot || host.parentNode === slot) return;
    slot.appendChild(host);
  }

  /* ---------- the gates -------------------------------------------
     Genuine prerequisites, not artificial locks: there is no week to run
     before there is a schedule, and nothing to debrief before a decision
     has run. `disabled` is authored in template.html as well, because the
     shell snapshots tab state BEFORE this file runs — a gate applied only
     here would come back unlocked after a Reset. */
  function unlockStage(index, why) {
    var tab = document.getElementById('tab-' + (index + 1));
    if (!tab || !tab.disabled) return;
    tab.disabled = false;
    if (why) tab.setAttribute('title', why);
    else tab.removeAttribute('title');
  }

  /* ---------- A4 the observation cue ------------------------------
     One aria-live line naming the thing to notice AT THE MOMENT it becomes
     true. The week the critical path moves is the one that matters most, so
     it gets said rather than left for the learner to spot in a bar chart. */
  function cue(text) {
    var el = document.getElementById('cue-board');
    if (el) el.textContent = text || '';
  }

  /* ---------- A2 prediction capture ------------------------------
     Plan §A2: "where the activity can capture the prediction it must — the
     prediction is then echoed beside the observed result". All four stages
     capture one; stage 2's is the demo's signature, because the engine
     recomputes the critical path anyway and can therefore mark the
     prediction right or wrong without being asked to judge anything.

     The echo is a kit-owned node (.echo inside .lesson-strip), which is why
     Reset restores it from the shell's snapshot and this file does not have
     to. */
  var predicted = { 0: null, 1: null, 2: null, 3: null };

  function echoFor(stage) {
    var strip = document.querySelector('#stage-' + (stage + 1) + ' .lesson-strip .echo');
    return strip || null;
  }

  function showEcho(stage, html) {
    var e = echoFor(stage);
    if (!e) return;
    e.innerHTML = html;
    e.hidden = false;
  }

  /* Stage 1 — a number: how many working days of cushion does the job have
     against its contract? The engine knows the answer exactly. */
  function predictCushionUI() {
    var slot = document.getElementById('predict-1');
    if (!slot || slot.dataset.built) return;
    slot.dataset.built = '1';
    slot.innerHTML =
      '<label class="control-label" for="pred-cushion">Working days of cushion' +
        '<span class="why">Your guess at contract days minus the unimpeded schedule. Recording it is what makes the next screen worth reading.</span>' +
      '</label>' +
      '<span class="predict-row">' +
        '<input type="number" id="pred-cushion" min="0" max="200" step="1" inputmode="numeric" aria-describedby="pred-cushion-h">' +
        '<button class="btn ghost" type="button" id="pred-cushion-go">Record it</button>' +
      '</span>';
    document.getElementById('pred-cushion-go').onclick = function () {
      var v = Number(document.getElementById('pred-cushion').value);
      if (!isFinite(v) || v <= 0) { toast('Put a number of working days in first.'); return; }
      predicted[0] = v;
      showEcho(0, '<b>You said</b> ' + v + ' working days.' +
        (g ? '' : ' Start the job and the schedule will answer.'));
      if (g) answerCushion();
    };
  }

  function answerCushion() {
    if (!g || predicted[0] == null) return;
    var cpm = g.computeCPM(null, null);
    var actual = g.net.contractWorkingDays - cpm.projectEnd;
    showEcho(0, '<b>You said</b> ' + predicted[0] + ' working days &middot; ' +
      '<b>the schedule says</b> ' + actual + ' (' + cpm.projectEnd + ' working days against a ' +
      g.net.contractWorkingDays + '-day contract).');
  }

  /* Stage 2 — THE signature prediction: which activity is critical after
     this week? Offered as a select of the activities that are actually in
     play, so it is answerable rather than a guessing game, and judged
     against the recomputed critical set after Commit. */
  function predictCriticalUI() {
    var slot = document.getElementById('predict-2');
    if (!slot) return;
    if (!g) { slot.innerHTML = ''; delete slot.dataset.built; return; }
    var cpm = g.computeCPM(pending ? pending.alloc : null, pending ? pending.ot : null);
    /* Unfinished work only. `state[id].finishDay === null` is the engine's
       own test for "not complete" — openActivities() uses the same one. An
       activity already in the ground cannot become critical. */
    var open = g.net.activities.filter(function (a) {
      var s = g.state[a.id];
      return cpm.results[a.id] && s && s.finishDay === null;
    });
    if (!open.length) { slot.innerHTML = ''; return; }
    slot.innerHTML =
      '<label class="control-label" for="pred-crit">Which activity is critical after this week?' +
        '<span class="why">Pick before you commit. The engine re-solves the network afterwards, so this is a real prediction with a real answer.</span>' +
      '</label>' +
      '<span class="predict-row">' +
        '<select id="pred-crit"><option value="">choose an activity&hellip;</option>' +
        open.map(function (a) {
          return '<option value="' + esc(a.id) + '">' + esc(a.id) + ' &mdash; ' + esc(a.name) + '</option>';
        }).join('') +
        '</select>' +
        '<button class="btn ghost" type="button" id="pred-crit-go">Record it</button>' +
      '</span>';
    document.getElementById('pred-crit-go').onclick = function () {
      var v = document.getElementById('pred-crit').value;
      if (!v) { toast('Pick an activity first.'); return; }
      predicted[1] = v;
      showEcho(1, '<b>You said</b> ' + esc(v) + ' will be critical. Commit the week to find out.');
    };
  }

  function answerCritical() {
    if (!g || predicted[1] == null) return;
    var cpm = g.computeCPM(null, null);
    var crit = cpm.criticalIds || [];
    var hit = crit.indexOf(predicted[1]) !== -1;
    showEcho(1, '<b>You said</b> ' + esc(predicted[1]) + ' &middot; ' +
      '<b>the engine says</b> ' + (crit.length ? esc(crit.slice(0, 4).join(', ')) : 'nothing left') +
      (crit.length > 4 ? '&hellip;' : '') + ' &mdash; ' +
      (hit ? 'you had it.' : 'not on the path this week.'));
  }

  /* Stage 3 — what did you think the free option was worth? Captured as a
     dollar figure so it can be put beside the priced exposure. */
  function predictCallUI() {
    var slot = document.getElementById('predict-3');
    if (!slot || slot.dataset.built) return;
    slot.dataset.built = '1';
    slot.innerHTML =
      '<label class="control-label" for="pred-call">What do you think the free option costs you? ($)' +
        '<span class="why">Exposure times the delay, priced at where the float is right now. Write it down before you choose, then argue with the debrief.</span>' +
      '</label>' +
      '<span class="predict-row">' +
        '<input type="number" id="pred-call" min="0" step="100" inputmode="numeric">' +
        '<button class="btn ghost" type="button" id="pred-call-go">Record it</button>' +
      '</span>';
    document.getElementById('pred-call-go').onclick = function () {
      var v = Number(document.getElementById('pred-call').value);
      if (!isFinite(v) || v < 0) { toast('Put a dollar figure in first.'); return; }
      predicted[2] = v;
      showEcho(2, '<b>You said</b> ' + U.money(v) + '. The debrief prints what it actually cost.');
    };
  }

  /* Stage 4 — covered, or got away with it? Judged against the run's own
     calls log. */
  function predictDebriefUI() {
    var slot = document.getElementById('predict-4');
    if (!slot || slot.dataset.built) return;
    slot.dataset.built = '1';
    slot.innerHTML =
      '<span class="control-label">How will your calls table read?' +
        '<span class="why">Commit to an answer before you open it. This is the same habit the debrief is grading.</span>' +
      '</span>' +
      '<span class="predict-row">' +
        '<button class="btn ghost" type="button" data-pred4="covered">Mostly covered</button>' +
        '<button class="btn ghost" type="button" data-pred4="lucky">Mostly got away with it</button>' +
      '</span>';
    Array.prototype.forEach.call(slot.querySelectorAll('[data-pred4]'), function (b) {
      b.onclick = function () {
        predicted[3] = b.getAttribute('data-pred4');
        Array.prototype.forEach.call(slot.querySelectorAll('[data-pred4]'), function (o) {
          o.setAttribute('aria-pressed', String(o === b));
        });
        showEcho(3, '<b>You said</b> mostly ' +
          (predicted[3] === 'covered' ? '&ldquo;covered&rdquo;' : '&ldquo;got away with it&rdquo;') +
          '. Open the debrief and count.');
      };
    });
  }

  function buildStage(index) {
    if (index === 0) predictCushionUI();
    else if (index === 1) predictCriticalUI();
    else if (index === 2) predictCallUI();
    else if (index === 3) predictDebriefUI();
  }

  /* =================================================================
     BOOT
     ================================================================= */
  function init() {
    initTooltips();
    /* The shell sets body.presenter; this mirrors it onto the demo's own
       `big` class for the activity rules, and re-renders. The stored
       preference is read here because the shell has no persistence. */
    if (store('to.big')) {
      if (window.lessonShell) window.lessonShell.setPresentation(true);
      else document.body.classList.add('big');
    }
    document.addEventListener('presentationchange', function (e) {
      applyPresentation(e.detail && e.detail.on);
    });

    setupState.seed = '';
    cleanLeaderboard();
    renderSetup();
    moveBoardTo(0);
    buildStage(0);

    /* The Guide opens on load — the shell does that now, and deliberately
       does NOT reopen it after a Reset (ADOPTING.md §4). */

    /* ---- the shell's two events --------------------------------------
       `stagechange` is a CHROME event and nothing here renders activity
       state from it. That restraint is required, not stylistic: the shell
       fires stagechange from inside its reset, BEFORE `lessonreset`, so a
       handler that re-rendered the game would resurrect the pre-reset state
       into freshly reset chrome. missing-time shipped exactly that bug.
       Moving the board and building the stage's own prediction widget are
       both safe because neither reads game state that reset has not yet
       cleared — and `predictCriticalUI` explicitly clears itself when `g`
       is null, which is what it is during a reset. */
    document.addEventListener('stagechange', function (e) {
      var i = e.detail ? e.detail.index : 0;
      moveBoardTo(i);
      buildStage(i);
      /* The Gantt and network renderers measure their host, so a stage
         change has to re-measure. The 4D view draws to a fixed box. */
      if (g && !animating && view !== '4d') {
        renderView(g.computeCPM(pending ? pending.alloc : null, pending ? pending.ot : null));
      }
    });

    /* Reset. `onReset` is the shell's veto path and the right home for the
       mid-run confirmation: returning false cancels the WHOLE reset, so
       there is exactly one place that can refuse it and no way to end up
       half-reset. From the setup sheet there is nothing to lose, so it
       just runs. */
    if (window.lessonShell) {
      window.lessonShell.onReset = function () {
        if (g && !window.confirm('Reset? The run in progress is lost.')) return false;
        return true;
      };
    }
    document.addEventListener('lessonreset', function () {
      resetActivity();
      predicted = { 0: null, 1: null, 2: null, 3: null };
      /* The prediction widgets are regenerated rather than restored: each
         carries a dataset.built guard, so the guard has to be dropped too
         or buildStage(0) becomes a no-op and stage 1 comes back empty. */
      [1, 2, 3, 4].forEach(function (n) {
        var s = document.getElementById('predict-' + n);
        if (s) { s.innerHTML = ''; delete s.dataset.built; }
      });
      buildStage(0);
      toast('Reset — back to the setup sheet.');
    });

    /* mobile tab bar: SITE shows the drawings, MEETING shows the loop.
       During the week animation we flip to the site so the player sees
       their week happen, then flip back for the report. */
    function mSet(which) {
      document.body.classList.toggle('m-site', which === 'site');
      document.getElementById('m-site').classList.toggle('on', which === 'site');
      document.getElementById('m-meet').classList.toggle('on', which !== 'site');
    }
    TO.App._mSet = mSet;
    document.getElementById('m-site').onclick = function () { mSet('site'); };
    document.getElementById('m-meet').onclick = function () { mSet('meet'); };

    document.getElementById('view-tabs').onclick = function (e) {
      var b = e.target.closest('button[data-view]');
      if (!b || animating || !g) return;
      view = b.getAttribute('data-view');
      renderView(g.computeCPM(pending ? pending.alloc : null, pending ? pending.ot : null));
    };

    /* Settings' demo-specific controls. The contract triad above them —
       Open Presenter Notes, Presentation mode, Reset — is the shell's. */
    document.getElementById('btn-selftest').onclick = function () {
      closeSheet('settings');
      showSelfTest();
    };
    document.getElementById('btn-lb-clear').onclick = clearLeaderboard;

    /* ---- A6: repair the kit's leaked domain wording -------------------
       lesson-shell v2's check-card handler hardcodes the wrong-answer prefix
       as "Not what the detector showed." — ion-flight's noun, in every demo
       that adopts the kit. There is no detector in a construction schedule,
       and a learner reading it in this demo is being told about a machine
       that does not exist.

       THE KIT IS FROZEN, so this is repaired demo-side rather than upstream,
       and it is reported in the lane's friction list for kit v3. The kit
       registers its own click listener while its script runs, which is
       before this file executes, so this listener fires AFTER it and gets the
       last word on the same node. Only the prefix is rewritten; the
       per-option feedback text is the demo's own and is left alone. */
    document.addEventListener('click', function (e) {
      var opt = e.target.closest && e.target.closest('.check-option');
      if (!opt) return;
      var card = opt.closest('.check');
      var out = card && card.querySelector('.check-feedback');
      if (!out) return;
      out.innerHTML = out.innerHTML.replace(
        '<b>Not what the detector showed.</b>',
        '<b>Not what the schedule showed.</b>'
      );
    });

    /* Stage 4's own control. Mid-run it shows the calls table so far, which
       is what the session guide tells a presenter to open the debrief on;
       the full scoresheet appears once the job finishes. */
    document.getElementById('btn-open-debrief').onclick = function () {
      if (!g) { toast('Start the job first — there is nothing to debrief yet.'); return; }
      showDebrief();
    };

    window.addEventListener('resize', function () {
      if (g && !animating && view !== '4d') renderView(g.computeCPM(pending ? pending.alloc : null, pending ? pending.ot : null));
    });
    /* Enter starts the job from the setup sheet. Escape is the shell's now
       (native <dialog> handles it), and the old topOverlay() guard is gone
       with it: `dialog:open` is the direct question. */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (document.querySelector('dialog[open]')) return;
      if (document.getElementById('setup').hidden) return;
      if (document.getElementById('stage-1').hidden) return;
      startGame();
    });
  }

  return {
    init: init,
    get game() { return g; },
    _lesson: {
      unlockStage: unlockStage, cue: cue, moveBoardTo: moveBoardTo,
      answerCushion: answerCushion, answerCritical: answerCritical,
      buildStage: buildStage, STAGE_COUNT: STAGE_COUNT
    }
  };
})();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', TO.App.init);
  else TO.App.init();
}
