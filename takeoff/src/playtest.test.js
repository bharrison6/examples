#!/usr/bin/env node
/* ==========================================================================
   Undershoot — dataset and engine checks.

   Run: node src/playtest.test.js

   Two jobs. The first is ordinary unit testing of the scales, the guess
   curve and the scoring. The second matters more: the dataset is the demo's
   entire claim to credibility, so these checks assert that every number on
   screen resolves to a declared source, that no series has been quietly
   reordered to look better, and that the figures stated in prose agree with
   the figures actually plotted.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const D = require('./data.js');
const E = require('./engine.js');

let pass = 0, fail = 0;
const results = [];

function ok(name, cond, detail) {
  if (cond) { pass++; results.push(['PASS', name, detail]); }
  else { fail++; results.push(['FAIL', name, detail]); }
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

/* ======================= 1. dates and formatting ========================= */

ok('ISO dates parse as UTC', E.t('2024-01-01') === Date.UTC(2024, 0, 1));
ok('Dates round-trip', E.isoOf(E.t('2025-11-24')) === '2025-11-24');
ok('Date formatting is stable across timezones',
   E.fmtDate(E.t('2023-03-14')) === 'Mar 2023',
   E.fmtDate(E.t('2023-03-14')));
ok('Minutes format as minutes', E.fmtMinutes(45) === '45 min', E.fmtMinutes(45));
ok('Long horizons format as hours', E.fmtMinutes(678) === '11.3 hr', E.fmtMinutes(678));
ok('Sub-minute horizons format as seconds', E.fmtMinutes(0.033) === '2 sec', E.fmtMinutes(0.033));

/* ============================= 2. scales ================================= */

{
  const lin = E.makeScale('linear', 0, 100);
  ok('Linear scale maps min to 0', lin.to(0) === 0);
  ok('Linear scale maps max to 1', lin.to(100) === 1);
  ok('Linear scale inverts', near(lin.from(lin.to(37.4)), 37.4, 1e-9));

  const log = E.makeScale('log', 1, 1000);
  ok('Log scale maps min to 0', near(log.to(1), 0, 1e-9));
  ok('Log scale maps max to 1', near(log.to(1000), 1, 1e-9));
  ok('Log scale puts a decade at a third', near(log.to(10), 1 / 3, 1e-9));
  ok('Log scale inverts', near(log.from(log.to(42)), 42, 1e-6));
  ok('Log scale clamps below its floor rather than returning -Infinity',
     isFinite(log.to(0)), String(log.to(0)));
}

ok('Log ticks span the decades', E.ticks(E.makeScale('log', 1, 1000), 5).includes(100));
ok('Linear ticks are round numbers',
   E.ticks(E.makeScale('linear', 0, 100), 5).every(v => v % 5 === 0));

/* ====================== 2b. axis values a person can read ================
   A log axis built from the 1-2-5 ladder gave the task-length round eleven
   gridlines reading "1.7 hr", "3.3 hr", "16.7 hr" and "33.3 hr". Correct
   arithmetic; nobody thinks in 3.3 hours.
   ======================================================================== */

{
  const t = E.durationTicks(1, 4000, 7);
  ok('The duration axis produces a handful of ticks', t.length >= 4 && t.length <= 8, t.length + '');
  const labels = t.map(E.fmtDurationTick);
  ok('No duration label carries a decimal point', labels.every(l => !/\./.test(l)), labels.join(' '));
  ok('Duration labels use units a person says out loud',
     labels.every(l => /^\d+ (min|hr|days?)$/.test(l)), labels.join(' | '));
  ok('The duration ladder is in order', t.every((v, i) => i === 0 || v > t[i - 1]));
  ok('Duration ticks stay inside the range', t.every(v => v >= 1 && v <= 4000));
  ok('An hour reads as an hour', E.fmtDurationTick(60) === '1 hr', E.fmtDurationTick(60));
  ok('A day reads as a day, singular', E.fmtDurationTick(1440) === '1 day', E.fmtDurationTick(1440));
  ok('A narrow duration range still yields ticks', E.durationTicks(1, 30, 7).length >= 3);

  /* Log value axes must not stack a dozen gridlines on a short plot. */
  const price = E.makeScale('log', 0.05, 60);
  const pt = E.ticks(price, 7);
  ok('A log value axis thins to at most the target', pt.length <= 7, pt.length + ' ticks');
  /* Every surviving tick must sit on a 1 or a 5 of its decade — the thinning
     drops ticks, it must never invent an awkward one. */
  const mantissa = v => v / Math.pow(10, Math.floor(Math.log10(v) + 1e-9));
  ok('A thinned log axis keeps round values',
     pt.every(v => [1, 2, 5].some(m => Math.abs(mantissa(v) - m) < 1e-6)),
     pt.map(v => v + '(' + E.round(mantissa(v), 3) + ')').join(' '));

  /* And every round the app ships must produce readable y labels. */
  const bad = [];
  for (const r of D.ROUNDS) {
    const sc = E.makeScale(r.scale, r.yMin, r.yMax);
    const ls = r.unit === 'min'
      ? E.durationTicks(sc.min, sc.max, 7).map(E.fmtDurationTick)
      : E.ticks(sc, 7).map(v => E.fmtValue(v, r.unit));
    if (ls.length < 4 || ls.length > 8) bad.push(`${r.id}: ${ls.length} ticks`);
    if (new Set(ls).size !== ls.length) bad.push(`${r.id}: duplicate labels`);
  }
  ok('Every round\u2019s value axis has 4\u20138 distinct labels', bad.length === 0, bad.join(', '));
}

/* ========================== 3. the guess curve =========================== */

{
  const g = E.emptyGuess(0.4);
  ok('A fresh guess is flat', g.every(p => p.y === 0.4));
  ok('A fresh guess is not "drawn"', !E.guessDrawn(g, 0.4));

  E.paint(g, 1, 0.9, null);
  ok('Painting one column marks the guess as drawn', E.guessDrawn(g, 0.4));

  /* A fast swipe delivers sparse pointer samples. The curve must still be
     continuous, or the reveal compares against a line with holes in it. */
  const g2 = E.emptyGuess(0.1);
  let last = null;
  last = E.paint(g2, 0, 0.1, last) / (E.GUESS_N - 1);
  E.paint(g2, 1, 0.9, last);
  const mid = E.guessAt(g2, 0.5);
  ok('A two-sample swipe interpolates the columns between',
     near(mid, 0.5, 0.03), mid.toFixed(3));

  ok('Reading past the end clamps', E.guessAt(g2, 5) === E.guessAt(g2, 1));
  ok('Reading before the start clamps', E.guessAt(g2, -5) === E.guessAt(g2, 0));

  const g3 = E.emptyGuess(0.5);
  E.paint(g3, 0.5, 99, null);
  ok('Painting out of bounds clamps into range', g3.every(p => p.y >= 0 && p.y <= 1));
}

/* ====================== 3b. the time axis ================================
   A chart whose x axis carries one tick tells the reader nothing about the
   scale they are being asked to forecast across. The bug-fixing round spans
   sixteen months and crosses exactly one 1 January, so a year-only axis gave
   it a single mark. These checks exist so that cannot come back.
   ======================================================================== */

{
  const span = (a, b) => ({ t0: E.t(a), t1: E.t(b) });

  const short = span('2024-06-01', '2025-10-01');
  const st = E.timeTicks(short.t0, short.t1);
  ok('A sixteen-month axis gets more than one tick', st.length >= 4, st.length + ' ticks');
  ok('A sixteen-month axis is ticked in months, not years',
     st.every(m => m.step < 12) && /\u2019/.test(E.tickLabel(st[0].ms, st[0].step)),
     E.tickLabel(st[0].ms, st[0].step));

  const long = span('2020-06-01', '2025-01-01');
  const lt = E.timeTicks(long.t0, long.t1);
  ok('A four-year axis is ticked in whole years', lt.every(m => m.step >= 12), lt.length + ' ticks');
  ok('Year ticks are labelled as years', /^\d{4}$/.test(E.tickLabel(lt[0].ms, lt[0].step)),
     E.tickLabel(lt[0].ms, lt[0].step));

  const tiny = span('2025-01-01', '2025-05-01');
  ok('A four-month axis still gets several ticks', E.timeTicks(tiny.t0, tiny.t1).length >= 3);

  /* Ticks must be inside the range, in order, and never runaway. */
  const all = E.timeTicks(E.t('2019-01-01'), E.t('2026-12-31'));
  ok('Ticks stay inside the range',
     all.every(m => m.ms >= E.t('2019-01-01') && m.ms <= E.t('2026-12-31')));
  ok('Ticks come out in order', all.every((m, i) => i === 0 || m.ms > all[i - 1].ms));
  ok('A degenerate range does not hang', E.timeTicks(E.t('2025-01-01'), E.t('2025-01-01')).length <= 1);

  /* And every round the app actually ships must clear the bar. */
  const thin = [];
  for (const r of D.ROUNDS) {
    const pts = E.allPoints(r);
    let t0 = E.t(pts[0].date), t1 = E.t(r.askDate);
    const sp = t1 - t0; t0 -= sp * 0.04; t1 += sp * 0.06;
    const n = E.timeTicks(t0, t1).length;
    if (n < 4) thin.push(`${r.id}: ${n}`);
  }
  ok('Every round\u2019s time axis carries at least four ticks', thin.length === 0, thin.join(', '));
}

/* ============================ 4. scoring ================================= */

{
  const r = D.ROUNDS.find(x => x.id === 'swebench');
  const scale = E.makeScale(r.scale, r.yMin, r.yMax);
  const truth = E.finalValue(r);

  const perfect = E.emptyGuess(scale.to(truth));
  ok('A perfect guess scores 1.0x', near(E.score(r, perfect).ratio, 1, 0.005),
     E.score(r, perfect).ratio.toFixed(4));

  const half = E.emptyGuess(scale.to(truth / 2));
  ok('Guessing half scores 2.0x', near(E.score(r, half).ratio, 2, 0.02),
     E.score(r, half).ratio.toFixed(3));

  ok('A low guess is flagged as under', E.score(r, half).under);
  const high = E.emptyGuess(scale.to(Math.min(truth * 1.15, 99)));
  ok('A high guess is not flagged as under', !E.score(r, high).under);

  /* Monotonicity: drawing lower must never look less wrong. */
  let mono = true, prev = Infinity;
  for (let y = 0.05; y <= 0.95; y += 0.05) {
    const s = E.score(r, E.emptyGuess(y)).ratio;
    if (s > prev) mono = false;
    prev = s;
  }
  ok('Score is monotone decreasing in the height drawn', mono);

  ok('Percentage rounds report a point gap', E.score(r, half).points > 0);
}

{
  /* The price round falls, so the ratio has to invert or a good guess would
     score as a catastrophic miss. */
  const r = D.ROUNDS.find(x => x.id === 'price');
  ok('The price round is detected as falling', E.isFalling(r));
  const scale = E.makeScale(r.scale, r.yMin, r.yMax);
  const perfect = E.emptyGuess(scale.to(E.finalValue(r)));
  ok('A perfect guess on a falling round still scores 1.0x',
     near(E.score(r, perfect).ratio, 1, 0.02), E.score(r, perfect).ratio.toFixed(3));
  const timid = E.emptyGuess(scale.to(3.0));
  ok('Not expecting the fall reads as a miss greater than 1x',
     E.score(r, timid).ratio > 1, E.score(r, timid).ratio.toFixed(1));
  ok('Not expecting the fall is flagged as "under"', E.score(r, timid).under);
}

ok('Median ignores infinities', E.medianRatio([{ratio: 2}, {ratio: 4}, {ratio: Infinity}]) === 3);
ok('Median of an empty set is null', E.medianRatio([]) === null);

/* ======================== 5. dataset integrity =========================== */

{
  /* Every plotted datum must resolve to a declared source. This is the check
     the whole demo's credibility rests on. */
  const orphans = [];
  const walk = (arr, where) => (arr || []).forEach(p => {
    const id = p.label || p.title || p.d || '?';
    if (!p.src) orphans.push(`${where}: ${id} has no src`);
    else if (!D.SOURCES[p.src]) orphans.push(`${where}: ${id} -> unknown src "${p.src}"`);
  });
  D.ROUNDS.forEach(r => {
    walk(r.shown, r.id); walk(r.hidden, r.id); walk(r.markers, r.id);
    if (r.twist) walk(r.twist.series, r.id + '/twist');
  });
  walk(D.UNLOCKS, 'unlocks');
  D.DOMAINS.forEach(d => walk(d.items, 'act3/' + d.id));
  ok('Every plotted point resolves to a declared source',
     orphans.length === 0, orphans.slice(0, 5).join(' | '));
}

{
  /* And the reverse: a source listed but never used is either a citation for
     a claim that got cut, or a claim whose citation got detached. */
  const used = new Set();
  const mark = arr => (arr || []).forEach(p => p.src && used.add(p.src));
  D.ROUNDS.forEach(r => { mark(r.shown); mark(r.hidden); mark(r.markers); if (r.twist) mark(r.twist.series); });
  mark(D.UNLOCKS); D.DOMAINS.forEach(d => mark(d.items));
  /* Cited in prose or on the timeline rather than attached to a plotted datum. */
  ['mittr-metr', 'erdos1196-tao', 'hle', 'nolima', 'kimi-k3', 'gemma', 'olmo', 'cursor', 'gpt-oss',
   'arc-3', 'arc-3-human', 'vals-swebench', 'arc-astra',
   D.CLOSERS.gapSrc, D.CLOSERS.doublingSrc].forEach(k => used.add(k));
  const unused = Object.keys(D.SOURCES).filter(k => !used.has(k));
  ok('No source is declared and never used', unused.length === 0, unused.join(', '));
}

{
  const bad = [];
  D.ROUNDS.forEach(r => {
    const pts = E.allPoints(r);
    for (let i = 1; i < pts.length; i++) {
      if (E.t(pts[i].date) < E.t(pts[i - 1].date)) bad.push(`${r.id} at ${pts[i].label}`);
    }
  });
  ok('Every series runs forward in time', bad.length === 0, bad.join(', '));
}

{
  /* The game is only fair if the hidden data genuinely postdates the shown
     data — otherwise the room is being asked to predict the past. */
  const bad = [];
  D.ROUNDS.forEach(r => {
    const lastShown = E.t(r.shown[r.shown.length - 1].date);
    if (E.t(r.hidden[0].date) < lastShown) bad.push(r.id);
    if (E.t(r.askDate) < lastShown) bad.push(r.id + ' (ask date precedes cutoff)');
  });
  ok('Hidden data always follows the shown cutoff', bad.length === 0, bad.join(', '));
}

{
  const bad = D.ROUNDS.filter(r => {
    const pts = E.allPoints(r);
    return pts.some(p => p.value < r.yMin - 1e-9 || p.value > r.yMax + 1e-9);
  }).map(r => r.id);
  ok('Every point falls inside its own axis range', bad.length === 0, bad.join(', '));
}

{
  const weak = [];
  const allow = new Set(['primary', 'reported', 'disputed']);
  const grade = arr => (arr || []).forEach(p => {
    if (p.status && !allow.has(p.status)) weak.push(p.label || p.title);
  });
  D.ROUNDS.forEach(r => { grade(r.shown); grade(r.hidden); grade(r.markers); if (r.twist) grade(r.twist.series); });
  grade(D.UNLOCKS); D.DOMAINS.forEach(d => grade(d.items));
  ok('Nothing rated below "reported" is displayed', weak.length === 0, weak.join(', '));
}

/* ============== 5b. Act I is explained, not just plotted ================= */

{
  const bare = D.ROUNDS.filter(r => !r.plain || !r.human || !r.example).map(r => r.id);
  ok('Every test explains itself in plain language, with an example and a human anchor',
     bare.length === 0, bare.join(', '));

  const unlabelled = D.ROUNDS.filter(r => !r.xLabel || !r.yLabel).map(r => r.id);
  ok('Both axes are labelled on every chart', unlabelled.length === 0, unlabelled.join(', '));

  const noShort = D.ROUNDS.filter(r => !r.yLabelShort).map(r => r.id);
  ok('Every round has a short y label for tight plots', noShort.length === 0, noShort.join(', '));

  /* Each test surfaces the benchmark's real name, so a curious viewer can look
     it up — added after review asked "should we name the test". */
  const unnamed = D.ROUNDS.filter(r => !r.real).map(r => r.id);
  ok('Every test names the real benchmark behind it', unnamed.length === 0, unnamed.join(', '));

  /* The plain-language explanations must be complete sentences, not the noun
     fragments an earlier draft shipped ("A few hundred questions..."). A crude
     but effective proxy: the text ends in a full stop and its first sentence
     contains a verb-ish word. */
  const VERB = /\b(is|are|was|were|be|has|have|measures?|shows?|gives?|takes?|finds?|files?|asks?|works?|scores?|means?|lets?|sees?|gets?|holds?|picks?|reads?|comes?|goes?|makes?|solves?|fixes?|try|draw|read|take|watch|imagine|picture|note|remember|prices)\b/i;
  const fragmentary = [];
  const checkProse = (text, where) => {
    if (!text) return;
    const first = text.split(/(?<=[.!?])\s/)[0];
    if (!VERB.test(first)) fragmentary.push(where + ': ' + first.slice(0, 48));
  };
  D.ROUNDS.forEach(r => { checkProse(r.plain, r.id + '.plain'); checkProse(r.human, r.id + '.human'); });
  D.DOMAINS.forEach(d => checkProse(d.lede, d.id + '.lede'));
  ok('Every explanation and domain intro opens with a complete sentence',
     fragmentary.length === 0, fragmentary.slice(0, 4).join(' | '));
  const tooLong = D.ROUNDS.filter(r => r.yLabelShort.length > 26).map(r => r.id);
  ok('The short y labels are actually short', tooLong.length === 0, tooLong.join(', '));

  const jargon = D.ROUNDS.filter(r => /benchmark|eval\b|SOTA|token/i.test(r.plain)).map(r => r.id);
  ok('No plain-language explanation leans on jargon', jargon.length === 0, jargon.join(', '));

  ok('The opening screen exists and says what the exercise is',
     D.INTRO && D.INTRO.body.length >= 3 && D.INTRO.cta);

  const arc = D.ROUNDS.find(r => r.id === 'arc');
  ok('The grid puzzle ships a worked example and its answer',
     arc.example.kind === 'arc' && arc.example.pairs.length >= 2 && arc.example.answer);
  /* The example must actually be the rule it claims: everything falls to the
     bottom row, keeping its column. A wrong worked example in front of a room
     is worse than no example. */
  const fall = g => {
    const h = g.length, w = g[0].length;
    const out = Array.from({ length: h }, () => Array(w).fill(0));
    for (let c = 0; c < w; c++) {
      const vals = [];
      for (let r2 = 0; r2 < h; r2++) if (g[r2][c]) vals.push(g[r2][c]);
      for (let k = 0; k < vals.length; k++) out[h - vals.length + k][c] = vals[k];
    }
    return out;
  };
  const consistent = arc.example.pairs.every(p => JSON.stringify(fall(p.in)) === JSON.stringify(p.out))
                  && JSON.stringify(fall(arc.example.test)) === JSON.stringify(arc.example.answer);
  ok('The grid puzzle\u2019s examples and answer obey one consistent rule', consistent);
}

/* ================= 5c. Act III covers more than mathematics ============== */

{
  const items = D.DOMAINS.reduce((a, d) => a.concat(d.items), []);
  ok('Act III covers all seven domains', D.DOMAINS.length === 7, D.DOMAINS.length + ' domains');
  ok('Mathematics is one domain among several, not the whole act',
     items.filter(m => true).length > 0 &&
     D.DOMAINS.find(d => d.id === 'math').items.length < items.length / 2,
     D.DOMAINS.find(d => d.id === 'math').items.length + ' of ' + items.length + ' results');
  ok('Biology, medicine, weather, materials and software are all present',
     ['bio','med','weather','materials','software'].every(id => D.DOMAINS.some(d => d.id === id)));

  const missing = items.filter(m => !m.machine || !m.human).map(m => m.title);
  ok('Every result says what the machine did AND what the humans did',
     missing.length === 0, missing.join(', '));

  ok('Act III shows results that did not hold up',
     items.some(m => m.verdict === 'overclaimed') && items.some(m => m.verdict === 'disputed'));

  ok('Every domain has a one-line framing', D.DOMAINS.every(d => d.lede && d.lede.length > 30));

  const dates = items.map(m => E.t(m.date));
  ok('Every Act III result carries a parseable date', dates.every(d => isFinite(d)));
}

ok('The cut list is not empty', D.CUT.length >= 5, String(D.CUT.length) + ' entries');
ok('Every cut entry gives a reason', D.CUT.every(c => c.why && c.why.length > 20));

/* ==================== 6. prose agrees with the plot ====================== */

{
  const metr = D.ROUNDS.find(r => r.id === 'metr');
  const fit = E.doublingDays(E.allPoints(metr));
  ok('METR points imply a doubling time in a sane range',
     fit > 60 && fit < 260, Math.round(fit) + ' days');
  /* Act III prints both the published figure and this fit, and says they will
     not match. The test asserts they are at least the same order. */
  ok('Fitted doubling time is within 2x of the published post-2024 figure',
     fit / D.CLOSERS.doubling > 0.5 && fit / D.CLOSERS.doubling < 2,
     `fit ${Math.round(fit)}d vs published ${D.CLOSERS.doubling}d`);
}

{
  /* The SWE-bench reveal prose says "a third to four in five, then it stopped
     moving". Assert the data says so too, because prose and data drifting apart
     is exactly how a demo starts lying. The line is single-attempt figures end to
     end so the comparison is like with like. */
  const r = D.ROUNDS.find(x => x.id === 'swebench');
  const first = E.allPoints(r)[0].value;
  const last = E.finalValue(r);
  ok('The bug-fixing prose matches the plotted endpoints',
     Math.round(first) === 33 && Math.round(last) === 81, `${first} -> ${last}`);
}

{
  const r = D.ROUNDS.find(x => x.id === 'price');
  const first = E.allPoints(r)[0].value, last = E.finalValue(r);
  const factor = first / last;
  ok('The price round really is a ~208x fall', near(factor, 208, 2), factor.toFixed(1) + 'x');
}

{
  const r = D.ROUNDS.find(x => x.id === 'gpqa');
  const phd = r.markers.find(m => /PhD/.test(m.label)).value;
  const o1 = r.hidden.find(p => /o1/.test(p.label)).value;
  ok('o1 really is the first plotted point above the PhD baseline',
     o1 > phd && r.shown.every(p => p.value < phd), `${o1} vs ${phd}`);
}

{
  const arc = D.ROUNDS.find(x => x.id === 'arc');
  const f = arc.twist.finale;

  ok('ARC-AGI-2 scores really are far below the ARC-AGI-1 peak',
     Math.max(...arc.twist.series.map(s => s.value)) < E.finalValue(arc),
     `${Math.max(...arc.twist.series.map(s => s.value))} vs ${E.finalValue(arc)}`);

  /* The finale used to show "people 100%, AI 0.51%". Both halves were wrong in
     spirit: 100% is the scoring baseline by construction, not humans acing it,
     and 0.51% is one harness on one game set. These checks pin the honest
     version in place. */
  ok('The finale explains what ARC-AGI-3 actually is', f.what && f.what.length > 200);
  ok('The finale no longer claims humans score 100%',
     !f.bars.some(b => b.value === 100), JSON.stringify(f.bars.map(b => b.value)));
  const human = f.bars.find(b => b.kind === 'human');
  ok('The human bar is the measured average tester, 48%', human && human.value === 48,
     human && String(human.value));
  const withMem = f.bars.find(b => /remember/i.test(b.label));
  const without = f.bars.find(b => /standard wiring/i.test(b.label));
  ok('Both harness conditions for the same model are shown',
     withMem && without && withMem.value === 38.3 && without.value === 13.3,
     `${without && without.value} -> ${withMem && withMem.value}`);
  ok('The harness result really is about 3x',
     Math.abs(withMem.value / without.value - 2.9) < 0.4,
     (withMem.value / without.value).toFixed(2) + 'x');
  ok('The bare-model figure is kept, and marked as a different run',
     f.bars.some(b => b.value === 0.51 && /different game set/i.test(b.note)));
  /* The caveat states how many bars there are. Pinning the literal word "four"
     broke the moment a sixth bar arrived, which is the drift this suite exists
     to catch -- so pin it to the data instead. */
  {
    const WORD = { 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine' };
    const want = WORD[f.bars.length];
    ok('The finale warns that the bars are not comparable, and counts them correctly',
       !!want && new RegExp('not ' + want + ' measurements of one thing', 'i').test(f.caveat),
       `${f.bars.length} bars; caveat should say "not ${want} measurements of one thing"`);
  }
  ok('The finale cites the source for the harness result',
     !!D.SOURCES['arc-3-openai']);
}

/* ======================== 7. timeline dataset =========================== */

{
  const bad = D.MODELS.filter(m => !D.LABS[m.lab]).map(m => m.name);
  ok('Every model names a known lab', bad.length === 0, bad.join(', '));

  const badTier = D.MODELS.filter(m => !(m.tier >= 1 && m.tier <= 8)).map(m => m.name);
  ok('Every model has a tier in range', badTier.length === 0, badTier.join(', '));

  const sorted = D.MODELS.map(m => E.t(m.d));
  ok('The model list is in date order',
     sorted.every((v, i) => i === 0 || v >= sorted[i - 1]));

  ok('The timeline starts at ChatGPT', D.MODELS[0].d === '2022-11-30', D.MODELS[0].name);
  ok('Both open and closed weights are represented',
     D.MODELS.some(m => m.open) && D.MODELS.some(m => !m.open));
  ok('Chinese open-weight labs are represented',
     ['deepseek', 'alibaba', 'moonshot', 'zhipu', 'cnother'].every(k => D.MODELS.some(m => m.lab === k)));
  ok('Every lab declared is actually used',
     Object.keys(D.LABS).every(k => D.MODELS.some(m => m.lab === k)),
     Object.keys(D.LABS).filter(k => !D.MODELS.some(m => m.lab === k)).join(', '));

  /* The revision this suite exists to protect: the first version of the
     timeline had 52 models and almost no small or specialist open ones. */
  const open = D.MODELS.filter(m => m.open);
  ok('The timeline is majority downloadable models', open.length > D.MODELS.length / 2,
     open.length + ' of ' + D.MODELS.length);
  ok('The timeline carries at least 100 releases', D.MODELS.length >= 100, String(D.MODELS.length));

  /* The release count is quoted in five documents and was pinned only as a
     floor, so the timeline could grow and every one of them could go stale
     without a single check going red. It did. Pin the exact number. */
  {
    const n = String(D.MODELS.length);
    /* 'presenter-guide.html' is the shipped copy the PDF is rendered from.
       Checking only src/ is what let the printed guide keep a stale count. */
    for (const f of ['src/template.html', 'src/presenter-guide.html',
                     'presenter-guide.html', 'README.md', 'demo.json']) {
      const txt = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
      ok(`${f} quotes the real release count (${n})`,
         txt.includes(n + ' model releases') || txt.includes(n + ' releases arrive'),
         'does not contain the count ' + n);
    }
  }

  const named = s => D.MODELS.some(m => new RegExp(s, 'i').test(m.name));
  const wanted = ['Gemma', 'MedGemma', 'Phi', 'OLMo', 'Nemotron', 'Granite', 'Falcon',
                  'Composer', 'Devstral', 'Qwen', 'Kimi', 'GLM', 'DeepSeek', 'Yi-34B',
                  'Hunyuan', 'MiniMax', 'Ernie', 'gpt-oss', 'Mistral', 'EuroLLM', 'Poro'];
  const absent = wanted.filter(w => !named(w));
  ok('Every family the brief called out is on the timeline', absent.length === 0, absent.join(', '));

  const regions = {};
  D.MODELS.forEach(m => { const r = D.LABS[m.lab].region; regions[r] = (regions[r] || 0) + 1; });
  ok('All four regions are represented', Object.keys(regions).length >= 4, JSON.stringify(regions));
  ok('Europe has more than one lab represented',
     new Set(D.MODELS.filter(m => D.LABS[m.lab].region === 'Europe').map(m => m.lab)).size >= 2);
  ok('Every open model declares a licence',
     open.every(m => m.lic), open.filter(m => !m.lic).map(m => m.name).join(', '));
}

{
  const c = E.cadence(D.MODELS.map(m => ({ ...m })), 365);
  const early = c.find(x => x.date === '2023-03-14');
  const late = c[c.length - 1];
  ok('Release cadence is higher now than in early 2023',
     late.count > early.count, `${early.count} -> ${late.count} per year`);
}

/* ========================= 8. unlock dataset ============================ */

{
  const sorted = D.UNLOCKS.map(u => E.t(u.d));
  ok('Unlocks are in date order', sorted.every((v, i) => i === 0 || v >= sorted[i - 1]));
  ok('The walked-back bar exam claim is present and flagged',
     D.UNLOCKS.some(u => u.flag === 'walked back'));
  ok('The unlock list includes one where AI made people slower',
     D.UNLOCKS.some(u => u.flag === 'counterweight'));
  ok('The last unlock is the one that goes down, not up',
     /ARC-AGI-3/.test(D.UNLOCKS[D.UNLOCKS.length - 1].body));
}

/* ============================= report =================================== */

for (const [state, name, detail] of results) {
  if (state === 'FAIL' || process.argv.includes('-v')) {
    console.log(`${state}  ${name}${detail ? '  — ' + detail : ''}`);
  }
}
console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} checks.`);
process.exit(fail ? 1 : 0);
