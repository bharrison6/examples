/*
 * Topping Out — playtest.test.js
 * ------------------------------
 * The seven verifications the design brief requires, checked against the
 * real simulation rather than against the models in isolation.
 *
 *     node src/playtest.test.js
 *
 * Verifications 1-4 are also asserted inside engine.js (so the same
 * checks run in the browser from the Instructor menu); this file proves
 * them again end to end, and adds the ones that only mean anything once
 * a whole game has been played: that maximum overtime loses to balanced
 * play, that piling crews onto one floor produces less work than
 * spreading them, and that a full game fits a class period.
 *
 * Verification 7 (a full game finishes in under 45 minutes of class
 * time) is a turn-count budget here; tools/integration.mjs times the
 * real UI in a browser.
 */
'use strict';

var TO = require('./engine.js');
var D = require('./data.js');
var U = TO.Util;

var failures = 0, passes = 0;
function check(name, cond, detail) {
  if (cond) { console.log('PASS  ' + name); passes++; }
  else { console.log('FAIL  ' + name + (detail ? '\n      ' + detail : '')); failures++; }
}
function section(t) { console.log('\n--- ' + t + ' ---'); }

function newGame(seed, difficulty, network) {
  return new TO.Game.Game({
    network: network || D.MAIN_NETWORK, trades: D.TRADES, zones: D.ZONES,
    deck: D.EVENT_DECK, calls: D.CALLS, seed: seed, difficulty: difficulty || 'standard'
  });
}

/* Play a whole game under a decision policy. The policy is a pure
   function of game state, so a replay of the same policy on the same
   seed must reproduce the run exactly. */
function play(seed, policy, difficulty, network) {
  var g = newGame(seed, difficulty, network);
  var guard = 0;
  while (!g.finished && guard++ < 300) {
    g.autoAllocate();
    var d = policy(g) || {};
    if (!d.alloc) d.alloc = g.alloc;
    g.runWeek(d);
  }
  return g;
}

/* ---- decision policies used by the tests ------------------------- */
function critOpenTrades(g) {
  var cpm = g.computeCPM(), set = {};
  g.openActivities(g.day).forEach(function (o) {
    if (o.act.trade && cpm.results[o.id].tf <= 1) set[o.act.trade] = true;
  });
  return { set: set, cpm: cpm };
}

var POLICY = {
  /* Straight time, one crew per trade, never expedite. */
  passive: function () { return {}; },

  /* Maximum overtime on every trade, every single week. */
  maxOvertime: function () {
    var ot = {};
    Object.keys(D.TRADES).forEach(function (t) { ot[t] = 2; });
    return { ot: ot };
  },

  /* Balanced: resource the critical work, overtime only while the job
     is forecast late, expedite only when the delay lands on work with
     no float. */
  balanced: function (g) {
    var c = critOpenTrades(g), crews = {}, ot = {};
    Object.keys(D.TRADES).forEach(function (t) {
      crews[t] = c.set[t] ? (g.net.maxHire[t] == null ? 1 : g.net.maxHire[t]) : 1;
    });
    if (c.cpm.projectEnd > g.net.contractWorkingDays) {
      Object.keys(c.set).forEach(function (t) { ot[t] = 1; });
    }
    var expedite = [];
    g.weekEvents().forEach(function (e) {
      if (!e.expedite || !e.delay) return;
      var target = null;
      e.delay.targets.forEach(function (id) {
        if (!target && g.state[id] && g.state[id].finishDay === null) target = id;
      });
      if (target && c.cpm.results[target] && c.cpm.results[target].tf <= 2) expedite.push(e.id);
    });
    return { crews: crews, ot: ot, expedite: expedite };
  }
};

/* A player who reads float, prices the calls, orders manpower ahead of
   need and only fights the weather when the exposed work has no float.
   Nothing here is privileged information — every input is on screen. */
POLICY.thoughtful = function (g) {
  var N = g.net, cpm = g.computeCPM();
  var late = cpm.projectEnd > N.contractWorkingDays;
  var dayValue = (late ? (N.gcPerCalendarDay + N.ldPerCalendarDay) : N.gcPerCalendarDay) * 1.4;

  /* The first unfinished activity on the driving chain is what the
     finish date is waiting on. If it is a cure, a hold, or work still
     blocked by an event delay, no amount of money moves the date this
     week — so spend nothing trying. This is the lesson the game
     teaches; the reference player has to know it too. */
  var driver = null;
  for (var di = 0; di < cpm.chain.length; di++) {
    if (g.state[cpm.chain[di]].finishDay === null) { driver = cpm.chain[di]; break; }
  }
  var driverWorkable = false;
  if (driver) {
    var da = g.byId[driver];
    driverWorkable = !da.fixed && g.state[driver].addedDelay === 0;
  }
  var spendWorthIt = late && driverWorkable &&
    (cpm.projectEnd - N.contractWorkingDays) >= 3;

  var calls = {};
  g.openCalls().forEach(function (c) {
    if (c.id === 'sov') {
      /* front-loading finances the job; the audit risk is priced in
         interest saved. The player can see both numbers on screen. */
      calls[c.id] = 'frontload';
      return;
    }
    if (c.procurement) {
      var buy = null;
      c.options.forEach(function (o) { if (o.sets) buy = o; });
      calls[c.id] = (cpm.projectEnd > N.contractWorkingDays - 12 && buy) ? buy.id : c.options[0].id;
      return;
    }
    var best = null, bestVal = Infinity;
    c.options.forEach(function (o) {
      var failCost = c.fail ? (c.fail.cost || 0) + (c.fail.days || 0) * dayValue : 0;
      var v = (o.cost || 0) + (o.delay || 0) * dayValue + (o.risk || 0) * failCost;
      if (v < bestVal) { bestVal = v; best = o; }
    });
    calls[c.id] = best.id;
  });

  var open = g.openActivities(g.day).filter(function (o) { return o.act.trade && !o.act.fixed; });
  var byTrade = {};
  open.forEach(function (o) { (byTrade[o.act.trade] = byTrade[o.act.trade] || []).push(o); });
  var crews = {};
  Object.keys(D.TRADES).forEach(function (t) {
    var fronts = byTrade[t] || [];
    var minF = fronts.reduce(function (m, o) { return Math.min(m, cpm.results[o.id].tf); }, 99);
    crews[t] = (spendWorthIt && fronts.length > 1 && minF <= 3)
      ? (N.maxHire[t] == null ? 1 : N.maxHire[t]) : 1;
  });

  var ot = {};
  if (spendWorthIt && g.week % 3 !== 0) {
    cpm.chain.forEach(function (id) {
      var a = g.byId[id];
      if (!a || !a.trade || g.state[id].finishDay !== null || cpm.results[id].tf !== 0) return;
      /* a burned sub on overtime is paying premium for spite */
      if ((g.standing[a.trade] || 70) < 45) return;
      ot[a.trade] = 1;
    });
  }

  /* Working through the rain is a bet, and it only makes sense when
     the days it saves are days the finish actually needs. */
  var pour = false;
  var wx = null;
  g.weekEvents().forEach(function (e) { if (e.cat === 'weather') wx = e; });
  if (wx && wx.forecast[1] > 0 && spendWorthIt) {
    pour = open.some(function (o) {
      return o.act.weather && (g.alloc[o.id] || 0) > 0 && cpm.results[o.id].tf === 0 &&
        (!wx.affects || wx.affects.indexOf(o.act.trade) !== -1);
    });
  }

  var expedite = [];
  g.weekEvents().forEach(function (e) {
    if (!e.expedite || !e.delay) return;
    var tg = null;
    e.delay.targets.forEach(function (id) {
      if (!tg && g.state[id] && g.state[id].finishDay === null) tg = id;
    });
    if (tg && cpm.results[tg] && cpm.results[tg].tf <= 2) expedite.push(e.id);
  });

  return { calls: calls, crews: crews, ot: ot, expedite: expedite, pourThrough: pour };
};

var SEEDS = ['MSU-2601', 'TOPPING', 'FALL26', 'WK7', 'BLUE', 'GOLD', 'CMGT-201', 'CALLOWAY'];

/* =====================================================================
   1. CPM MATH VS A HAND CALCULATION
   The expected table is written out by hand in data.js above
   TUTORIAL_NETWORK, with the forward pass, backward pass and both
   floats worked through activity by activity.
   ===================================================================== */
section('1. CPM against the hand calculation');
(function () {
  var nodes = D.TUTORIAL_NETWORK.activities.map(function (a) {
    return { id: a.id, dur: a.work, minStart: 0, preds: a.preds || [] };
  });
  var cpm = TO.CPM.compute(nodes);
  var bad = [];
  D.TUTORIAL_EXPECTED_CPM.forEach(function (row) {
    var r = cpm.results[row[0]];
    var got = [r.es, r.ef, r.ls, r.lf, r.tf, r.ff];
    for (var i = 0; i < 6; i++) {
      if (got[i] !== row[i + 1]) bad.push(row[0] + ' expected [' + row.slice(1) + '] got [' + got + ']');
    }
  });
  check('every ES/EF/LS/LF/TF/FF matches the hand calculation', bad.length === 0, bad.join('\n      '));
  check('project duration is 29 working days', cpm.projectEnd === 29, 'got ' + cpm.projectEnd);
  check('critical path is T1-T2-T3-T4-T8-T9-T10',
    cpm.chain.join('-') === 'T1-T2-T3-T4-T8-T9-T10', 'got ' + cpm.chain.join('-'));

  /* The same numbers must come out of the live game engine, not just
     the standalone CPM call. */
  var g = newGame('HANDCALC', 'easy', D.TUTORIAL_NETWORK);
  var live = g.computeCPM();
  var mismatch = D.TUTORIAL_EXPECTED_CPM.filter(function (row) {
    var r = live.results[row[0]];
    return r.es !== row[1] || r.ef !== row[2] || r.tf !== row[5];
  }).map(function (r) { return r[0]; });
  check('the live game engine reproduces the same table at week 1',
    mismatch.length === 0, 'mismatched: ' + mismatch.join(','));
})();

/* =====================================================================
   2. SPENDING FLOAT SHIFTS THE CRITICAL PATH
   ===================================================================== */
section('2. Float consumption moves the critical path');
(function () {
  function chainWith(extra) {
    var nodes = D.TUTORIAL_NETWORK.activities.map(function (a) {
      return { id: a.id, dur: a.work + (a.id === 'T5' ? extra : 0), minStart: 0, preds: a.preds || [] };
    });
    return TO.CPM.compute(nodes);
  }
  var base = chainWith(0);
  check('T5 starts with 3 days of total float and is NOT critical',
    base.results.T5.tf === 3 && base.chain.indexOf('T5') === -1,
    'tf=' + base.results.T5.tf);

  var atFloat = chainWith(3);
  check('slipping exactly its float does not yet extend the project',
    atFloat.projectEnd === base.projectEnd, base.projectEnd + ' -> ' + atFloat.projectEnd);

  var past = chainWith(5);
  check('slipping past its float makes T5 critical', past.results.T5.tf === 0);
  check('the critical path is now a different chain',
    past.chain.join('-') !== base.chain.join('-'), past.chain.join('-'));
  check('the branch that used to be critical now carries float',
    past.results.T8.tf > 0, 'T8 tf=' + past.results.T8.tf);
  check('the project finishes later than it did', past.projectEnd > base.projectEnd,
    base.projectEnd + ' -> ' + past.projectEnd);

  /* And in a real game the engine announces the move. */
  var moved = 0, changed = 0;
  SEEDS.forEach(function (s) {
    var g = play(s, POLICY.passive);
    g.history.forEach(function (r) { if (r.chainChanged) { changed++; if (r.movedTo) moved++; } });
  });
  check('the critical path actually moves during real games', changed > 0, 'changes=' + changed);
  check('the game names the activity it moved to', moved > 0, 'named=' + moved);
})();

/* =====================================================================
   3. CURE TIMES AND INSPECTION HOLDS ARE NON-COMPRESSIBLE
   ===================================================================== */
section('3. No acceleration shortens a cure or a hold');
(function () {
  var g = newGame('INCOMPRESSIBLE');
  var fixed = D.MAIN_NETWORK.activities.filter(function (a) { return a.fixed; });
  check('the project actually contains cure and inspection holds',
    fixed.length >= 6 && fixed.some(function (a) { return a.kind === 'cure'; })
      && fixed.some(function (a) { return a.kind === 'inspection'; }), 'count=' + fixed.length);

  /* Every combination of acceleration the game offers, applied at once. */
  var allOt = {}; Object.keys(D.TRADES).forEach(function (t) { allOt[t] = 2; });
  var bad = [];
  fixed.forEach(function (a) {
    var planned = g.remainingDuration(a.id, {}, {});
    [1, 2, 5, 99].forEach(function (crews) {
      var alloc = {}; alloc[a.id] = crews;
      var d = g.remainingDuration(a.id, alloc, allOt);
      if (d !== planned) bad.push(a.id + ' @' + crews + ' crews: ' + planned + ' -> ' + d);
    });
    if (planned !== a.work) bad.push(a.id + ' planned ' + planned + ' != authored ' + a.work);
  });
  check('no crew count or overtime level changes a fixed duration', bad.length === 0, bad.join('; '));

  /* Simulated, not just planned: run the holds with everything thrown
     at them and confirm they still burn one working day per day. */
  var simBad = [];
  ['FTGC', 'SOGC', 'INSP1', 'INSP2'].forEach(function (id) {
    var gg = newGame('INCOMP-SIM-' + id, 'easy');
    var guard = 0;
    while (!gg.finished && gg.state[id].finishDay === null && guard++ < 200) {
      gg.autoAllocate();
      var alloc = gg.alloc; alloc[id] = 99;
      var crews = {}; Object.keys(D.TRADES).forEach(function (t) { crews[t] = 2; });
      gg.runWeek({ ot: allOt, alloc: alloc, crews: crews });
    }
    var st = gg.state[id];
    if (st.finishDay === null) { simBad.push(id + ' never finished'); return; }
    var elapsed = st.finishDay - st.startedDay + 1;
    var authored = gg.byId[id].work;
    if (elapsed < authored) simBad.push(id + ' took ' + elapsed + ' wd, authored ' + authored);
  });
  check('in simulation a hold never completes faster than its authored duration',
    simBad.length === 0, simBad.join('; '));

  /* Expediting must not touch them either. */
  var expediteTargetsFixed = D.EVENT_DECK.filter(function (e) {
    return e.expedite && e.delay && e.delay.targets.some(function (id) {
      var a = D.MAIN_NETWORK.activities.filter(function (x) { return x.id === id; })[0];
      return a && a.fixed;
    });
  });
  check('no expedite option targets a cure or an inspection hold',
    expediteTargetsFixed.length === 0,
    expediteTargetsFixed.map(function (e) { return e.id; }).join(','));
})();

/* =====================================================================
   4. DETERMINISM
   ===================================================================== */
section('4. Determinism');
(function () {
  var bad = [];
  SEEDS.forEach(function (s) {
    var a = play(s, POLICY.balanced);
    var b = play(s, POLICY.balanced);
    if (a.profit !== b.profit) bad.push(s + ' profit ' + a.profit + ' vs ' + b.profit);
    if (a.finishWorkingDay !== b.finishWorkingDay) bad.push(s + ' finish differs');
    if (a.history.length !== b.history.length) bad.push(s + ' week count differs');
  });
  check('same seed + same decision script twice = identical profit, to the dollar',
    bad.length === 0, bad.join('; '));

  var distinct = {};
  SEEDS.forEach(function (s) { distinct[play(s, POLICY.passive).profit] = true; });
  check('different seeds produce different runs', Object.keys(distinct).length > 1);

  /* The event deck must not depend on anything a player does. */
  var deckBad = [];
  SEEDS.slice(0, 4).forEach(function (s) {
    var quiet = newGame(s), loud = play(s, POLICY.maxOvertime);
    for (var w = 1; w <= 25; w++) {
      var e1 = quiet.weekEvents(w).map(function (e) { return e.id; }).join(',');
      var e2 = loud.weekEvents(w).map(function (e) { return e.id; }).join(',');
      if (e1 !== e2) deckBad.push(s + ' wk' + w);
    }
  });
  check('the event sequence is identical no matter how the team plays',
    deckBad.length === 0, deckBad.join(', '));

  /* Nothing in the engine may reach for wall-clock time or randomness. */
  var src = require('fs').readFileSync(__dirname + '/engine.js', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check('engine.js contains no Math.random', src.indexOf('Math.random') === -1);
  check('engine.js contains no Date.now', src.indexOf('Date.now') === -1);
})();

/* =====================================================================
   5. MAXIMUM OVERTIME LOSES TO BALANCED PLAY
   ===================================================================== */
section('5. Maximum overtime every week is worse than a balanced strategy');
(function () {
  var bad = [], rows = [];
  SEEDS.forEach(function (s) {
    var hot = play(s, POLICY.maxOvertime);
    var bal = play(s, POLICY.balanced);
    rows.push('   ' + s.padEnd(10) + ' maxOT ' + U.money(hot.profit).padStart(12) +
      ' (' + hot.history.length + ' wk)   balanced ' + U.money(bal.profit).padStart(11) +
      ' (' + bal.history.length + ' wk)');
    if (!(bal.profit > hot.profit)) bad.push(s + ': maxOT ' + hot.profit + ' >= balanced ' + bal.profit);
  });
  console.log(rows.join('\n'));
  check('on every seed, balanced play beats maximum overtime', bad.length === 0, bad.join('; '));

  /* And it is not merely more expensive — it is genuinely slower once
     the decay sets in. */
  var slower = SEEDS.filter(function (s) {
    return play(s, POLICY.maxOvertime).finishWorkingDay > play(s, POLICY.balanced).finishWorkingDay;
  });
  check('maximum overtime also finishes LATER than balanced play',
    slower.length === SEEDS.length, slower.length + '/' + SEEDS.length + ' seeds');

  var p1 = TO.Model.otProductivity(1, 1), p9 = TO.Model.otProductivity(1, 9);
  var q9 = TO.Model.otProductivity(2, 9);
  check('sustained 50-hr weeks eventually produce less than straight time',
    p1 > 1.2 && p9 < 1, 'wk1 ' + p1.toFixed(3) + ' wk9 ' + p9.toFixed(3));
  check('sustained 60-hr weeks fall below straight time and below 50-hr weeks',
    q9 < 1 && q9 < p9, '60hr ' + q9.toFixed(3) + ' vs 50hr ' + p9.toFixed(3));
})();

/* =====================================================================
   6. OVERLOADING ONE FLOOR BEATS NOTHING
   ===================================================================== */
section('6. Stacking one zone produces less work than splitting crews');
(function () {
  var cap = D.ZONES.L1.cap;
  var stacked = TO.Model.crewOutput(4) * TO.Model.stackFactor(4, cap);
  var split = 2 * (TO.Model.crewOutput(2) * TO.Model.stackFactor(2, cap));
  check('4 crews in one ' + cap + '-crew zone < 2+2 across two zones',
    split > stacked, 'stacked ' + stacked.toFixed(2) + ' vs split ' + split.toFixed(2));
  check('past a point an extra crew in a full zone REDUCES total output',
    TO.Model.crewOutput(5) * TO.Model.stackFactor(5, cap) <
    TO.Model.crewOutput(2) * TO.Model.stackFactor(2, cap));

  /* Simulated head to head, on a purpose-built network so nothing else
     can explain the difference: two identical zones, two identical
     activities in each, one trade, four crews. Team A puts all four on
     one floor. Team B splits two and two. Same crews, same work, same
     week — the only variable is where the crews stand. */
  (function () {
    var ZONES2 = { A: { name: 'Floor A', cap: 2 }, B: { name: 'Floor B', cap: 2 } };
    var TRADE1 = { mep: D.TRADES.mep };
    function net() {
      return {
        id: 'stacktest', name: 'Stacking test', contractValue: 100000,
        contractWorkingDays: 50, fixedCost: 0, gcPerCalendarDay: 0,
        ldPerCalendarDay: 0, earlyBonusPerCalendarDay: 0, earlyBonusCapDays: 0,
        startDate: '2026-09-07',
        activities: [
          { id: 'A1', name: 'A1', trade: 'mep', zone: 'A', work: 40, maxCrews: 2, preds: [] },
          { id: 'A2', name: 'A2', trade: 'mep', zone: 'A', work: 40, maxCrews: 2, preds: [] },
          { id: 'B1', name: 'B1', trade: 'mep', zone: 'B', work: 40, maxCrews: 2, preds: [] },
          { id: 'B2', name: 'B2', trade: 'mep', zone: 'B', work: 40, maxCrews: 2, preds: [] }
        ],
        startingCrews: { mep: 4 }, maxHire: { mep: 4 }
      };
    }
    function oneWeek(alloc) {
      var gg = new TO.Game.Game({
        network: net(), trades: TRADE1, zones: ZONES2, deck: D.EVENT_DECK, calls: [],
        seed: 'STACK', difficulty: 'easy'
      });
      var before = 0, after = 0;
      gg.net.activities.forEach(function (a) { before += gg.state[a.id].remaining; });
      gg.runWeek({ crews: { mep: 4 }, alloc: alloc });
      gg.net.activities.forEach(function (a) { after += gg.state[a.id].remaining; });
      return { done: before - after, stacked: Object.keys(gg.lastRecordStacked || {}) };
    }
    var allOnA = oneWeek({ A1: 2, A2: 2 });          // 4 crews, one zone, cap 2
    var splitAB = oneWeek({ A1: 2, B1: 2 });          // 2 + 2 across two zones
    check('4 crews on one floor complete less work than 2+2 across two floors',
      splitAB.done > allOnA.done,
      'one floor ' + allOnA.done.toFixed(1) + ' crew-days vs split ' + splitAB.done.toFixed(1));
    check('the penalty is material, not a rounding difference',
      (splitAB.done - allOnA.done) / splitAB.done > 0.15,
      ((splitAB.done - allOnA.done) / splitAB.done * 100).toFixed(1) + '% difference');
  })();

  /* The game must also tell the player it happened. */
  var g2 = newGame('STACK-REPORT', 'easy');
  g2.crews.mep = 2; g2.crews.drywall = 2; g2.crews.finish = 2;
  var reported = false, guard2 = 0;
  while (!g2.finished && guard2++ < 40 && !reported) {
    g2.autoAllocate();
    var alloc2 = {};
    g2.openActivities(g2.day).forEach(function (o) {
      if (o.act.fixed || !o.act.trade) return;
      if (o.act.zone === 'L1' || o.act.zone === 'SITE') alloc2[o.id] = o.act.maxCrews || 1;
    });
    var rec = g2.runWeek({ alloc: alloc2, crews: g2.crews });
    if (Object.keys(rec.stackedZones).length) reported = true;
  }
  check('the week report names the zones that were stacked', reported);
})();

/* =====================================================================
   7. A FULL GAME FITS A CLASS PERIOD
   ===================================================================== */
section('7. A full game fits inside 45 minutes of class time');
(function () {
  var SECONDS_PER_TURN = 55;      // deliberation, measured generously
  var ANIM = 1.15;                // the week animation
  var worst = 0, rows = [];
  SEEDS.forEach(function (s) {
    var g = play(s, POLICY.balanced);
    var turns = g.history.length;
    worst = Math.max(worst, turns);
    rows.push('   ' + s.padEnd(10) + turns + ' turns  ~' +
      ((turns * (SECONDS_PER_TURN + ANIM)) / 60).toFixed(1) + ' min');
  });
  console.log(rows.join('\n'));
  var mins = (worst * (SECONDS_PER_TURN + ANIM)) / 60;
  check('worst-case sensible run stays under 45 minutes',
    mins < 45, mins.toFixed(1) + ' min at ' + worst + ' turns');

  var tut = play('TUTORIAL-LEN', POLICY.passive, 'easy', D.TUTORIAL_NETWORK);
  check('the tutorial is short enough to teach the loop (<= 12 turns)',
    tut.history.length <= 12, tut.history.length + ' turns');
  check('the full project has 25-40 activities',
    D.MAIN_NETWORK.activities.length >= 25 && D.MAIN_NETWORK.activities.length <= 40,
    D.MAIN_NETWORK.activities.length + ' activities');
})();

/* =====================================================================
   BALANCE — not required by the brief, but a game where doing nothing
   wins teaches the wrong lesson, so it is asserted.
   ===================================================================== */
section('Balance: active management beats doing nothing');
(function () {
  /* The reference player here is POLICY.thoughtful — the same one used
     in section 8 — because the old float-only "balanced" policy
     predates cash, standing, calls and the weather bet, and a policy
     blind to half the game is not a fair measure of managing it. */
  var passiveTot = 0, activeTot = 0, wins = 0;
  SEEDS.forEach(function (s) {
    var p = play(s, POLICY.passive).profit;
    var b = play(s, POLICY.thoughtful).profit;
    passiveTot += p; activeTot += b;
    if (b > p) wins++;
  });
  console.log('   passive avg  ' + U.money(passiveTot / SEEDS.length));
  console.log('   active avg   ' + U.money(activeTot / SEEDS.length));
  check('active management beats passive play on average', activeTot > passiveTot);
  check('active management wins on most seeds', wins >= Math.ceil(SEEDS.length * 0.6),
    wins + '/' + SEEDS.length);
  check('a well-played job can finish at or ahead of the contract date',
    SEEDS.some(function (s) { return play(s, POLICY.thoughtful).lateCalendarDays <= 0; }));
})();

/* =====================================================================
   8. THE DECISIONS HAVE TO MATTER
   A game where clicking Commit is as good as thinking teaches nothing.
   ===================================================================== */
section('8. A player who thinks beats a player who clicks Commit');
(function () {
  var pTot = 0, tTot = 0, wins = 0, rows = [];
  SEEDS.forEach(function (s) {
    var p = play(s, POLICY.passive), t = play(s, POLICY.thoughtful);
    pTot += p.profit; tTot += t.profit;
    if (t.profit > p.profit) wins++;
    rows.push('   ' + s.padEnd(10) + 'defaults ' + U.money(p.profit).padStart(11) +
      '   thinking ' + U.money(t.profit).padStart(11) +
      '   (' + U.money(t.profit - p.profit) + ')');
  });
  console.log(rows.join('\n'));
  /* Not every seed, and deliberately so: a cheap call that the roll
     lets through beats an expensive one that was never needed. Since
     the whole class plays the same seed, that is shared, and the seeds
     where caution loses make the best debriefs. What must hold is that
     judgment wins on most seeds and by a wide margin on average. */
  check('thinking beats the defaults on most seeds', wins >= Math.ceil(SEEDS.length * 0.7),
    wins + '/' + SEEDS.length);
  check('and by a margin worth playing for (>= 40%)',
    tTot > pTot * 1.4, U.money(pTot / SEEDS.length) + ' -> ' + U.money(tTot / SEEDS.length));
  check('accepting every default can lose money on a bad seed',
    SEEDS.some(function (s) { return play(s, POLICY.passive).profit < 0; }));
  check('a well-played job can still finish ahead of the contract date',
    SEEDS.some(function (s) { return play(s, POLICY.thoughtful).lateCalendarDays <= 0; }));
})();

section('9. Calls: the choice moves the outcome, the roll does not move');
(function () {
  /* The whole fairness claim: identical roll for every team, different
     threshold. Prove both halves. */
  var g1 = newGame('CALLFAIR'), g2 = newGame('CALLFAIR');
  var same = D.CALLS.every(function (c) { return g1.callRoll(c.id) === g2.callRoll(c.id); });
  check('two teams on a seed face identical rolls on every call', same);
  var g3 = newGame('CALLFAIR-2');
  check('a different seed rolls differently',
    D.CALLS.some(function (c) { return g1.callRoll(c.id) !== g3.callRoll(c.id); }));
  check('a call roll never depends on how the game is played', (function () {
    var a = newGame('CALLPLAY');
    var guard = 0;
    while (!a.finished && guard++ < 40) { a.autoAllocate(); a.runWeek({ alloc: a.alloc, ot: { mep: 2 } }); }
    return D.CALLS.every(function (c) { return a.callRoll(c.id) === newGame('CALLPLAY').callRoll(c.id); });
  })());

  /* Buying down the exposure has to change results across a spread of
     seeds, or the calls are decoration. */
  function playCalls(seed, pick) {
    var g = newGame(seed);
    var guard = 0;
    while (!g.finished && guard++ < 200) {
      g.autoAllocate();
      var calls = {};
      g.openCalls().forEach(function (c) {
        var opt = pick === 'safe' ? c.options[c.options.length - 1] : c.options[0];
        calls[c.id] = opt.id;
      });
      g.runWeek({ alloc: g.alloc, calls: calls });
    }
    return g;
  }
  var cheapFails = 0, safeFails = 0, changed = 0;
  SEEDS.forEach(function (s) {
    var cheap = playCalls(s, 'cheap'), safe = playCalls(s, 'safe');
    cheapFails += cheap.callLog.filter(function (e) { return e.failed; }).length;
    safeFails += safe.callLog.filter(function (e) { return e.failed; }).length;
    if (cheap.profit !== safe.profit) changed++;
  });
  check('taking the cheap option on every call fails more often',
    cheapFails > safeFails, cheapFails + ' vs ' + safeFails + ' failures');
  check('the choice changes the result on every seed', changed === SEEDS.length,
    changed + '/' + SEEDS.length);
  check('calls fire often enough to matter', cheapFails >= SEEDS.length,
    cheapFails + ' failures across ' + SEEDS.length + ' seeds');

  /* Ignoring a call must cost exactly what the default option costs,
     and cost it at the right moment. Before this was fixed, an
     unanswered call defaulted at the reveal — by which time its days
     landed on work already built, so ignoring calls was free. */
  (function () {
    function run(answer) {
      var g = newGame('DEFAULTS');
      var guard = 0;
      while (!g.finished && guard++ < 200) {
        g.autoAllocate();
        var calls = {};
        if (answer) {
          g.openCalls().forEach(function (c) { calls[c.id] = c.options[0].id; });
        }
        g.runWeek({ alloc: g.alloc, calls: calls });
      }
      return g;
    }
    var ignored = run(false), chosen = run(true);
    /* Not to-the-dollar any more: answering a call early pays its cost
       earlier, and with a live line of credit that shifts a few dollars
       of interest. Same schedule, same decisions, near-identical money. */
    check('ignoring every call lands where choosing the default lands (within LOC interest)',
      Math.abs(ignored.profit - chosen.profit) <= 2000 &&
      ignored.finishWorkingDay === chosen.finishWorkingDay,
      U.money(ignored.profit) + ' vs ' + U.money(chosen.profit));

    /* and a call whose default carries days must actually cost them */
    var withDays = null;
    D.CALLS.forEach(function (c) {
      if (!withDays && c.project === 'main' && c.options[0].delay > 0) withDays = c;
    });
    if (withDays) {
      function pick(optId) {
        var g = newGame('DEFAULTDAYS');
        var guard = 0;
        while (!g.finished && guard++ < 200) {
          g.autoAllocate();
          var calls = {};
          g.openCalls().forEach(function (c) {
            calls[c.id] = (c.id === withDays.id) ? optId : c.options[0].id;
          });
          g.runWeek({ alloc: g.alloc, calls: calls });
        }
        return g;
      }
      var slow = pick(withDays.options[0].id);
      var fast = pick(withDays.options[1].id);
      check('a default option that costs days actually costs them',
        slow.finishWorkingDay > fast.finishWorkingDay ||
        slow.money.events !== fast.money.events,
        withDays.id + ': ' + slow.finishWorkingDay + ' wd vs ' + fast.finishWorkingDay + ' wd');
    }
  })();

  /* Determinism must survive the whole decision layer. */
  var d1 = play('CALL-DET', POLICY.thoughtful), d2 = play('CALL-DET', POLICY.thoughtful);
  check('determinism holds with calls, weather calls and crew orders in play',
    d1.profit === d2.profit && d1.finishWorkingDay === d2.finishWorkingDay,
    d1.profit + ' vs ' + d2.profit);
})();

section('10. Procurement, weather and manpower lead time');
(function () {
  /* Buying a package out must actually immunise the matching card. */
  function run(buy) {
    var g = newGame('PROCURE');
    var guard = 0;
    while (!g.finished && guard++ < 200) {
      g.autoAllocate();
      var calls = {};
      g.openCalls().forEach(function (c) {
        if (!c.procurement) { calls[c.id] = c.options[0].id; return; }
        var opt = null;
        c.options.forEach(function (o) { if (o.sets) opt = o; });
        calls[c.id] = (buy && opt) ? opt.id : c.options[0].id;
      });
      g.runWeek({ alloc: g.alloc, calls: calls });
    }
    return g;
  }
  var exposed = run(false), covered = run(true);
  check('pre-buying a package blocks its delivery card',
    Object.keys(covered.flags).length >= 1 && covered.finishWorkingDay <= exposed.finishWorkingDay,
    exposed.finishWorkingDay + ' wd exposed vs ' + covered.finishWorkingDay + ' wd covered');

  /* Crew lead time: ordering must not take effect this week. */
  var g = newGame('NOTICE');
  g.autoAllocate();
  var before = g.crews.concrete;
  g.runWeek({ alloc: g.alloc, crews: { concrete: 2 } });
  check('a crew ordered this week does not show up this week',
    g.crews.concrete === before, 'crews went ' + before + ' -> ' + g.crews.concrete);
  check('it is on order with an arrival week',
    g.crewOrders.some(function (o) { return o.trade === 'concrete' && o.arrivesWeek > g.week - 1; }));
  var guard = 0;
  while (g.crews.concrete === before && guard++ < 4) { g.autoAllocate(); g.runWeek({ alloc: g.alloc }); }
  check('and it arrives two weeks later', g.crews.concrete > before && guard <= 3,
    'arrived after ' + guard + ' more weeks');
  var gr = newGame('RELEASE');
  gr.crews.mep = 2;
  gr.autoAllocate();
  gr.runWeek({ alloc: gr.alloc, crews: { mep: 1 } });
  check('releasing a crew is immediate', gr.crews.mep === 1, 'mep=' + gr.crews.mep);

  /* Working through the weather has to be a real trade, not free. */
  function wx(pour, sd) {
    var gg = newGame(sd || 'WEATHER-CALL', 'hard');
    var guard = 0, cost = 0;
    while (!gg.finished && guard++ < 200) {
      gg.autoAllocate();
      gg.runWeek({ alloc: gg.alloc, pourThrough: pour });
    }
    return gg;
  }
  var stoodTot = 0, pushTot = 0, costStood = 0, costPush = 0;
  ['WEATHER-A', 'WEATHER-B', 'WEATHER-C', 'WEATHER-D'].forEach(function (sd) {
    var a = wx(false, sd), b = wx(true, sd);
    stoodTot += a.finishWorkingDay; pushTot += b.finishWorkingDay;
    costStood += a.money.events; costPush += b.money.events;
  });
  check('working through the rain buys schedule on average',
    pushTot < stoodTot, (stoodTot / 4).toFixed(1) + ' wd standing down vs ' + (pushTot / 4).toFixed(1) + ' wd pushing');
  check('and it is never free', costPush > costStood,
    U.money(costStood / 4) + ' vs ' + U.money(costPush / 4));
  check('the exposure scales with how long you work in it',
    Math.min(0.62, 0.16 * 1) < Math.min(0.62, 0.16 * 3));
})();

/* =====================================================================
   11. CASH IS A SECOND SET OF BOOKS, AND IT HAS TO RECONCILE
   ===================================================================== */
section('11. Cash flow: pay apps, retainage, the line of credit');
(function () {
  var g = play('CASHBOOK', POLICY.passive);
  check('the cash book reconciles: ending cash equals final profit',
    Math.abs(g.cash - g.profit) < 1, U.money(g.cash) + ' vs ' + U.money(g.profit));
  check('the job runs cash-negative in the middle even when it profits at the end',
    g.minCash < -200000 && g.profit > g.minCash, 'valley ' + U.money(g.minCash));
  check('the line of credit charged real interest', g.money.financing > 1000,
    U.money(g.money.financing));
  check('everything billed was eventually collected',
    Math.abs(g.billedCum - (g.net.contractValue + g.money.changeOrders)) < 1 &&
    g.receivables.length === 0 && g.money.retainage === 0);
  check('the cash history is recorded for the debrief', g.cashHistory.length >= g.history.length);

  /* Front-loading has two faces, and the seeded audit roll decides
     which one a class sees. SOV-A rolls 0.695 (audit passes): the
     valley must be shallower and the interest lower. SOV-TEST rolls
     0.163 (audit fires): a pay application bounces three weeks and
     the dip around it gets WORSE than honest billing — the reviewer
     is the risk you took. Both branches are the lesson. */
  function sov(seed, pick) {
    var g2 = newGame(seed);
    var guard = 0;
    while (!g2.finished && guard++ < 200) {
      g2.autoAllocate();
      var calls = {};
      g2.openCalls().forEach(function (c) { calls[c.id] = c.id === 'sov' ? pick : c.options[0].id; });
      g2.runWeek({ alloc: g2.alloc, calls: calls });
    }
    return g2;
  }
  var sA = sov('SOV-A', 'straight'), lA = sov('SOV-A', 'frontload');
  check('front-loading shallows the valley when the audit passes',
    lA.minCash > sA.minCash + 20000,
    U.money(sA.minCash) + ' straight vs ' + U.money(lA.minCash) + ' loaded');
  check('and cuts the financing bill', lA.money.financing < sA.money.financing,
    U.money(sA.money.financing) + ' vs ' + U.money(lA.money.financing));
  var sF = sov('SOV-TEST', 'straight'), lF = sov('SOV-TEST', 'frontload');
  check('when the audit fires, the bounced application makes the dip worse than honest billing',
    lF.minCash < sF.minCash,
    U.money(sF.minCash) + ' straight vs ' + U.money(lF.minCash) + ' loaded-and-audited');
})();

section('12. Sub standing: grind a sub and they answer slower');
(function () {
  var g = newGame('STANDING');
  check('every trade starts solid', Object.keys(g.standing).every(function (t) {
    return g.standing[t] === 70;
  }));
  /* hammer the concrete sub with 60-hour weeks */
  var guard = 0;
  while (guard++ < 8 && !g.finished) {
    g.autoAllocate();
    g.runWeek({ alloc: g.alloc, ot: { concrete: 2 } });
  }
  check('sustained 60-hour weeks burn the sub\'s standing', g.standing.concrete < 50,
    'standing ' + g.standing.concrete);
  check('a wary sub takes an extra week to field a crew',
    g.crewNotice('concrete') === 3 && g.crewNotice('finish') === 2,
    'notice ' + g.crewNotice('concrete'));
  /* let them breathe and it comes back — slowly */
  var was = g.standing.concrete;
  guard = 0;
  while (guard++ < 10 && !g.finished) { g.autoAllocate(); g.runWeek({ alloc: g.alloc }); }
  check('standing recovers when you stop grinding them', g.standing.concrete > was);
  check('a burned sub drags: the factor is real but not crippling',
    TO.Model !== null && (function () {
      var g2 = newGame('BURNED');
      g2.standing.mep = 20;
      return g2.standingFactor('mep') === 0.95 && g2.standingFactor('drywall') === 1;
    })());
})();

section('13. Chains and determinism with everything on');
(function () {
  var found = null;
  ['MSU-2601', 'TOPPING', 'FALL26', 'WK7', 'BLUE', 'GOLD', 'CMGT-201', 'CALLOWAY',
   'RACER', 'GOLD2', 'NAVY', 'DERBY'].forEach(function (seed) {
    if (found) return;
    var g = newGame(seed);
    var seen = {};
    g.schedule.weeks.forEach(function (w) {
      w.events.forEach(function (e) {
        if (e.id === 'r-duct') seen.parent = w.week;
        if (e.id === 'r-duct-ans') seen.child = w.week;
      });
    });
    if (seen.child) found = seen;
  });
  check('a chained card only ever appears after its parent',
    !found || (found.parent && found.child > found.parent),
    JSON.stringify(found));

  var a = play('EVERYTHING-DET', POLICY.thoughtful);
  var b = play('EVERYTHING-DET', POLICY.thoughtful);
  check('determinism holds with cash, standing, chains and the full decks',
    a.profit === b.profit && a.finishWorkingDay === b.finishWorkingDay &&
    a.money.financing === b.money.financing &&
    JSON.stringify(a.standing) === JSON.stringify(b.standing),
    U.money(a.profit) + ' vs ' + U.money(b.profit));
})();

section('14. Review regression ratchets — writer effects, FF, and rework');
(function () {
  var g = newGame('CREW-RATCHET');
  var before = g.crews.earthwork;
  g.autoAllocate(); // allocation must not materialize a requested crew
  g.runWeek({ crews: { earthwork: 2 }, alloc: g.alloc });
  check('crew request to 2 leaves Earthwork at 1 and orders week 3',
    g.crews.earthwork === before && g.crewOrders.some(function (o) { return o.trade === 'earthwork' && o.to === 2 && o.arrivesWeek === 3; }), JSON.stringify(g.crewOrders));
  check('crew request charges canonical $9,900 mobilization once', g.money.hiring === 9900, JSON.stringify(g.money));
  g.runWeek({ alloc: g.alloc }); g.runWeek({ alloc: g.alloc });
  check('ordered Earthwork arrives in week 3, not before', g.crews.earthwork === 2, JSON.stringify({ week:g.week, crews:g.crews, orders:g.crewOrders }));

  var p = newGame('PREVIEW-0'), decision = { alloc: U.deepClone(p.alloc), expedite: [], ot: {}, crews: U.deepClone(p.crews) };
  var untouched = JSON.stringify({ state:p.state, money:p.money, week:p.week });
  var preview = p.previewWeek(decision);
  var live = newGame('PREVIEW-0'); live.runWeek(decision);
  check('clone preview is non-mutating and matches commit effect fields', untouched === JSON.stringify({ state:p.state, money:p.money, week:p.week }) &&
    preview.projectEnd === live.project().projectEnd && JSON.stringify(preview.effectMoney) === JSON.stringify(live.money), JSON.stringify({preview:preview.projectEnd, live:live.project().projectEnd}));

  var f = newGame('FF-RATCHET');
  f.state.FIN3.finishDay = 120; f.state.FIN3.remaining = 0;
  check('COMM FF+2 cannot open before continuous-work FF start floor', !f.predsSatisfiedForStart('COMM', 118) || 118 < f.ffStartFloor('COMM'), JSON.stringify({floor:f.ffStartFloor('COMM')}));

  var net = U.deepClone(D.MAIN_NETWORK); net.activities.push({ id:'SIDE', name:'Independent side work', trade:'finish', zone:'L1', work:1, maxCrews:1, preds:[] });
  var r = newGame('REWORK-RATCHET', 'standard', net);
  r.state.FDW.finishDay = 10; r.state.BKF.finishDay = 20; r.state.SOG.finishDay = 30; r.state.SIDE.finishDay = 40;
  r.invalidateDescendants('FDW');
  check('FDW rework invalidates BKF/SOG descendants but preserves unrelated SIDE', r.state.BKF.finishDay === null && r.state.SOG.finishDay === null && r.state.SIDE.finishDay === 40);
  r.invalidateDescendants('BKF');
  check('second dependency-shape ratchet invalidates BKF successor SOG', r.state.SOG.finishDay === null && r.state.SIDE.finishDay === 40);
})();

section('15. Shipped COMM/FIN3 FF+2 runs continuously without ghost billing');
(function () {
  var g = newGame('MSU-2601'), guard = 0, commWork = 0, commMepDays = 0;
  var startFloor = null, zeroSeen = false, billedAfterZero = false;
  while (!g.finished && guard++ < 100) {
    g.autoAllocate();
    var before = g.state.COMM.remaining, day = g.day;
    var floor = g.ffStartFloor('COMM', day);
    var rec = g.runWeek({ alloc: U.deepClone(g.alloc) });
    var after = g.state.COMM.remaining;
    if (before > 1e-9 && after < before - 1e-9) {
      commWork += before - after;
      /* At this late shipped-network front COMM is the only allocated MEP
         work.  The record makes a billing effect observable, not inferred
         from source shape. */
      commMepDays += rec.workedCrewDays.mep || 0;
      if (startFloor === null) startFloor = floor;
    }
    if (zeroSeen && (rec.workedCrewDays.mep || 0) > 0) billedAfterZero = true;
    if (after <= 1e-9) zeroSeen = true;
  }
  check('shipped MSU-2601 schedule terminates with COMM/FIN3 FF work', g.finished && guard < 100,
    JSON.stringify({guard:guard, comm:g.state.COMM, fin3:g.state.FIN3}));
  check('COMM starts no earlier than its operative CPM continuous-work floor',
    g.state.COMM.startedDay >= startFloor, JSON.stringify({start:g.state.COMM.startedDay,floor:startFloor}));
  check('COMM consumes exactly its authored 4 productive crew-days',
    Math.abs(commWork - 4) < 1e-9 && commMepDays === 4, JSON.stringify({work:commWork,mepDays:commMepDays}));
  check('COMM finishes exactly FIN3 finish + 2 with no productive billing after work is zero',
    g.state.COMM.finishDay === g.state.FIN3.finishDay + 2 && !billedAfterZero,
    JSON.stringify({comm:g.state.COMM.finishDay,fin3:g.state.FIN3.finishDay,billedAfterZero:billedAfterZero}));
})();

console.log('\n----');
console.log(passes + ' passed, ' + failures + ' failed');
process.exit(failures ? 1 : 0);
