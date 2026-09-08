/* =====================================================================
   TOPPING OUT — ENGINE
   Deterministic CPM scheduling engine + weekly project simulation.

   No DOM, no network, no Date.now(), no Math.random(). Everything that
   varies comes out of a seeded PRNG, and the entire event sequence is
   pre-rolled at game start so it cannot be influenced by player
   decisions. Same seed => same project => same run of bad luck.

   Run the self-tests:   node src/engine.js --test
   ===================================================================== */
'use strict';

var TO = (typeof TO !== 'undefined' && TO) || {};

/* ===================================================================
   UTIL
   =================================================================== */
TO.Util = (function () {

  /* FNV-1a over the seed string -> 32-bit state for mulberry32. */
  function hashSeed(str) {
    var h = 2166136261 >>> 0;
    var s = String(str == null ? '' : str).toUpperCase();
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /* mulberry32 — small, fast, well-distributed, fully reproducible. */
  function rng(seed) {
    var a = (typeof seed === 'number') ? (seed >>> 0) : hashSeed(seed);
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randInt(r, lo, hi) {           // inclusive
    if (hi <= lo) return lo;
    return lo + Math.floor(r() * (hi - lo + 1));
  }

  function pickWeighted(r, items) {
    var total = 0, i;
    for (i = 0; i < items.length; i++) total += (items[i].w || 1);
    var x = r() * total;
    for (i = 0; i < items.length; i++) {
      x -= (items[i].w || 1);
      if (x <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  function deepClone(o) {
    if (o === null || typeof o !== 'object') return o;
    if (Array.isArray(o)) {
      var a = new Array(o.length);
      for (var i = 0; i < o.length; i++) a[i] = deepClone(o[i]);
      return a;
    }
    var out = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out[k] = deepClone(o[k]);
    return out;
  }

  /* ---- calendar ---------------------------------------------------
     Working day index d (0-based, Mon-Fri) -> calendar days elapsed.
     cal(0)=0, cal(4)=4, cal(5)=7 (next Monday), cal(10)=14 ...
     cal(N) is also "calendar days consumed by N working days".        */
  function calDays(d) {
    return 7 * Math.floor(d / 5) + (d % 5);
  }

  var MS_DAY = 86400000;
  function dateFor(startISO, workingDay) {
    var base = Date.parse(startISO + 'T00:00:00Z');
    return new Date(base + calDays(workingDay) * MS_DAY);
  }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(startISO, workingDay) {
    var d = dateFor(startISO, workingDay);
    return MON[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
  }
  function fmtShortDate(startISO, workingDay) {
    var d = dateFor(startISO, workingDay);
    return (d.getUTCMonth() + 1) + '/' + d.getUTCDate();
  }
  function money(n) {
    var neg = n < 0;
    var s = Math.round(Math.abs(n)).toString();
    var out = '';
    while (s.length > 3) { out = ',' + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? '-$' : '$') + s + out;
  }

  /* A roll that depends ONLY on the seed and a label, never on the
     order of play. Two teams on the same seed get the same number for
     the same call, so the only thing that differs between them is the
     risk threshold they chose to buy. */
  function labelRoll(seed, label) {
    return rng(hashSeed(String(seed) + '|' + String(label)))();
  }

  return {
    hashSeed: hashSeed, rng: rng, randInt: randInt, pickWeighted: pickWeighted,
    labelRoll: labelRoll,
    deepClone: deepClone, calDays: calDays, dateFor: dateFor,
    fmtDate: fmtDate, fmtShortDate: fmtShortDate, money: money
  };
})();

/* ===================================================================
   CPM
   Precedence-diagram CPM with FS / SS / FF relationships and lags.

   Node: { id, dur, minStart, preds:[{id,type,lag}] }
   Returns per-node { es, ef, ls, lf, tf, ff, critical } plus the
   project duration and the driving (critical) chain.

   Float here is measured to PROJECT COMPLETION, not to the contract
   date, so total float is never negative. Schedule performance against
   the contract is reported separately by the game as days early/late.
   =================================================================== */
TO.CPM = (function () {

  function topoOrder(nodes) {
    var byId = {}, indeg = {}, succ = {}, i, j;
    for (i = 0; i < nodes.length; i++) {
      byId[nodes[i].id] = nodes[i];
      indeg[nodes[i].id] = 0;
      succ[nodes[i].id] = [];
    }
    for (i = 0; i < nodes.length; i++) {
      var ps = nodes[i].preds || [];
      for (j = 0; j < ps.length; j++) {
        if (!byId[ps[j].id]) continue;            // ignore dangling refs
        indeg[nodes[i].id]++;
        succ[ps[j].id].push(nodes[i].id);
      }
    }
    var queue = [], order = [];
    for (i = 0; i < nodes.length; i++) if (indeg[nodes[i].id] === 0) queue.push(nodes[i].id);
    while (queue.length) {
      var id = queue.shift();
      order.push(id);
      for (j = 0; j < succ[id].length; j++) {
        if (--indeg[succ[id][j]] === 0) queue.push(succ[id][j]);
      }
    }
    if (order.length !== nodes.length) throw new Error('CPM: network contains a cycle');
    return { order: order, byId: byId, succ: succ };
  }

  function compute(nodes) {
    var t = topoOrder(nodes), byId = t.byId, succ = t.succ, order = t.order;
    var R = {}, i, j, n, p, ps;

    /* ---- forward pass ------------------------------------------- */
    for (i = 0; i < order.length; i++) {
      n = byId[order[i]];
      var es = n.minStart || 0;
      ps = n.preds || [];
      for (j = 0; j < ps.length; j++) {
        p = R[ps[j].id];
        if (!p) continue;
        var lag = ps[j].lag || 0;
        if (ps[j].type === 'SS')      es = Math.max(es, p.es + lag);
        else if (ps[j].type === 'FF') es = Math.max(es, p.ef + lag - n.dur);
        else                          es = Math.max(es, p.ef + lag);   // FS
      }
      R[n.id] = { id: n.id, dur: n.dur, es: es, ef: es + n.dur };
    }

    /* ---- project duration --------------------------------------- */
    var projectEnd = 0;
    for (i = 0; i < order.length; i++) projectEnd = Math.max(projectEnd, R[order[i]].ef);

    /* ---- backward pass ------------------------------------------ */
    for (i = order.length - 1; i >= 0; i--) {
      n = byId[order[i]];
      var r = R[n.id];
      var ss = succ[n.id];
      var lf;
      if (!ss.length) {
        lf = projectEnd;
      } else {
        lf = Infinity;
        for (j = 0; j < ss.length; j++) {
          var s = byId[ss[j]], sr = R[ss[j]];
          var rel = null, k, sp = s.preds || [];
          for (k = 0; k < sp.length; k++) if (sp[k].id === n.id) { rel = sp[k]; break; }
          if (!rel) continue;
          var lg = rel.lag || 0;
          if (rel.type === 'SS')      lf = Math.min(lf, sr.ls - lg + r.dur);
          else if (rel.type === 'FF') lf = Math.min(lf, sr.lf - lg);
          else                        lf = Math.min(lf, sr.ls - lg);   // FS
        }
        if (!isFinite(lf)) lf = projectEnd;
      }
      r.lf = lf;
      r.ls = lf - r.dur;
      r.tf = r.ls - r.es;
    }

    /* ---- free float --------------------------------------------- */
    for (i = 0; i < order.length; i++) {
      n = byId[order[i]];
      var rr = R[n.id], sl = succ[n.id], ff;
      if (!sl.length) {
        ff = projectEnd - rr.ef;
      } else {
        ff = Infinity;
        for (j = 0; j < sl.length; j++) {
          var s2 = byId[sl[j]], sr2 = R[sl[j]];
          var rel2 = null, k2, sp2 = s2.preds || [];
          for (k2 = 0; k2 < sp2.length; k2++) if (sp2[k2].id === n.id) { rel2 = sp2[k2]; break; }
          if (!rel2) continue;
          var lg2 = rel2.lag || 0;
          if (rel2.type === 'SS')      ff = Math.min(ff, sr2.es - rr.es - lg2);
          else if (rel2.type === 'FF') ff = Math.min(ff, sr2.ef - rr.ef - lg2);
          else                         ff = Math.min(ff, sr2.es - rr.ef - lg2);
        }
        if (!isFinite(ff)) ff = projectEnd - rr.ef;
      }
      rr.ff = Math.max(0, Math.min(ff, rr.tf));
      rr.critical = (rr.tf === 0);
    }

    /* ---- driving (critical) chain -------------------------------
       Walk backwards from the latest-finishing critical activity,
       always stepping to the predecessor whose relationship is
       actually binding. This is COMPUTED, never declared.           */
    var end = null;
    for (i = 0; i < order.length; i++) {
      var c = R[order[i]];
      if (c.tf === 0 && (!end || c.ef > end.ef)) end = c;
    }
    var chain = [];
    var guard = 0;
    var cur = end;
    while (cur && guard++ < nodes.length + 2) {
      chain.unshift(cur.id);
      var node = byId[cur.id], best = null;
      var preds = node.preds || [];
      for (j = 0; j < preds.length; j++) {
        var pr = R[preds[j].id];
        if (!pr || pr.tf !== 0) continue;
        var lg3 = preds[j].lag || 0, binds = false;
        if (preds[j].type === 'SS')      binds = (pr.es + lg3 === cur.es);
        else if (preds[j].type === 'FF') binds = (pr.ef + lg3 - node.dur === cur.es);
        else                             binds = (pr.ef + lg3 === cur.es);
        if (binds && (!best || pr.ef > best.ef)) best = pr;
      }
      cur = best;
    }

    return {
      results: R, projectEnd: projectEnd, chain: chain,
      order: order, succ: succ,
      criticalIds: order.filter(function (id) { return R[id].tf === 0; })
    };
  }

  return { compute: compute, topoOrder: topoOrder };
})();

/* ===================================================================
   PRODUCTIVITY MODELS
   =================================================================== */
TO.Model = (function () {

  /* ---- OVERTIME -------------------------------------------------
     Sources (see teacher guide):
       Business Roundtable, Report C-2, "Scheduled Overtime Effect on
       Construction Projects" (1980): sustained 50-hr weeks settle near
       ~75% of baseline productivity; 60-hr weeks near ~66% by weeks
       8-9, and 60+ hr weeks sustained beyond ~2 months finish LATER
       than the same crew on 40 hours.
       Thomas & Raynar, "Scheduled Overtime and Labor Productivity:
       Quantitative Analysis", ASCE JCEM 123(2), 1997: 5- and 6-day
       extended weeks lose roughly 10-15% efficiency; crews often run
       3-4 weeks before measurable loss appears.
       The widely-quoted flat factors (50 hr = 92%, 60 hr = 82%) trace to a
   BLS study of repetitive manufacturing work, not to construction.
   MCAA Bulletin OT1 (2011) is a week-by-week curve instead, reaching
   72% (50 hr) and 61% (60 hr) by week 10.

     Model: no loss during a grace period, then a compounding weekly
     decay toward a documented floor.
       level 1 = 50 hr week: grace 2 wks, 10%/wk decay, floor 0.75
       level 2 = 60 hr week: grace 1 wk,  15%/wk decay, floor 0.62

     A note on that 0.62. Business Roundtable puts sustained 60-hour
     productivity near 66% of baseline, which nets 1.50 x 0.66 = 0.99 —
     only a hair under straight time, and fractionally BETTER than the
     50-hour floor of 1.25 x 0.75 = 0.94. Taken literally the published
     pair is non-monotonic, which would teach students the wrong thing:
     that if you are going to burn out the crew you may as well burn it
     out at 60. The same report concludes that sustained 60-hour weeks
     finish LATER than the same crew on 40 hours, so we use a slightly
     steeper floor of 0.62. That nets 0.93 — below straight time, below
     the 50-hour floor, and consistent with the report's own conclusion.
     Thomas & Raynar's range (no loss to 25%) comfortably contains it. */
  var OT = [
    { level: 0, label: '40 hr (straight time)', hours: 40, hoursMult: 1.00, costMult: 1.000, grace: 0, decay: 1.00, floor: 1.00 },
    { level: 1, label: '50 hr week',            hours: 50, hoursMult: 1.25, costMult: 1.375, grace: 2, decay: 0.90, floor: 0.75 },
    { level: 2, label: '60 hr week',            hours: 60, hoursMult: 1.50, costMult: 1.750, grace: 1, decay: 0.85, floor: 0.62 }
  ];

  /* Efficiency of a crew that has now worked `streak` consecutive
     weeks at this overtime level (streak counts the current week). */
  function otEfficiency(level, streak) {
    var s = OT[level];
    if (!s || level === 0) return 1;
    var over = streak - s.grace;
    if (over <= 0) return 1;
    return Math.max(s.floor, Math.pow(s.decay, over));
  }

  /* Net progress multiplier vs a straight-time crew-week. Above 1.0
     you are gaining ground; below 1.0 you are paying a premium to go
     SLOWER than 40 hours would have gone. */
  function otProductivity(level, streak) {
    return OT[level].hoursMult * otEfficiency(level, streak);
  }

  function otCost(level) { return OT[level].costMult; }

  /* ---- CREW OUTPUT (the crashing premium) ------------------------
     Adding a crew to an activity buys schedule, but never in a
     straight line. The second crew of a trade is the B team, works
     around the first, shares the same hoist, the same laydown and the
     same foreman's attention. Marginal output per added crew:

        crew 1  1.00      cumulative 1.00
        crew 2  0.80      cumulative 1.80
        crew 3  0.65      cumulative 2.45

     So doubling a crew buys ~44% off the duration for 100% more
     labour on that activity. That is the classic crash cost curve:
     always available, never free. Whether it pays depends entirely on
     whether the activity is on the critical path.                    */
  var MARGINAL = [1.00, 0.80, 0.65, 0.5];
  function crewOutput(n) {
    var out = 0;
    for (var i = 0; i < n; i++) out += (MARGINAL[i] != null ? MARGINAL[i] : 0.4);
    return out;
  }

  /* ---- TRADE STACKING -------------------------------------------
     A zone holds `cap` crews comfortably. Past that, everybody in the
     zone loses productivity: congestion, shared hoisting, tools and
     material staging, and crews working out of sequence around each
     other. 25% per crew over cap, floored at 35%.

     Consequence (verify #6): 4 crews in a cap-2 zone deliver
     4 x 0.50 = 2.0 crew-days/day, exactly what 2 crews deliver, while
     costing twice as much. Split 2+2 across two zones and you get 4.0. */
  function stackFactor(crewsInZone, cap) {
    if (crewsInZone <= cap) return 1;
    return Math.max(0.35, 1 - 0.25 * (crewsInZone - cap));
  }

  return { OT: OT, otEfficiency: otEfficiency, otProductivity: otProductivity, otCost: otCost,
           stackFactor: stackFactor, crewOutput: crewOutput, MARGINAL: MARGINAL };
})();

/* ===================================================================
   EVENT SEQUENCE
   Pre-rolled at game start for every week, so the deck is identical
   for every team on a seed no matter what anyone decides.
   =================================================================== */
TO.Events = (function () {

  var DIFFICULTY = {
    easy:     { key: 'easy',     label: 'Easy',     otherPerWeek: [0, 1], severity: 0.6, rainBias: -1 },
    standard: { key: 'standard', label: 'Standard', otherPerWeek: [0, 1], severity: 1.0, rainBias: 0 },
    hard:     { key: 'hard',     label: 'Hard',     otherPerWeek: [1, 2], severity: 1.3, rainBias: 1 }
  };

  function scaleDays(d, sev) { return Math.max(1, Math.round(d * sev)); }

  /* ---- when a card is allowed to be drawn --------------------------
     A late rebar delivery in week 20, when the last pour went in ten
     weeks ago, is not bad luck — it is nonsense, and it tells a student
     the deck is not really about their project. So every card that
     names activities gets a week window derived from where those
     activities sit in THIS project's schedule.

     The window is computed from the network alone — the unimpeded CPM
     stretched to the pace a real run takes — so it is identical for
     every team on a seed and the fairness guarantee is untouched. A
     card whose targets do not exist in this project at all is never
     drawn, which is what stops the ten-activity tutorial from being
     told its curtain wall is late.

     Firing EARLY is fine and realistic: a delivery can slip before you
     are ready for it. Firing long after the work is done is the bug. */
  var PACE_LO = 1.0;      // a fast team can reach the work on the CPM date
  var PACE_HI = 1.20;     // a slow one drifts about a fifth past it

  function buildWindows(deck, network) {
    var win = {};
    if (!network) return win;
    var nodes = network.activities.map(function (a) {
      return { id: a.id, dur: a.work, minStart: 0, preds: a.preds || [] };
    });
    var ref = TO.CPM.compute(nodes).results;
    var byTrade = {};
    network.activities.forEach(function (a) {
      if (a.trade) (byTrade[a.trade] = byTrade[a.trade] || []).push(a.id);
    });

    deck.forEach(function (ev) {
      if (ev.cat === 'weather') { win[ev.id] = { from: 1, to: Infinity }; return; }
      var ids = [];
      ['delay', 'holdExtend', 'bonus'].forEach(function (k) {
        if (ev[k] && ev[k].targets) ids = ids.concat(ev[k].targets);
      });
      if (ev.productivity) {
        ev.productivity.trades.forEach(function (t) { ids = ids.concat(byTrade[t] || []); });
      }
      if (!ids.length) { win[ev.id] = { from: 1, to: Infinity }; return; }   // pure flavour or cost

      var lo = Infinity, hi = -Infinity, found = false;
      ids.forEach(function (id) {
        var r = ref[id];
        if (!r) return;
        found = true;
        lo = Math.min(lo, r.es); hi = Math.max(hi, r.ef);
      });
      /* none of this card's targets are in this project — retire it */
      win[ev.id] = found
        ? { from: Math.max(1, Math.floor(lo * PACE_LO / 5)), to: Math.ceil(hi * PACE_HI / 5) + 1 }
        : null;
    });
    return win;
  }

  function inWindow(win, ev, week) {
    var w = win[ev.id];
    if (w === undefined) return true;        // no network supplied
    if (w === null) return false;            // targets do not exist here
    return week >= w.from && week <= w.to;
  }

  /* Build the whole run of luck up front. */
  function preroll(deck, seed, difficultyKey, weeks, network) {
    var diff = DIFFICULTY[difficultyKey] || DIFFICULTY.standard;
    var r = TO.Util.rng(TO.Util.hashSeed(seed) ^ 0x5EED1234);
    var win = buildWindows(deck, network);
    var weather = deck.filter(function (e) { return e.cat === 'weather'; });
    var others = deck.filter(function (e) { return e.cat !== 'weather'; });
    var out = [];
    var recent = [];      // avoid immediate repeats of the same card
    var drawn = {};       // cards drawn in EARLIER weeks — gates chained cards

    for (var w = 1; w <= weeks; w++) {
      var wk = { week: w, events: [] };

      /* --- weather, every week --- */
      var wpool = weather.filter(function (e) { return (e.minWeek || 1) <= w; });
      var we = TO.Util.pickWeighted(r, wpool);
      var lo = we.rainDays[0], hi = we.rainDays[1];
      var actual = TO.Util.randInt(r, lo, hi) + diff.rainBias;
      actual = Math.max(0, Math.min(5, actual));
      wk.events.push(instantiate(we, actual, diff, r));

      /* --- other categories --- */
      var n = TO.Util.randInt(r, diff.otherPerWeek[0], diff.otherPerWeek[1]);
      for (var k = 0; k < n; k++) {
        var pool = others.filter(function (e) {
          if (e.chain && !drawn[e.chain]) return false;
          return (e.minWeek || 1) <= w && inWindow(win, e, w) && recent.indexOf(e.id) === -1;
        });
        if (!pool.length) {
          pool = others.filter(function (e) {
            if (e.chain && !drawn[e.chain]) return false;
            return (e.minWeek || 1) <= w && inWindow(win, e, w);
          });
        }
        if (!pool.length) {
          /* nothing in the deck fits this stage of the job — a quiet
             week is a better answer than an irrelevant card */
          pool = others.filter(function (e) { return e.flavorOnly; });
        }
        if (!pool.length) continue;
        var ev = TO.Util.pickWeighted(r, pool);
        recent.push(ev.id);
        if (recent.length > 6) recent.shift();
        wk.events.push(instantiate(ev, null, diff, r));
      }
      out.push(wk);
      wk.events.forEach(function (e) { drawn[e.id] = true; });
    }
    return { weeks: out, difficulty: diff };
  }

  function instantiate(ev, rainActual, diff, r) {
    var o = {
      id: ev.id, cat: ev.cat, title: ev.title, text: ev.text,
      flavorOnly: !!ev.flavorOnly
    };
    if (ev.cat === 'weather') {
      o.forecast = ev.rainDays.slice();
      o.rainActual = rainActual;
      o.affects = ev.affects ? ev.affects.slice() : null;   // null = all weather-flagged work
    }
    if (ev.delay)      o.delay = { targets: ev.delay.targets.slice(), days: scaleDays(ev.delay.days, diff.severity) };
    if (ev.holdExtend) o.holdExtend = { targets: ev.holdExtend.targets.slice(), days: scaleDays(ev.holdExtend.days, diff.severity) };
    if (ev.bonus)      o.bonus = { targets: ev.bonus.targets.slice(), days: ev.bonus.days };
    if (ev.productivity) o.productivity = {
      trades: ev.productivity.trades.slice(),
      factor: Math.max(0.4, 1 - (1 - ev.productivity.factor) * diff.severity),
      weeks: ev.productivity.weeks
    };
    if (ev.cost)    o.cost = Math.round(ev.cost * diff.severity);
    if (ev.revenue) o.revenue = ev.revenue;
    if (ev.costNote) o.costNote = ev.costNote;
    if (ev.expedite) {
      /* Clamp against the SCALED delay, not the authored one, or an easy
         setting that shrinks a 2-day slip to 1 day will still sell you
         2 days of recovery. Expediting recovers SOME of a late delivery;
         it never un-happens it, so recovery is capped one day short of
         the delay. If that leaves nothing to buy, the offer is not made
         at all rather than charging a fee for zero days. */
      var dd = (o.delay && o.delay.days) || (o.holdExtend && o.holdExtend.days) || 0;
      var rec = Math.min(scaleDays(ev.expedite.recover, diff.severity), Math.max(0, dd - 1));
      if (rec >= 1) {
        o.expedite = {
          fee: Math.round(ev.expedite.fee * diff.severity),
          recover: rec,
          label: ev.expedite.label,
          detail: ev.expedite.detail || null
        };
      }
    }
    return o;
  }

  return { DIFFICULTY: DIFFICULTY, preroll: preroll, buildWindows: buildWindows };
})();

/* ===================================================================
   GAME
   =================================================================== */
TO.Game = (function () {

  var WD_PER_WEEK = 5;
  var CREW_NOTICE = 2;      // weeks between ordering a crew and it showing up

  function Game(opts) {
    this.net = TO.Util.deepClone(opts.network);
    this.trades = opts.trades;
    this.zones = opts.zones;
    this.seed = String(opts.seed || 'MSU-1').toUpperCase();
    this.difficulty = opts.difficulty || 'standard';
    this.teamName = opts.teamName || 'Team';
    this.deck = opts.deck;
    this.deckCalls = opts.calls || [];

    this.byId = {};
    for (var i = 0; i < this.net.activities.length; i++) {
      this.byId[this.net.activities[i].id] = this.net.activities[i];
    }
    this.succIds = {};
    for (i = 0; i < this.net.activities.length; i++) this.succIds[this.net.activities[i].id] = [];
    for (i = 0; i < this.net.activities.length; i++) {
      var a = this.net.activities[i];
      for (var j = 0; j < (a.preds || []).length; j++) {
        if (this.succIds[a.preds[j].id]) this.succIds[a.preds[j].id].push(a.id);
      }
    }

    this.schedule = TO.Events.preroll(this.deck, this.seed, this.difficulty, 90, this.net);
    this.reset();
  }

  Game.prototype.reset = function () {
    var self = this;
    this.week = 1;
    this.day = 0;                       // working-day index at the start of the week
    this.finished = false;
    this.state = {};
    this.net.activities.forEach(function (a) {
      self.state[a.id] = {
        id: a.id,
        remaining: a.work,              // crew-days of work left
        totalWork: a.work,
        startedDay: null,
        finishDay: null,
        addedDelay: 0,                  // event delay days still to burn off
        addedWork: 0,                   // event-added scope
        holdExtra: 0                    // extra days added to a fixed hold
      };
    });
    this.crews = TO.Util.deepClone(this.net.startingCrews);
    this.ot = {};                       // trade -> level
    this.otStreak = {};                 // trade -> consecutive weeks at level>0
    this.mobilized = {};                // trade -> has ever mobilized
    this.onRoster = {};                 // trade -> billing this week
    Object.keys(this.trades).forEach(function (t) {
      self.ot[t] = 0; self.otStreak[t] = 0; self.mobilized[t] = false; self.onRoster[t] = false;
    });
    this.crewHighWater = TO.Util.deepClone(this.net.startingCrews);
    /* ---- cash ----------------------------------------------------
       Profit is the score; cash is how you stay alive long enough to
       collect it. Costs go out weekly. Revenue arrives in monthly
       lumps a month behind the work, minus retainage held to the end.
       The gap lives on a line of credit and the interest is real. */
    this.cashCfg = this.net.cash || null;
    this.cash = 0;
    this.receivables = [];      // { week, amount, label }
    this.billedCum = 0;         // value billed to date
    this.cashHistory = [{ week: 0, cash: 0 }];
    this.minCash = 0;
    this.totalWorkAll = 0;
    this.net.activities.forEach(function (a) { self.totalWorkAll += a.work; });

    /* ---- sub standing --------------------------------------------
       A sub you grind — sustained overtime, joint checks, crews stood
       around with nothing to do — answers the phone slower next time.
       Standing runs 0-100 per trade: 50+ solid, under 50 wary (crew
       orders take an extra week), under 35 burned (they drag, 5%). */
    this.standing = {};
    Object.keys(this.trades).forEach(function (t) { self.standing[t] = 70; });

    this.calls = {};            // callId -> chosen option id
    this.callLog = [];          // resolved calls, for the debrief
    this.unsafeChoices = [];    // anything chosen that should never be chosen
    this.flags = {};            // procurement immunities
    this.crewOrders = [];       // { trade, to, arrivesWeek }  — crews take notice
    this.pourThrough = false;   // this week's weather call
    this.money = {
      labor: 0, gc: 0, events: 0, expedite: 0, hiring: 0, buyout: this.net.fixedCost || 0,
      overtimePremium: 0, changeOrders: 0, ld: 0, bonus: 0,
      financing: 0, retainage: 0
    };
    this.updateRoster();
    this.alloc = {};                    // activityId -> crews
    this.history = [];                  // per-week records
    this.decisions = [];                // annotated decision log
    this.cpHistory = [];                // critical path over time
    this.lastChain = null;
    this.pendingExpedites = [];
    this.autoAllocate();
    var cp = this.computeCPM();
    this.baselineEnd = cp.projectEnd;
    this.lastChain = cp.chain.slice();
    this.cpHistory.push({ week: 0, chain: cp.chain.slice(), projectEnd: cp.projectEnd });
  };

  /* ---- overtime bookkeeping --------------------------------------
     otStreak[t] counts consecutive weeks at level > 0 that are ALREADY
     COMPLETE. The week currently being planned or run adds one more,
     so previews and the live week always agree.                      */
  Game.prototype.effectiveStreak = function (trade, otMap) {
    var lvl = (otMap && otMap[trade] != null) ? otMap[trade] : (this.ot[trade] || 0);
    return (this.otStreak[trade] || 0) + (lvl > 0 ? 1 : 0);
  };

  /* Productivity multiplier for a trade this week (overtime + events). */
  Game.prototype.tradeProductivity = function (trade, includeEvents, otMap) {
    if (!trade) return 1;
    var lvl = (otMap && otMap[trade] != null) ? otMap[trade] : (this.ot[trade] || 0);
    var m = TO.Model.otProductivity(lvl, this.effectiveStreak(trade, otMap));
    if (includeEvents) m *= this.eventProductivityFactor(trade);
    return m;
  };

  Game.prototype.eventProductivityFactor = function (trade) {
    var f = 1;
    (this.activeProd || []).forEach(function (p) {
      if (p.weeksLeft > 0 && p.trades.indexOf(trade) !== -1) f *= p.factor;
    });
    return f;
  };

  /* ---- CPM over the live state ---------------------------------- */
  Game.prototype.computeCPM = function (overrideAlloc, overrideOt, asOfDay) {
    var self = this;
    var alloc = overrideAlloc || this.alloc;
    var ot = overrideOt || this.ot;
    var asOf = asOfDay == null ? this.day : asOfDay;
    var nodes = this.net.activities.map(function (a) {
      var s = self.state[a.id];
      var node = { id: a.id, preds: a.preds || [], dur: 0, minStart: 0 };
      if (s.finishDay !== null) {
        /* Complete: pinned to what actually happened. */
        node.minStart = s.startedDay == null ? s.finishDay : s.startedDay;
        node.dur = (s.finishDay + 1) - node.minStart;
        if (node.dur < 0) node.dur = 0;
      } else if (s.startedDay !== null) {
        /* In progress: elapsed + remaining, anchored to the actual start
           so SS successors still key off the real start date. */
        var rem = self.remainingDuration(a.id, alloc, ot);
        node.minStart = s.startedDay;
        node.dur = (asOf - s.startedDay) + rem;
      } else {
        node.minStart = asOf;
        node.dur = self.remainingDuration(a.id, alloc, ot);
      }
      return node;
    });
    var cpm = TO.CPM.compute(nodes);
    cpm.nodes = nodes;
    return cpm;
  };

  Game.prototype.remainingDuration = function (id, alloc, ot) {
    var a = this.byId[id], s = this.state[id];
    if (s.finishDay !== null) return 0;
    if (a.fixed) return s.remaining + s.holdExtra + s.addedDelay;
    var c = (alloc && alloc[id] != null) ? alloc[id] : (this.alloc[id] || 0);
    if (c <= 0) c = 1;
    c = Math.min(c, a.maxCrews || 1);
    var m = this.tradeProductivity(a.trade, true, ot) * TO.Model.crewOutput(c);
    if (m <= 0) m = 0.1;
    var d = Math.ceil(s.remaining / m);
    return Math.max(1, d) + s.addedDelay;
  };

  /* ---- eligibility ---------------------------------------------- */
  Game.prototype.predsSatisfiedForStart = function (id, day) {
    var a = this.byId[id], ps = a.preds || [];
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i], ps_ = this.state[p.id];
      if (!ps_) continue;
      var lag = p.lag || 0;
      if (p.type === 'SS') {
        if (ps_.startedDay === null) return false;
        if (day < ps_.startedDay + lag) return false;
      } else if (p.type === 'FF') {
        continue;                             // constrains finish, not start
      } else {
        if (ps_.finishDay === null) return false;
        if (day < ps_.finishDay + 1 + lag) return false;
      }
    }
    return true;
  };

  Game.prototype.ffFinishFloor = function (id) {
    var a = this.byId[id], ps = a.preds || [], floor = -Infinity;
    for (var i = 0; i < ps.length; i++) {
      if (ps[i].type !== 'FF') continue;
      var p = this.state[ps[i].id];
      if (!p || p.finishDay === null) return Infinity;      // cannot finish yet at all
      floor = Math.max(floor, p.finishDay + (ps[i].lag || 0));
    }
    return floor;
  };

  /* FF work starts on its CPM-backed continuous-work date: enough time to
     finish at the predecessor's FF floor, never early enough to sit complete
     and bill while it waits.  Before the predecessor is complete we use its
     current deterministic CPM forecast; once complete the committed day
     replaces that forecast. */
  Game.prototype.ffStartFloor = function (id, asOfDay) {
    var a = this.byId[id], ps = a.preds || [], floor = -Infinity;
    for (var i = 0; i < ps.length; i++) {
      if (ps[i].type !== 'FF') continue;
      var p = this.state[ps[i].id];
      if (!p) return Infinity;
      if (p.finishDay === null) {
        var own = this.computeCPM(null, null, asOfDay == null ? this.day : asOfDay).results[id];
        if (!own) return Infinity;
        floor = Math.max(floor, own.es);
      } else {
        floor = Math.max(floor, p.finishDay + (ps[i].lag || 0) - Math.max(0, this.remainingDuration(id) - 1));
      }
    }
    return floor;
  };

  /* Activities that can be worked at some point during a given week. */
  Game.prototype.openActivities = function (weekStartDay) {
    var self = this, out = [];
    var cpm = this.computeCPM();
    this.net.activities.forEach(function (a) {
      var s = self.state[a.id];
      if (s.finishDay !== null) return;
      var r = cpm.results[a.id];
      if (r.es >= weekStartDay + WD_PER_WEEK) return;         // does not open this week
      var opensDay = null;
      for (var d = weekStartDay; d < weekStartDay + WD_PER_WEEK; d++) {
        if (self.predsSatisfiedForStart(a.id, d) && d >= self.ffStartFloor(a.id)) { opensDay = d; break; }
      }
      if (opensDay === null && s.startedDay === null) return;
      out.push({
        id: a.id, act: a, st: s, cpm: r,
        opensDay: opensDay === null ? weekStartDay : opensDay,
        opensOffset: (opensDay === null ? weekStartDay : opensDay) - weekStartDay
      });
    });
    out.sort(function (x, y) { return (x.cpm.tf - y.cpm.tf) || (x.cpm.es - y.cpm.es); });
    return out;
  };

  /* Roll back every downstream activity when rework reopens its source.
     A successor cannot remain "complete" on work that has been removed.
     The traversal is deterministic (network declaration order) and touches
     only descendants, so unrelated parallel work is retained. */
  Game.prototype.invalidateDescendants = function (id) {
    var self = this, seen = {};
    function visit(parent) {
      (self.succIds[parent] || []).forEach(function (child) {
        if (seen[child]) return;
        seen[child] = true;
        var s = self.state[child];
        if (s) {
          s.startedDay = null;
          s.finishDay = null;
          s.remaining = s.totalWork + (s.addedWork || 0);
          s.addedDelay = 0;
          s.holdExtra = 0;
        }
        visit(child);
      });
    }
    visit(id);
    return Object.keys(seen);
  };

  /* Execute the exact writer on a detached clone for UI previews. */
  Game.prototype.previewWeek = function (decision) {
    var copy = new Game({ network: this.net, trades: this.trades, zones: this.zones,
      seed: this.seed, difficulty: this.difficulty, teamName: this.teamName,
      deck: this.deck, calls: this.deckCalls });
    [ 'week', 'day', 'finished', 'state', 'crews', 'ot', 'otStreak', 'mobilized',
      'onRoster', 'crewHighWater', 'cashCfg', 'cash', 'receivables', 'billedCum',
      'cashHistory', 'minCash', 'standing', 'calls', 'callLog', 'unsafeChoices',
      'flags', 'crewOrders', 'pourThrough', 'money', 'alloc', 'history', 'decisions',
      'cpHistory', 'lastChain', 'pendingExpedites', 'schedule' ].forEach(function (k) {
      copy[k] = TO.Util.deepClone(this[k]);
    }, this);
    var record = copy.runWeek(TO.Util.deepClone(decision || {}));
    var projection = copy.project(copy.alloc, copy.ot, 0, copy.crews);
    projection.weekRecord = record;
    projection.effectMoney = TO.Util.deepClone(copy.money);
    projection.effectState = TO.Util.deepClone(copy.state);
    return projection;
  };

  /* ---- auto allocation: critical first, then lowest float -------- */
  Game.prototype.autoAllocate = function () {
    var self = this;
    var open = this.openActivities(this.day);
    var avail = TO.Util.deepClone(this.crews);
    var alloc = {};
    open.forEach(function (o) {
      if (o.act.fixed || !o.act.trade) return;
      var have = avail[o.act.trade] || 0;
      if (have <= 0) return;
      var want = Math.min(o.act.maxCrews || 1, have);
      /* critical work gets what it can use; float work gets one crew */
      if (o.cpm.tf > 0) want = Math.min(want, 1);
      if (want > 0) { alloc[o.id] = want; avail[o.act.trade] = have - want; }
    });
    this.alloc = alloc;
    return alloc;
  };

  /* ---- cash helpers ---------------------------------------------- */
  Game.prototype.progressFrac = function () {
    var self = this, done = 0;
    this.net.activities.forEach(function (a) {
      var st = self.state[a.id];
      var d = a.work - Math.max(0, Math.min(a.work, st.remaining));
      if (st.finishDay !== null) d = a.work;
      done += d;
    });
    return this.totalWorkAll ? done / this.totalWorkAll : 0;
  };

  /* Front-loading the schedule of values bills the early work rich.
     Same total; the money just arrives sooner. */
  Game.prototype.billCurve = function (frac) {
    if (!this.flags.sov_frontload) return frac;
    return Math.min(1, frac * 1.18);
  };

  /* Everything that has actually gone out the door in cash terms:
     weekly costs plus the subcontract buyout drawn as work goes in. */
  Game.prototype.cashOutBase = function () {
    var m = this.money;
    return m.labor + m.gc + m.events + m.expedite + m.hiring +
      (this.net.fixedCost || 0) * this.progressFrac();
  };

  Game.prototype.standingLabel = function (t) {
    var v = this.standing[t] == null ? 70 : this.standing[t];
    return v >= 50 ? 'SOLID' : (v >= 35 ? 'WARY' : 'BURNED');
  };
  Game.prototype.standingFactor = function (t) {
    return (this.standing[t] != null && this.standing[t] < 35) ? 0.95 : 1;
  };
  Game.prototype.crewNotice = function (t) {
    return CREW_NOTICE + ((this.standing[t] != null && this.standing[t] < 50) ? 1 : 0);
  };

  /* ---- roster ----------------------------------------------------
     A trade mobilizes the first week any of its work is ready to
     start and stays on the roster until the last of its activities is
     complete. While it is on the roster it bills every week whether
     or not there is anything for it to do — idle crews still cost
     money, which is the whole reason work-front sequencing matters. */
  Game.prototype.updateRoster = function () {
    var self = this;
    Object.keys(this.trades).forEach(function (t) {
      var acts = self.net.activities.filter(function (a) { return a.trade === t; });
      if (!acts.length) { self.onRoster[t] = false; return; }
      /* On the roster while this trade has a work front that is open:
         something of theirs is in progress, or becomes available to
         start at some point this week. During a genuine gap in their
         work they demobilise and stop billing. */
      var open = acts.some(function (a) {
        var st = self.state[a.id];
        if (st.finishDay !== null) return false;
        if (st.startedDay !== null) return true;
        for (var d = self.day; d < self.day + WD_PER_WEEK; d++) {
          if (self.predsSatisfiedForStart(a.id, d)) return true;
        }
        return false;
      });
      if (open) self.mobilized[t] = true;
      self.onRoster[t] = open;
    });
    return this.onRoster;
  };

  /* ---- labour cost ------------------------------------------------
     Crews are paid for the crew-days they actually work, at the trade's
     daily rate, with the overtime premium applied to worked days. A
     crew that is on the roster with nothing to do still bills at the
     IDLE_RATE — you are carrying it to keep it, and that is exactly
     what makes an unopened work front expensive.

     One consequence worth understanding before you tune anything: total
     labour is roughly proportional to work PERFORMED, so adding a crew
     does not by itself add labour cost. It buys schedule, which buys
     back general conditions and liquidated damages. What adding crews
     DOES cost you is idle days and, past a zone's capacity, the
     crew-days that trade stacking throws away.                        */
  var IDLE_RATE = 0.5;

  Game.prototype.laborCostFor = function (workedCrewDays, idleCrewDays, ot) {
    var self = this, total = 0, premium = 0, idle = 0;
    Object.keys(this.trades).forEach(function (t) {
      var daily = self.trades[t].weekly / 5;
      var lvl = (ot && ot[t] != null) ? ot[t] : (self.ot[t] || 0);
      var mult = TO.Model.otCost(lvl);
      var w = workedCrewDays[t] || 0;
      var i = idleCrewDays[t] || 0;
      total += w * daily * mult + i * daily * IDLE_RATE;
      premium += w * daily * (mult - 1);
      idle += i * daily * IDLE_RATE;
    });
    return { total: total, premium: premium, idle: idle };
  };

  /* Rough weekly burn used by the live preview, before the week runs. */
  Game.prototype.weeklyLaborEstimate = function (ot, crewsOverride, allocOverride) {
    var self = this;
    var crews = crewsOverride || this.crews;
    var alloc = allocOverride || this.alloc;
    var worked = {}, idle = {};
    Object.keys(this.trades).forEach(function (t) {
      var used = 0;
      self.net.activities.forEach(function (a) {
        if (a.trade !== t) return;
        if (self.state[a.id].finishDay !== null) return;
        used += Math.min(alloc[a.id] || 0, a.maxCrews || 1);
      });
      used = Math.min(used, crews[t] || 0);
      worked[t] = used * WD_PER_WEEK;
      idle[t] = self.onRoster[t] ? Math.max(0, (crews[t] || 0) - used) * WD_PER_WEEK : 0;
    });
    return this.laborCostFor(worked, idle, ot);
  };

  /* ---- projection for the live preview --------------------------- */
  Game.prototype.project = function (overrideAlloc, overrideOt, extraCost, crewsOverride) {
    var self = this;
    var cpm = this.computeCPM(overrideAlloc, overrideOt);
    var end = cpm.projectEnd;
    var weeksLeft = Math.max(0, Math.ceil((end - this.day) / WD_PER_WEEK));

    /* Remaining labour = the crew-days of work still to perform at
       each trade's daily rate (with this week's overtime premium where
       it applies), plus an allowance for crews sitting on the roster
       with nothing open in front of them. */
    var crews = crewsOverride || this.crews;
    var labor = 0;
    Object.keys(this.trades).forEach(function (t) {
      var work = 0, last = -1;
      self.net.activities.forEach(function (a) {
        if (a.trade !== t || a.fixed) return;
        var st = self.state[a.id];
        if (st.finishDay !== null) return;
        work += st.remaining;
        var r = cpm.results[a.id];
        if (r) last = Math.max(last, r.ef);
      });
      if (work <= 0 && last < 0) return;
      var daily = self.trades[t].weekly / 5;
      var lvl = (overrideOt && overrideOt[t] != null) ? overrideOt[t] : 0;
      labor += work * daily * TO.Model.otCost(lvl) * (crews[t] > 1 ? (crews[t] / TO.Model.crewOutput(crews[t])) : 1);
      /* idle allowance: roster span minus the days the work itself needs */
      var span = Math.max(0, last - self.day);
      var busy = work / Math.max(0.5, TO.Model.crewOutput(Math.max(1, crews[t] || 1)));
      labor += Math.max(0, span - busy) * (crews[t] || 0) * daily * 0.5;
    });
    var gcDays = TO.Util.calDays(end) - TO.Util.calDays(this.day);
    var gc = gcDays * this.net.gcPerCalendarDay;
    var spent = this.spentToDate();
    var lateCal = TO.Util.calDays(end) - TO.Util.calDays(this.net.contractWorkingDays);
    var ld = lateCal > 0 ? lateCal * this.net.ldPerCalendarDay : 0;
    var bonus = lateCal < 0 ? Math.min(-lateCal, this.net.earlyBonusCapDays) * this.net.earlyBonusPerCalendarDay : 0;
    var profit = this.net.contractValue + this.money.changeOrders
      - (spent + labor + gc + (extraCost || 0)) - ld + bonus - (this.money.financing || 0);
    return {
      cpm: cpm, projectEnd: end, weeksLeft: weeksLeft,
      finishDate: TO.Util.fmtDate(this.net.startDate, end),
      lateCalendarDays: lateCal, ld: ld, bonus: bonus,
      projectedProfit: profit, projectedCost: spent + labor + gc + (extraCost || 0)
    };
  };

  Game.prototype.spentToDate = function () {
    var m = this.money;
    return m.labor + m.gc + m.events + m.expedite + m.hiring + m.buyout;
  };

  /* =================================================================
     CALLS
     A call is offered in the week its subject activity opens, and it
     stays open until answered or until that activity starts. Its
     consequence lands later, at `resolveAt`.
     ================================================================= */
  Game.prototype.callsDeck = function () {
    var self = this;
    return (this.deckCalls || []).filter(function (c) { return c.project === self.net.id; });
  };

  Game.prototype.openCalls = function () {
    var self = this, cpm = this.computeCPM(), out = [];
    this.callsDeck().forEach(function (c) {
      if (self.calls[c.id]) return;                       // already answered
      var st = self.state[c.offerAt];
      if (!st) return;
      if (st.finishDay !== null) return;                  // the moment has passed
      var r = cpm.results[c.offerAt];
      if (!r) return;
      /* offered once the work is within sight: it opens this week, or
         it has already started and you are still deciding */
      if (r.es < self.day + WD_PER_WEEK * 2 || st.startedDay !== null) out.push(c);
    });
    return out;
  };

  /* The roll a call will be judged against. Identical for every team
     on a seed; the option you pick sets the bar it has to clear. */
  Game.prototype.callRoll = function (callId) {
    return TO.Util.labelRoll(this.seed, 'call:' + callId);
  };

  Game.prototype.applyCallChoice = function (callId, optionId) {
    var call = null, self = this;
    this.callsDeck().forEach(function (c) { if (c.id === callId) call = c; });
    if (!call || this.calls[callId]) return null;
    var opt = null;
    call.options.forEach(function (o) { if (o.id === optionId) opt = o; });
    if (!opt) opt = call.options[0];

    this.calls[callId] = opt.id;
    if (opt.cost) this.money.events += opt.cost;
    if (opt.delay) {
      var st = this.state[call.offerAt];
      if (st && st.finishDay === null) st.addedDelay += opt.delay;
    }
    if (opt.sets) this.flags[opt.sets] = true;

    var entry = {
      week: this.week, id: call.id, title: call.title,
      option: opt.label, cost: opt.cost || 0, delay: opt.delay || 0,
      risk: opt.risk || 0, roll: this.callRoll(call.id),
      procurement: !!call.procurement, resolved: false, failed: null,
      /* An option that is unsafe or unlawful is recorded as such the
         moment it is chosen, and reported at the end whether or not it
         happened to work. Getting away with it is not vindication. */
      unsafe: !!opt.unsafe, unsafeWhy: opt.unsafeWhy || null
    };
    if (opt.unsafe) this.unsafeChoices = (this.unsafeChoices || []).concat([entry]);
    this.callLog.push(entry);
    return entry;
  };

  /* A call that is never answered has to take effect at the moment the
     work it is about begins — that is when the decision really got
     made, by default. Applying it later (at the reveal) would mean the
     free option's cost and days landed on work already in the ground,
     which quietly made ignoring a call free. */
  Game.prototype.defaultCallsFor = function (activityId, notes) {
    var self = this;
    this.callsDeck().forEach(function (c) {
      if (c.offerAt !== activityId || self.calls[c.id]) return;
      var e = self.applyCallChoice(c.id, c.options[0].id);
      if (e && notes) notes.push({ good: false, text: 'Nobody made the call on ' + c.title +
        ' — so the default happened: ' + e.option + '.' });
    });
  };

  /* Resolve any call whose reveal activity is starting now. */
  Game.prototype.resolveCallsAt = function (activityId, notes) {
    var self = this;
    this.callsDeck().forEach(function (c) {
      if (c.resolveAt !== activityId) return;
      var chosen = self.calls[c.id];
      var entry = null;
      for (var i = 0; i < self.callLog.length; i++) {
        if (self.callLog[i].id === c.id) entry = self.callLog[i];
      }
      if (!chosen) {                       // never answered — the default happened
        entry = self.applyCallChoice(c.id, c.options[0].id);
      }
      if (!entry || entry.resolved) return;
      entry.resolved = true;
      var failed = entry.roll < entry.risk;
      entry.failed = failed;
      if (!failed) {
        notes.push({ good: true, text: (c.pass || 'That call worked out.') +
          ' [' + c.title + ' — you chose: ' + entry.option + ']' });
        return;
      }
      var f = c.fail;
      if (!f) return;
      if (f.hold && self.state[f.hold] && self.state[f.hold].finishDay === null) {
        self.state[f.hold].holdExtra += f.days;
      }
      if (f.rework) {
        f.rework.forEach(function (id) {
          var st = self.state[id];
          if (!st) return;
          if (st.finishDay !== null) {     // already built — it has to come back out
            st.finishDay = null;
            st.remaining = f.days;
          } else {
            st.remaining += f.days;
          }
          self.invalidateDescendants(id);
        });
      }
      if (f.payDelay) {
        self.receivables.forEach(function (r) { r.week += f.payDelay; });
        self._payDelayed = (self._payDelayed || 0) + f.payDelay;
      }
      if (f.cost) self.money.events += f.cost;
      notes.push({ good: false, text: f.text +
        ' [' + c.title + ' — you chose: ' + entry.option + ']' });
    });
  };

  /* ---- this week's news ------------------------------------------ */
  Game.prototype.weekEvents = function (week) {
    var w = this.schedule.weeks[(week || this.week) - 1];
    return w ? w.events : [];
  };

  /* =================================================================
     COMMIT — run one project week. No undo.
     ================================================================= */
  Game.prototype.runWeek = function (decision) {
    if (this.finished) return null;
    var self = this;
    decision = decision || {};
    var events = this.weekEvents(this.week);

    /* ---- 1. apply decisions --------------------------------------- */
    /* Overtime level applies to this week. The streak is only rolled
       forward once the week is actually in the books (step 6), so a
       preview and the week it previews always use the same numbers. */
    Object.keys(this.trades).forEach(function (t) { self.ot[t] = 0; });
    if (decision.ot) {
      Object.keys(decision.ot).forEach(function (t) {
        if (self.ot[t] != null) self.ot[t] = decision.ot[t] | 0;
      });
    }
    /* Crews arriving this week, ordered two weeks ago. */
    var arrivals = [];
    this.crewOrders = this.crewOrders.filter(function (o) {
      if (o.arrivesWeek > self.week) return true;
      self.crews[o.trade] = o.to;
      arrivals.push({ trade: o.trade, to: o.to });
      return false;
    });

    /* New manpower decisions. Releasing a crew is immediate and free —
       you can always send people home. Adding one takes CREW_NOTICE
       weeks, because the sub has to find the bodies, so manpower is a
       forecast rather than a reaction. */
    if (decision.crews) {
      Object.keys(decision.crews).forEach(function (t) {
        if (self.crews[t] == null) return;
        var max = self.net.maxHire[t] == null ? 1 : self.net.maxHire[t];
        var want = Math.max(0, Math.min(max, decision.crews[t] | 0));
        var have = self.crews[t] || 0;
        var onOrder = 0;
        self.crewOrders.forEach(function (o) { if (o.trade === t) onOrder = Math.max(onOrder, o.to); });
        if (want <= have) {
          self.crews[t] = want;                        // release: immediate
          self.crewOrders = self.crewOrders.filter(function (o) { return o.trade !== t; });
          return;
        }
        if (want === (onOrder || have)) return;        // already on order
        self.crewOrders = self.crewOrders.filter(function (o) { return o.trade !== t; });
        self.crewOrders.push({ trade: t, to: want, arrivesWeek: self.week + self.crewNotice(t) });
        var hw = self.crewHighWater[t] || 0;
        if (want > hw) {
          self.money.hiring += (want - hw) * Math.round(self.trades[t].weekly * 0.60);
          self.crewHighWater[t] = want;
        }
      });
    }

    /* Calls answered this week. */
    var callNotes = [];
    if (decision.calls) {
      Object.keys(decision.calls).forEach(function (cid) {
        var e = self.applyCallChoice(cid, decision.calls[cid]);
        if (e) callNotes.push({ good: true, text: 'Called it: ' + e.title + ' — ' + e.option +
          (e.cost ? ' (' + TO.Util.money(e.cost) + ')' : '') + (e.delay ? ' (+' + e.delay + ' wd)' : '') });
      });
    }
    if (decision.alloc) this.alloc = TO.Util.deepClone(decision.alloc);
    this.updateRoster();

    /* expedite purchases */
    var expediteNotes = [];
    (decision.expedite || []).forEach(function (evId) {
      var ev = null;
      for (var i = 0; i < events.length; i++) if (events[i].id === evId) ev = events[i];
      if (!ev || !ev.expedite) return;
      self.money.expedite += ev.expedite.fee;
      ev._expedited = true;
      expediteNotes.push(ev.expedite.label + ' — ' + TO.Util.money(ev.expedite.fee));
      /* a joint check keeps the material moving and humiliates the sub */
      if (ev.id === 's-drywall') self.standing.drywall = Math.max(0, (self.standing.drywall || 70) - 10);
    });

    /* ---- 2. apply this week's events ------------------------------ */
    this.activeProd = (this.activeProd || []).filter(function (p) { return p.weeksLeft > 0; });
    var rainDays = 0, rainAffects = null, newsEffects = [];

    events.forEach(function (ev) {
      if (ev.cat === 'weather') {
        rainDays = ev.rainActual;
        rainAffects = ev.affects;
        if (rainDays > 0) {
          newsEffects.push(rainDays + ' rain day' + (rainDays === 1 ? '' : 's') +
            (ev.affects ? ' affecting ' + ev.affects.join(', ') : ' on weather-exposed work'));
        }
      }
      if (ev.delay && ev.blockedBy && self.flags[ev.blockedBy]) {
        newsEffects.push('no impact — you bought that package out early');
        return;
      }
      if (ev.delay) {
        var days = ev.delay.days - (ev._expedited ? ev.expedite.recover : 0);
        days = Math.max(0, days);
        /* A late delivery hits the NEXT piece of work that needs it, not
           every future activity on the list. The target list is a
           priority order; the first activity still outstanding takes it. */
        var hit = null;
        for (var ti = 0; ti < ev.delay.targets.length && !hit; ti++) {
          var st = self.state[ev.delay.targets[ti]];
          if (st && st.finishDay === null) hit = ev.delay.targets[ti];
        }
        if (!hit) {
          var known = ev.delay.targets.filter(function (id) { return self.byId[id]; });
          var lastName = known.length ? self.byId[known[known.length - 1]].name : 'that work';
          newsEffects.push('No impact — ' + lastName + ' is already complete. You are ahead of this one.');
        }
        else if (days === 0) newsEffects.push('delay on ' + hit + ' fully recovered by expediting');
        else {
          self.state[hit].addedDelay += days;
          newsEffects.push('+' + days + ' day' + (days === 1 ? '' : 's') + ' to ' + hit);
        }
      }
      if (ev.holdExtend) {
        var hits2 = [];
        ev.holdExtend.targets.forEach(function (id) {
          var s = self.state[id];
          if (!s || s.finishDay !== null) return;
          s.holdExtra += ev.holdExtend.days;
          hits2.push(id);
        });
        if (hits2.length) newsEffects.push('+' + ev.holdExtend.days + ' days on hold ' + hits2.join(', '));
        else newsEffects.push('No impact — that inspection is already behind you.');
      }
      if (ev.bonus) {
        var gain = null;
        for (var bi = 0; bi < ev.bonus.targets.length && !gain; bi++) {
          var bs = self.state[ev.bonus.targets[bi]];
          if (bs && bs.finishDay === null) gain = ev.bonus.targets[bi];
        }
        if (gain) {
          var gs = self.state[gain];
          if (gs.addedDelay > 0) gs.addedDelay = Math.max(0, gs.addedDelay - ev.bonus.days);
          else gs.remaining = Math.max(0, gs.remaining - ev.bonus.days);
          newsEffects.push('picked up ' + ev.bonus.days + ' days on ' + gain);
        }
      }
      if (ev.productivity) {
        self.activeProd.push({
          trades: ev.productivity.trades.slice(),
          factor: ev.productivity.factor,
          weeksLeft: ev.productivity.weeks,
          from: ev.title
        });
        newsEffects.push(Math.round((1 - ev.productivity.factor) * 100) + '% productivity loss for ' +
          ev.productivity.trades.join(', ') + ' (' + ev.productivity.weeks + ' wk)');
      }
      if (ev.cost)    { self.money.events += ev.cost; newsEffects.push(TO.Util.money(ev.cost) + ' cost — ' + (ev.costNote || 'event cost')); }
      if (ev.revenue) { self.money.changeOrders += ev.revenue; newsEffects.push('+' + TO.Util.money(ev.revenue) + ' change order revenue'); }
    });

    /* ---- 3. run the five working days ----------------------------- */
    var dayLog = [];
    var idleCrewDays = {};
    var workedCrewDays = {};
    var stackedZones = {};

    var blockedNotes = {};

    /* THE WEATHER CALL. By default weather-exposed work stands down on
       a rain day. Working through it buys the days back at reduced
       productivity and risks placing concrete you will have to take
       back out. The roll is seeded per week, identical for everyone. */
    var pourThrough = !!decision.pourThrough && rainDays > 0;
    var pourDamage = false, pourRisk = 0;
    if (pourThrough) {
      this.money.events += Math.round(rainDays * 2600);
      /* Exposure scales with how long you keep working in it. Pushing
         through a one-day blip is a different decision from pushing
         through a three-day washout, and the game should not price
         them the same. */
      pourRisk = Math.min(0.62, 0.16 * rainDays);
      pourDamage = TO.Util.labelRoll(this.seed, 'wx:' + this.week) < pourRisk;
    }

    for (var k = 0; k < WD_PER_WEEK; k++) {
      var d = this.day + k;
      var isRain = (k < rainDays);

      /* --- who is physically able to be worked today --------------- */
      var ready = [];
      this.net.activities.forEach(function (a) {
        var s = self.state[a.id];
        if (s.finishDay !== null) return;
        if (s.startedDay === null && (!self.predsSatisfiedForStart(a.id, d) || d < self.ffStartFloor(a.id, d))) return;
        ready.push({ a: a, s: s });
      });

      /* --- unanswered calls take their default now --------------- */
      ready.forEach(function (w) { self.defaultCallsFor(w.a.id, callNotes); });

      /* --- event delay days burn off once the work front is open --- */
      var progressing = [];
      ready.forEach(function (w) {
        if (w.s.remaining <= 1e-9 && !w.a.fixed) {
          /* FF work may have used its exact productive days before the
             contractual finish floor; close it when that floor arrives
             without assigning or billing a crew again. */
          if (d >= self.ffFinishFloor(w.a.id)) w.s.finishDay = d;
          return;
        }
        if (w.s.addedDelay > 0) {
          w.s.addedDelay -= 1;
          blockedNotes[w.a.id] = (blockedNotes[w.a.id] || 0) + 1;
          return;
        }
        if (w.a.fixed) { progressing.push({ a: w.a, s: w.s, crews: 0 }); return; }
        var c = self.alloc[w.a.id] || 0;
        if (c <= 0) return;
        progressing.push({ a: w.a, s: w.s, crews: Math.min(c, w.a.maxCrews || 1) });
      });

      /* --- zone loading -> trade stacking -------------------------- */
      var zoneLoad = {};
      progressing.forEach(function (w) {
        if (!w.crews) return;
        zoneLoad[w.a.zone] = (zoneLoad[w.a.zone] || 0) + w.crews;
      });
      Object.keys(zoneLoad).forEach(function (z) {
        var cap = self.zones[z] ? self.zones[z].cap : 2;
        if (zoneLoad[z] > cap) stackedZones[z] = Math.max(stackedZones[z] || 0, zoneLoad[z]);
      });

      /* --- progress ------------------------------------------------ */
      progressing.forEach(function (w) {
        var a = w.a, s = w.s;

        if (a.fixed) {
          /* NON-COMPRESSIBLE. Cure time and inspection holds burn one
             working day per working day. No crew count, no overtime
             level and no expediting fee touches this — the check sits
             here, at the only place progress is ever made, so there is
             no path around it. Weather does not stop it either. */
          if (s.startedDay === null) { s.startedDay = d; self.resolveCallsAt(a.id, callNotes); }
          if (s.holdExtra > 0) s.holdExtra -= 1;
          else if (s.remaining > 0) s.remaining -= 1;
          if (s.remaining <= 0 && s.holdExtra <= 0) {
            s.remaining = 0;
            if (d >= self.ffFinishFloor(a.id)) s.finishDay = d;
          }
          return;
        }

        var rainedOn = isRain && a.weather && (!rainAffects || rainAffects.indexOf(a.trade) !== -1);
        if (rainedOn && !pourThrough) return;      // stood down — weather-flagged work only

        var cap = self.zones[a.zone] ? self.zones[a.zone].cap : 2;
        var sf = TO.Model.stackFactor(zoneLoad[a.zone] || w.crews, cap);
        var pm = TO.Model.otProductivity(self.ot[a.trade] || 0, self.effectiveStreak(a.trade));
        var ef = self.eventProductivityFactor(a.trade) * self.standingFactor(a.trade);
        var rate = TO.Model.crewOutput(w.crews) * sf * pm * ef;
        if (rainedOn) rate *= 0.7;                 // working wet is slower
        if (rate <= 0) return;

        if (s.startedDay === null) { s.startedDay = d; self.resolveCallsAt(a.id, callNotes); }
        s.remaining -= rate;
        if (s.remaining <= 1e-9) {
          s.remaining = 0;
          if (d >= self.ffFinishFloor(a.id)) s.finishDay = d;
        }
      });

      /* --- crew-days worked, and idle crews that still bill --------- */
      Object.keys(this.trades).forEach(function (t) {
        var used = 0;
        progressing.forEach(function (w) { if (w.a.trade === t) used += w.crews; });
        if (used > 0) workedCrewDays[t] = (workedCrewDays[t] || 0) + used;
        if (!self.onRoster[t]) return;
        var idle = (self.crews[t] || 0) - used;
        if (idle > 0) idleCrewDays[t] = (idleCrewDays[t] || 0) + idle;
      });

      /* --- general conditions burn on calendar days ---------------- */
      this.money.gc += (TO.Util.calDays(d + 1) - TO.Util.calDays(d)) * this.net.gcPerCalendarDay;

      dayLog.push({ day: d, rain: isRain, working: progressing.length });
    }

    /* Working through the weather has a price beyond the pumping. */
    if (pourDamage) {
      var hit = null;
      this.net.activities.forEach(function (a) {
        if (hit || !a.weather || a.trade !== 'concrete') return;
        var st = self.state[a.id];
        if (st.startedDay !== null && st.finishDay === null) hit = a.id;
      });
      if (hit) {
        self.state[hit].remaining += 2;
        this.money.events += 5200;
        callNotes.push({ good: false, text: 'The pour you pushed through the rain came out badly — ' +
          'two days of ' + hit + ' to take out and replace, and ' + TO.Util.money(5200) + ' to do it.' });
      } else {
        callNotes.push({ good: true, text: 'Worked through the weather and got away with it.' });
      }
    } else if (pourThrough) {
      callNotes.push({ good: true, text: 'Worked through the rain. Slower going, but the days are in the bank.' });
    }

    /* ---- 4. costs -------------------------------------------------- */
    var lab = this.laborCostFor(workedCrewDays, idleCrewDays);
    this.money.labor += lab.total;
    this.money.overtimePremium += lab.premium;
    this.money.idle = (this.money.idle || 0) + lab.idle;

    /* ---- 4b. cash ------------------------------------------------- */
    var cashNotes = [];
    if (this.cashCfg) {
      var cfg = this.cashCfg;
      var outNow = this.cashOutBase();
      var outflow = outNow - (this._cashOutPrev == null ? 0 : this._cashOutPrev);
      this._cashOutPrev = outNow;
      this.cash -= outflow;

      /* receivables that land this week */
      this.receivables = this.receivables.filter(function (r) {
        if (r.week > self.week) return true;
        self.cash += r.amount;
        cashNotes.push({ good: true, text: r.label + ' — ' + TO.Util.money(r.amount) + ' hit the account.' });
        return false;
      });

      /* monthly pay application */
      if (this.week % cfg.billingWeeks === 0) {
        var value = this.net.contractValue + this.money.changeOrders;
        var earned = this.billCurve(this.progressFrac()) * value;
        var billNow = Math.max(0, earned - this.billedCum);
        if (billNow > 500) {
          this.billedCum += billNow;
          var ret = billNow * cfg.retainage;
          this.money.retainage += ret;
          this.receivables.push({
            week: this.week + cfg.payLagWeeks, amount: billNow - ret,
            label: 'Pay application #' + Math.round(this.week / cfg.billingWeeks) + ' paid'
          });
          cashNotes.push({ good: true, text: 'Pay application #' + Math.round(this.week / cfg.billingWeeks) +
            ' submitted — ' + TO.Util.money(billNow) + ' billed, ' + TO.Util.money(ret) +
            ' held as retainage, payment due wk ' + (this.week + cfg.payLagWeeks) + '.' });
        }
      }

      /* the line of credit is not free */
      if (this.cash < 0) {
        var interest = -this.cash * cfg.locRatePerWeek;
        this.money.financing += interest;
        this.cash -= interest;
        cashNotes.push({ good: false, text: 'Carried ' + TO.Util.money(-this.cash) +
          ' on the line of credit — ' + TO.Util.money(interest) + ' interest.' });
      }
      this.minCash = Math.min(this.minCash, this.cash);
      this.cashHistory.push({ week: this.week, cash: this.cash });
    }

    /* ---- 4c. sub standing ------------------------------------------ */
    var standingNotes = [];
    Object.keys(this.trades).forEach(function (t) {
      if (self.standing[t] == null) return;
      var before = self.standing[t];
      var lvl = self.ot[t] || 0;
      var hit = 0;
      if (lvl === 2) hit -= 8;
      else if (lvl === 1 && (self.otStreak[t] || 0) >= 1) hit -= 4;
      if ((idleCrewDays[t] || 0) >= 3) hit -= 3;
      if (hit === 0 && self.onRoster[t]) hit = 2;
      self.standing[t] = Math.max(0, Math.min(85, before + hit));
      var was = before >= 50 ? 2 : (before >= 35 ? 1 : 0);
      var now = self.standing[t] >= 50 ? 2 : (self.standing[t] >= 35 ? 1 : 0);
      if (now < was) {
        standingNotes.push({ good: false, text: self.trades[t].name + ' is ' +
          (now === 1 ? 'getting wary of this job — their next crew takes an extra week to show up.'
                     : 'burned out on you. They answer slower and they work like it.') });
      } else if (now > was) {
        standingNotes.push({ good: true, text: self.trades[t].name + ' is back to taking your calls first.' });
      }
    });

    /* ---- 5. decay event productivity effects ----------------------- */
    this.activeProd.forEach(function (p) { p.weeksLeft -= 1; });
    this.activeProd = this.activeProd.filter(function (p) { return p.weeksLeft > 0; });

    /* ---- 6. advance ------------------------------------------------ */
    this.pourThrough = false;
    /* Roll the overtime streak forward now that the week is in the books. */
    Object.keys(this.trades).forEach(function (t) {
      if ((self.ot[t] || 0) > 0) self.otStreak[t] = (self.otStreak[t] || 0) + 1;
      else self.otStreak[t] = 0;
    });
    this.day += WD_PER_WEEK;
    this.updateRoster();
    var allDone = this.net.activities.every(function (a) { return self.state[a.id].finishDay !== null; });

    var cpm = this.computeCPM();
    var chainChanged = false, movedTo = null;
    if (this.lastChain) {
      var before = this.lastChain.join('>');
      if (before !== cpm.chain.join('>')) {
        chainChanged = true;
        var prev = {};
        this.lastChain.forEach(function (id) { prev[id] = true; });
        for (var ci = 0; ci < cpm.chain.length; ci++) {
          var id2 = cpm.chain[ci];
          if (!prev[id2] && self.state[id2].finishDay === null) { movedTo = id2; break; }
        }
      }
    }
    this.lastChain = cpm.chain.slice();
    this.cpHistory.push({ week: this.week, chain: cpm.chain.slice(), projectEnd: cpm.projectEnd });

    var record = {
      week: this.week,
      events: events,
      newsEffects: newsEffects,
      callNotes: callNotes,
      cashNotes: cashNotes,
      standingNotes: standingNotes,
      cash: this.cash,
      standing: TO.Util.deepClone(this.standing),
      unsafeChosen: (this.unsafeChoices || []).filter(function (e) { return e.week === self.week; }),
      arrivals: arrivals,
      pourThrough: pourThrough,
      expediteNotes: expediteNotes,
      rainDays: rainDays,
      dayLog: dayLog,
      idleCrewDays: idleCrewDays,
      workedCrewDays: workedCrewDays,
      stackedZones: stackedZones,
      blockedNotes: blockedNotes,
      laborCost: lab.total,
      otPremium: lab.premium,
      idleCost: lab.idle,
      projectEnd: cpm.projectEnd,
      chain: cpm.chain.slice(),
      chainChanged: chainChanged,
      movedTo: movedTo,
      ot: TO.Util.deepClone(this.ot),
      crews: TO.Util.deepClone(this.crews),
      roster: TO.Util.deepClone(this.onRoster),
      alloc: TO.Util.deepClone(this.alloc),
      completed: this.net.activities.filter(function (a) {
        return self.state[a.id].finishDay !== null && self.state[a.id].finishDay >= self.day - WD_PER_WEEK;
      }).map(function (a) { return a.id; })
    };
    this.history.push(record);

    if (allDone) this.finish();
    else this.week += 1;

    return record;
  };

  Game.prototype.finish = function () {
    var self = this;
    this.finished = true;
    var end = 0;
    this.net.activities.forEach(function (a) {
      var f = self.state[a.id].finishDay;
      if (f !== null) end = Math.max(end, f + 1);
    });
    this.finishWorkingDay = end;
    var lateCal = TO.Util.calDays(end) - TO.Util.calDays(this.net.contractWorkingDays);
    this.lateCalendarDays = lateCal;
    this.money.ld = lateCal > 0 ? lateCal * this.net.ldPerCalendarDay : 0;
    this.money.bonus = lateCal < 0
      ? Math.min(-lateCal, this.net.earlyBonusCapDays) * this.net.earlyBonusPerCalendarDay : 0;

    /* true-up general conditions to the actual completion day */
    this.money.gc = TO.Util.calDays(end) * this.net.gcPerCalendarDay;

    /* ---- closeout cash ---------------------------------------------
       The final application and the retainage arrive after the ribbon
       is cut, and the line of credit keeps charging until they do. */
    if (this.cashCfg) {
      var cfg2 = this.cashCfg;
      var value2 = this.net.contractValue + this.money.changeOrders;
      var finalBill = Math.max(0, value2 - this.billedCum);
      this.billedCum = value2;
      var finalRet = finalBill * cfg2.retainage;
      this.money.retainage += finalRet;
      this.receivables.push({ week: this.week + cfg2.payLagWeeks, amount: finalBill - finalRet, label: 'Final application paid' });
      this.receivables.push({ week: this.week + cfg2.payLagWeeks + cfg2.retainageLagWeeks, amount: this.money.retainage, label: 'Retainage released' });

      /* settle LDs / bonus / remaining costs into cash, then run the
         tail weeks until everything is collected */
      var outNow2 = this.cashOutBase();
      this.cash -= outNow2 - (this._cashOutPrev == null ? 0 : this._cashOutPrev);
      this._cashOutPrev = outNow2;
      this.cash -= this.money.ld;
      this.cash += this.money.bonus;

      var wk2 = this.week, guard2 = 0;
      while (this.receivables.length && guard2++ < 30) {
        wk2++;
        this.receivables = this.receivables.filter(function (r) {
          if (r.week > wk2) return true;
          self.cash += r.amount; return false;
        });
        if (this.cash < 0) {
          var int2 = -this.cash * cfg2.locRatePerWeek;
          this.money.financing += int2;
          this.cash -= int2;
        }
        this.minCash = Math.min(this.minCash, this.cash);
        this.cashHistory.push({ week: wk2, cash: this.cash });
      }
      this.money.retainage = 0;
    }

    this.profit = this.net.contractValue + this.money.changeOrders
      - this.money.labor - this.money.gc - this.money.events
      - this.money.expedite - this.money.hiring - this.money.buyout
      - this.money.financing
      - this.money.ld + this.money.bonus;
    return this.profit;
  };

  Game.prototype.currentProfit = function () {
    if (this.finished) return this.profit;
    return this.project().projectedProfit;
  };

  return { Game: Game, WD_PER_WEEK: WD_PER_WEEK };
})();

/* ===================================================================
   BASELINE — the "no intervention" run.
   Straight time, starting crews, auto allocation, never expedite.
   Used by the debrief so a team can see what doing nothing would
   have cost them.
   =================================================================== */
TO.Baseline = function (opts) {
  var g = new TO.Game.Game(opts);
  var guard = 0;
  while (!g.finished && guard++ < 200) {
    g.autoAllocate();
    g.runWeek({ alloc: g.alloc });
  }
  return {
    weeks: g.week,
    finishWorkingDay: g.finishWorkingDay,
    lateCalendarDays: g.lateCalendarDays,
    profit: g.profit,
    money: g.money,
    cpHistory: g.cpHistory
  };
};

/* ===================================================================
   SELF-TESTS
   The same suite runs in node (`node src/engine.js --test`) and in the
   browser from the Instructor menu, so the class can watch the CPM
   engine check itself against the hand calculation.
   =================================================================== */
TO.SelfTest = (function () {

  function runSelfTests(D) {
    D = D || (typeof module !== 'undefined' && module.exports ? require('./data.js') : {
      TRADES: TRADES, ZONES: ZONES, MAIN_NETWORK: MAIN_NETWORK,
      TUTORIAL_NETWORK: TUTORIAL_NETWORK, TUTORIAL_EXPECTED_CPM: TUTORIAL_EXPECTED_CPM,
      EVENT_DECK: EVENT_DECK, CALLS: CALLS
    });

    var results = [];
    function t(name, fn) {
      try {
        var r = fn();
        if (r === true || r === undefined) results.push({ name: name, pass: true });
        else results.push({ name: name, pass: false, detail: String(r) });
      } catch (e) {
        results.push({ name: name, pass: false, detail: e.message });
      }
    }

    /* ---------- 1. CPM vs the hand calculation -------------------- */
    var tut = D.TUTORIAL_NETWORK;
    var tutNodes = tut.activities.map(function (a) {
      return { id: a.id, dur: a.work, minStart: 0, preds: a.preds || [] };
    });
    var cpm = TO.CPM.compute(tutNodes);

    D.TUTORIAL_EXPECTED_CPM.forEach(function (row) {
      var id = row[0], r = cpm.results[id];
      t('CPM ' + id + ' matches hand calc (ES/EF/LS/LF/TF/FF)', function () {
        if (!r) return 'missing';
        var got = [r.es, r.ef, r.ls, r.lf, r.tf, r.ff];
        var exp = row.slice(1);
        for (var i = 0; i < 6; i++) {
          if (got[i] !== exp[i]) {
            return 'expected [' + exp.join(',') + '] got [' + got.join(',') + ']';
          }
        }
        return true;
      });
    });
    t('CPM tutorial project duration is 29 working days', function () {
      return cpm.projectEnd === 29 || 'got ' + cpm.projectEnd;
    });
    t('CPM tutorial critical path runs T1-T2-T3-T4-T8-T9-T10', function () {
      var got = cpm.chain.join('-');
      return got === 'T1-T2-T3-T4-T8-T9-T10' || 'got ' + got;
    });
    t('CPM tutorial: T5 is the only activity with total float', function () {
      var withFloat = Object.keys(cpm.results).filter(function (k) { return cpm.results[k].tf > 0; });
      return (withFloat.length === 1 && withFloat[0] === 'T5') || 'got ' + withFloat.join(',');
    });

    /* ---------- 2. float consumption shifts the critical path ------ */
    t('Delaying a float activity past its float SHIFTS the critical path', function () {
      /* T5 has 3 days of float. Add 3 -> still not critical-driving.
         Add 5 -> T5 must now drive T6, and the path must move. */
      function chainWith(extra) {
        var nodes = tut.activities.map(function (a) {
          return {
            id: a.id, dur: a.work + (a.id === 'T5' ? extra : 0),
            minStart: 0, preds: a.preds || []
          };
        });
        return TO.CPM.compute(nodes);
      }
      var base = chainWith(0);
      var pushed = chainWith(5);
      if (base.chain.indexOf('T5') !== -1) return 'T5 was already critical in the baseline';
      if (pushed.chain.indexOf('T5') === -1) return 'T5 did not become critical after consuming its float';
      if (pushed.results.T5.tf !== 0) return 'T5 total float is ' + pushed.results.T5.tf + ', expected 0';
      if (pushed.chain.join('-') === base.chain.join('-')) return 'critical path did not change';
      /* and the old driving branch must have gained float */
      if (pushed.results.T8.tf <= 0) return 'T8 should now carry float, has ' + pushed.results.T8.tf;
      return true;
    });

    /* ---------- 3. non-compressible lags --------------------------- */
    t('No acceleration shortens a concrete cure or an inspection hold', function () {
      var g = new TO.Game.Game({
        network: D.MAIN_NETWORK, trades: D.TRADES, zones: D.ZONES,
        deck: D.EVENT_DECK, calls: D.CALLS, seed: 'CURE-TEST', difficulty: 'easy'
      });
      var fixed = D.MAIN_NETWORK.activities.filter(function (a) { return a.fixed; });
      if (!fixed.length) return 'no fixed activities defined';
      for (var i = 0; i < fixed.length; i++) {
        var a = fixed[i];
        /* max crews, max overtime, every allocation trick */
        var alloc = {}; alloc[a.id] = 99;
        var ot = {}; Object.keys(D.TRADES).forEach(function (tr) { ot[tr] = 2; });
        var d1 = g.remainingDuration(a.id, alloc, ot);
        var d0 = g.remainingDuration(a.id, {}, {});
        if (d1 !== d0) return a.id + ': duration changed from ' + d0 + ' to ' + d1 + ' under acceleration';
        if (d0 !== a.work) return a.id + ': duration ' + d0 + ' != authored ' + a.work;
      }
      return true;
    });

    t('A fixed hold burns exactly one day per working day in simulation', function () {
      var g = new TO.Game.Game({
        network: D.TUTORIAL_NETWORK, trades: D.TRADES, zones: D.ZONES,
        deck: D.EVENT_DECK, calls: D.CALLS, seed: 'CURE-SIM', difficulty: 'easy'
      });
      /* Force T4 (4-day cure) to be the only thing that matters. */
      g.state.T1.finishDay = 0; g.state.T1.startedDay = 0; g.state.T1.remaining = 0;
      g.state.T2.finishDay = 1; g.state.T2.startedDay = 1; g.state.T2.remaining = 0;
      g.state.T3.finishDay = 2; g.state.T3.startedDay = 2; g.state.T3.remaining = 0;
      g.day = 3;
      var ot = {}; Object.keys(D.TRADES).forEach(function (tr) { ot[tr] = 2; });
      var alloc = { T4: 99 };
      g.runWeek({ ot: ot, alloc: alloc });
      if (g.state.T4.finishDay === null) return 'cure did not finish in the week';
      var elapsed = g.state.T4.finishDay - g.state.T4.startedDay + 1;
      return elapsed === 4 || 'cure took ' + elapsed + ' working days, expected exactly 4';
    });

    /* ---------- 4. determinism ------------------------------------- */
    t('Same seed + same decisions => identical profit, to the dollar', function () {
      function play(seed) {
        var g = new TO.Game.Game({
          network: D.MAIN_NETWORK, trades: D.TRADES, zones: D.ZONES,
          deck: D.EVENT_DECK, calls: D.CALLS, seed: seed, difficulty: 'standard'
        });
        var guard = 0;
        while (!g.finished && guard++ < 200) {
          g.autoAllocate();
          var ot = {};
          /* a fixed, scripted policy: overtime on concrete from wk 5 */
          if (g.week >= 5) ot.concrete = 1;
          if (g.week >= 12) ot.drywall = 1;
          g.runWeek({ ot: ot, alloc: g.alloc, expedite: [] });
        }
        return { profit: g.profit, end: g.finishWorkingDay, weeks: g.week };
      }
      var a = play('DETERMINISM-1');
      var b = play('DETERMINISM-1');
      if (a.profit !== b.profit) return 'profit ' + a.profit + ' vs ' + b.profit;
      if (a.end !== b.end) return 'finish day ' + a.end + ' vs ' + b.end;
      var c = play('DETERMINISM-2');
      if (c.profit === a.profit && c.end === a.end) return 'a different seed produced an identical run';
      return true;
    });

    t('The event sequence is identical regardless of what players decide', function () {
      var mk = function () {
        return new TO.Game.Game({
          network: D.MAIN_NETWORK, trades: D.TRADES, zones: D.ZONES,
          deck: D.EVENT_DECK, calls: D.CALLS, seed: 'DECK-FAIR', difficulty: 'standard'
        });
      };
      var g1 = mk(), g2 = mk();
      /* g2 plays wildly differently */
      var guard = 0;
      while (!g2.finished && guard++ < 60) {
        var ot = {}; Object.keys(D.TRADES).forEach(function (tr) { ot[tr] = 2; });
        g2.autoAllocate();
        g2.runWeek({ ot: ot, alloc: g2.alloc });
      }
      for (var w = 1; w <= 25; w++) {
        var e1 = g1.weekEvents(w).map(function (e) { return e.id; }).join(',');
        var e2 = g2.weekEvents(w).map(function (e) { return e.id; }).join(',');
        if (e1 !== e2) return 'week ' + w + ': "' + e1 + '" vs "' + e2 + '"';
      }
      return true;
    });

    /* ---------- 5. overtime decay bites ---------------------------- */
    t('Sustained overtime eventually produces LESS than straight time', function () {
      var p1 = TO.Model.otProductivity(1, 1);
      if (!(p1 > 1.2)) return 'week 1 of 50-hr weeks should gain ground, got ' + p1;
      var p8 = TO.Model.otProductivity(1, 8);
      if (!(p8 < 1.0)) return 'week 8 of sustained 50-hr weeks should be below 1.0, got ' + p8;
      var q1 = TO.Model.otProductivity(2, 1);
      var q9 = TO.Model.otProductivity(2, 9);
      if (!(q1 > 1.4)) return 'week 1 of 60-hr weeks should be ~1.5, got ' + q1;
      if (!(q9 <= 1.0)) return 'week 9 of sustained 60-hr weeks should be at or below 1.0, got ' + q9;
      return true;
    });

    t('Overtime efficiency floors match the published figures', function () {
      var e50 = TO.Model.otEfficiency(1, 40);
      var e60 = TO.Model.otEfficiency(2, 40);
      if (Math.abs(e50 - 0.75) > 1e-9) return '50-hr floor ' + e50;
      if (Math.abs(e60 - 0.62) > 1e-9) return '60-hr floor ' + e60;
      if (TO.Model.otEfficiency(1, 2) !== 1) return '50-hr week 2 should still be 1.0';
      if (TO.Model.otEfficiency(2, 1) !== 1) return '60-hr week 1 should still be 1.0';
      return true;
    });

    t('Sustained 60-hr weeks are worse than sustained 50-hr weeks', function () {
      /* Otherwise the model would teach students that if you are going
         to burn the crew out anyway you may as well do it at 60. */
      var p50 = TO.Model.otProductivity(1, 40);
      var p60 = TO.Model.otProductivity(2, 40);
      if (!(p60 < p50)) return 'sustained 60-hr nets ' + p60 + ' vs 50-hr ' + p50;
      if (!(p60 < 1)) return 'sustained 60-hr should fall below straight time, got ' + p60;
      if (!(TO.Model.otCost(2) > TO.Model.otCost(1))) return '60-hr should cost more than 50-hr';
      return true;
    });

    /* ---------- 6. trade stacking ---------------------------------- */
    t('Stacking one zone yields less total progress than splitting crews', function () {
      var cap = 2;
      var stacked = 4 * TO.Model.stackFactor(4, cap);
      var split = 2 * TO.Model.stackFactor(2, cap) + 2 * TO.Model.stackFactor(2, cap);
      if (!(split > stacked)) return 'split ' + split + ' not better than stacked ' + stacked;
      var five = 5 * TO.Model.stackFactor(5, cap);
      if (!(five < 2 * TO.Model.stackFactor(2, cap))) return '5 crews in a cap-2 zone should underperform 2';
      return true;
    });

    /* ---------- CPM sanity ----------------------------------------- */
    t('Main network is acyclic and every predecessor resolves', function () {
      var ids = {};
      D.MAIN_NETWORK.activities.forEach(function (a) { ids[a.id] = true; });
      for (var i = 0; i < D.MAIN_NETWORK.activities.length; i++) {
        var a = D.MAIN_NETWORK.activities[i];
        for (var j = 0; j < (a.preds || []).length; j++) {
          if (!ids[a.preds[j].id]) return a.id + ' references unknown predecessor ' + a.preds[j].id;
          if (['FS', 'SS', 'FF'].indexOf(a.preds[j].type) === -1) return a.id + ' has bad relationship type';
        }
      }
      var nodes = D.MAIN_NETWORK.activities.map(function (a) {
        return { id: a.id, dur: a.work, minStart: 0, preds: a.preds || [] };
      });
      var c = TO.CPM.compute(nodes);
      if (!(c.projectEnd > 0)) return 'zero duration';
      if (!c.chain.length) return 'no critical chain computed';
      return true;
    });

    t('Main network uses FS, SS and FF relationships', function () {
      var kinds = {};
      D.MAIN_NETWORK.activities.forEach(function (a) {
        (a.preds || []).forEach(function (p) { kinds[p.type] = (kinds[p.type] || 0) + 1; });
      });
      if (!kinds.FS || !kinds.SS || !kinds.FF) return 'relationship types present: ' + JSON.stringify(kinds);
      return true;
    });

    t('Weather flags sit only on earthwork, concrete, roofing and envelope', function () {
      var allowed = { earthwork: 1, concrete: 1, roofing: 1, envelope: 1 };
      var bad = D.MAIN_NETWORK.activities.filter(function (a) {
        return a.weather && !allowed[a.trade];
      }).map(function (a) { return a.id + '(' + a.trade + ')'; });
      return bad.length === 0 || 'weather flag on ' + bad.join(', ');
    });

    t('No weather card claims to stop a trade that has no weather-flagged work', function () {
      /* A card that says "the crane is down" while no steel activity
         carries a weather flag is an inert card: it reads like an
         effect and does nothing. Catch it here rather than in class. */
      var flagged = {};
      D.MAIN_NETWORK.activities.concat(D.TUTORIAL_NETWORK.activities).forEach(function (a) {
        if (a.weather && a.trade) flagged[a.trade] = true;
      });
      var bad = [];
      D.EVENT_DECK.forEach(function (e) {
        if (e.cat !== 'weather' || !e.affects) return;
        e.affects.forEach(function (tr) { if (!flagged[tr]) bad.push(e.id + ' -> ' + tr); });
      });
      return bad.length === 0 || 'inert weather effects: ' + bad.join(', ');
    });

    t('No event card is drawn about work this project has not got', function () {
      /* The ten-activity tutorial has no curtain wall and no elevator.
         Being told either is late is not bad luck, it is nonsense. */
      var bad = [];
      [D.TUTORIAL_NETWORK, D.MAIN_NETWORK].forEach(function (net) {
        var ids = {};
        net.activities.forEach(function (a) { ids[a.id] = true; });
        ['easy', 'standard', 'hard'].forEach(function (diff) {
          var rolled = TO.Events.preroll(D.EVENT_DECK, 'WINDOW-' + net.id, diff, 60, net);
          rolled.weeks.forEach(function (w) {
            w.events.forEach(function (e) {
              ['delay', 'holdExtend', 'bonus'].forEach(function (k) {
                if (!e[k]) return;
                if (!e[k].targets.some(function (id) { return ids[id]; })) {
                  bad.push(net.id + '/' + diff + ' wk' + w.week + ': ' + e.id);
                }
              });
            });
          });
        });
      });
      return bad.length === 0 || bad.slice(0, 5).join('; ');
    });

    t('Event cards land while the work they name is still in front of you', function () {
      /* A late rebar delivery ten weeks after the last pour reads as a
         broken deck. Cards are windowed to where their targets sit in
         this project's own schedule, so measure how often one still
         lands on work already finished. */
      var total = 0, dead = 0;
      ['MSU-2601', 'TOPPING', 'FALL26', 'CMGT-201'].forEach(function (seed) {
        var g = new TO.Game.Game({
          network: D.MAIN_NETWORK, trades: D.TRADES, zones: D.ZONES,
          deck: D.EVENT_DECK, calls: D.CALLS, seed: seed, difficulty: 'standard'
        });
        var guard = 0;
        while (!g.finished && guard++ < 200) {
          g.weekEvents().forEach(function (e) {
            if (e.cat === 'weather' || e.flavorOnly) return;
            var tg = (e.delay && e.delay.targets) || (e.holdExtend && e.holdExtend.targets) ||
              (e.bonus && e.bonus.targets);
            if (!tg) return;
            total++;
            var live = tg.some(function (id) { return g.state[id] && g.state[id].finishDay === null; });
            if (!live) dead++;
          });
          g.autoAllocate();
          g.runWeek({ alloc: g.alloc });
        }
      });
      if (!total) return 'no targeted cards drawn at all';
      var rate = dead / total;
      return rate <= 0.08 || Math.round(rate * 100) + '% of cards landed on finished work (' + dead + '/' + total + ')';
    });

    t('Windowing does not depend on how the game is played', function () {
      var a = TO.Events.buildWindows(D.EVENT_DECK, D.MAIN_NETWORK);
      var b = TO.Events.buildWindows(D.EVENT_DECK, D.MAIN_NETWORK);
      return JSON.stringify(a) === JSON.stringify(b) || 'windows are not stable';
    });

    t('Every activity that can be delayed by an event actually exists', function () {
      var ids = {};
      D.MAIN_NETWORK.activities.concat(D.TUTORIAL_NETWORK.activities).forEach(function (a) { ids[a.id] = true; });
      var bad = [];
      D.EVENT_DECK.forEach(function (e) {
        ['delay', 'holdExtend', 'bonus'].forEach(function (key) {
          if (!e[key]) return;
          e[key].targets.forEach(function (id) { if (!ids[id]) bad.push(e.id + ' -> ' + id); });
        });
      });
      return bad.length === 0 || 'unknown targets: ' + bad.join(', ');
    });

    t('No expedite ever buys back more days than the delay cost', function () {
      /* "Recovers 3 of 2 days" is nonsense on the screen and worse in
         the model. Expediting recovers SOME of a late delivery. It
         never un-happens it, at any difficulty setting. */
      var bad = [];
      ['easy', 'standard', 'hard'].forEach(function (diff) {
        var rolled = TO.Events.preroll(D.EVENT_DECK, 'EXPEDITE-CHECK', diff, 60);
        rolled.weeks.forEach(function (w) {
          w.events.forEach(function (e) {
            if (!e.expedite) return;
            var days = (e.delay && e.delay.days) || 0;
            if (e.expedite.recover > days) bad.push(diff + ' ' + e.id + ': recovers ' + e.expedite.recover + ' of ' + days);
            if (e.expedite.recover >= days && days > 0) bad.push(diff + ' ' + e.id + ': fully recovers the delay');
          });
        });
      });
      return bad.length === 0 || bad.slice(0, 4).join('; ');
    });

    t('Every expedite option explains in plain words what you are buying', function () {
      var bad = D.EVENT_DECK.filter(function (e) {
        return e.expedite && (!e.expedite.detail || e.expedite.detail.length < 30);
      }).map(function (e) { return e.id; });
      return bad.length === 0 || 'no usable detail on: ' + bad.join(', ');
    });

    t('Every call explains its jargon in plain words', function () {
      /* A first-year does not know what a proof roll or a cylinder
         break is, and a call they cannot read is not a decision. */
      var bad = D.CALLS.filter(function (c) { return !c.detail || c.detail.length < 60; })
        .map(function (c) { return c.id; });
      return bad.length === 0 || 'no usable detail on: ' + bad.join(', ');
    });

    t('Unsafe options are rare, flagged, and never the only way through', function () {
      var unsafe = [];
      D.CALLS.forEach(function (c) {
        c.options.forEach(function (o) { if (o.unsafe) unsafe.push({ c: c, o: o }); });
      });
      /* Rare by design: the point is to name the pressure, not to make
         the game about it. */
      if (unsafe.length > 2) return unsafe.length + ' unsafe options — too many to stay exceptional';
      var bad = [];
      unsafe.forEach(function (u) {
        if (!u.o.unsafeWhy || u.o.unsafeWhy.length < 80) bad.push(u.c.id + '/' + u.o.id + ' has no explanation');
        /* there must always be a lawful option that is free of exposure */
        var safe = u.c.options.filter(function (o) { return !o.unsafe && (o.risk || 0) <= 0.05; });
        if (!safe.length) bad.push(u.c.id + ' has no safe option');
      });
      return bad.length === 0 || bad.join('; ');
    });

    t('Choosing an unsafe option is recorded even when it works out', function () {
      var g = new TO.Game.Game({
        network: D.MAIN_NETWORK, trades: D.TRADES, zones: D.ZONES,
        deck: D.EVENT_DECK, calls: D.CALLS, seed: 'UNSAFE-TEST', difficulty: 'easy'
      });
      var target = null;
      D.CALLS.forEach(function (c) {
        c.options.forEach(function (o) { if (o.unsafe && !target) target = { c: c, o: o }; });
      });
      if (!target) return true;
      var entry = g.applyCallChoice(target.c.id, target.o.id);
      if (!entry || !entry.unsafe) return 'not marked unsafe on the call log';
      if (!entry.unsafeWhy) return 'no explanation carried through';
      if (!g.unsafeChoices.length) return 'not collected for the debrief';
      /* and it must still be there after the roll goes the player's way */
      entry.resolved = true; entry.failed = false;
      return g.unsafeChoices.length === 1 || 'lost from the debrief once it passed';
    });

    t('Every non-fixed activity has a trade and a zone with a capacity', function () {
      var bad = [];
      D.MAIN_NETWORK.activities.forEach(function (a) {
        if (!a.fixed && (!a.trade || !D.TRADES[a.trade])) bad.push(a.id + ' trade');
        if (!D.ZONES[a.zone]) bad.push(a.id + ' zone');
      });
      return bad.length === 0 || bad.join(', ');
    });

    var passed = results.filter(function (r) { return r.pass; }).length;
    return { results: results, passed: passed, failed: results.length - passed, total: results.length };
  }

  return { runSelfTests: runSelfTests };
})();

TO.runSelfTests = TO.SelfTest.runSelfTests;

/* ---- node entry point --------------------------------------------- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TO;
  if (typeof require !== 'undefined' && require.main === module &&
      process.argv.indexOf('--test') !== -1) {
    var rep = TO.runSelfTests(require('./data.js'));
    rep.results.forEach(function (r) {
      console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '\n      ' + r.detail));
    });
    console.log('----');
    console.log(rep.passed + ' passed, ' + rep.failed + ' failed, ' + rep.total + ' total');
    process.exit(rep.failed ? 1 : 0);
  }
}
