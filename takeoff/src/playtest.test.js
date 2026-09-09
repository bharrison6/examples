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

/* Dataset checks are shared with the in-app integrity panel. */
const Validation=require('./validation.js');
for(const c of Validation.check(D,E)) ok(c.name,c.pass,c.detail);
const invalid=JSON.parse(JSON.stringify(D)); invalid.ROUNDS[0].hidden[0].src='missing-source';
ok('Integrity validator rejects a dangling source (negative control)',Validation.check(invalid,E).some(c=>!c.pass));
ok('Integrity validator accepts the known source graph (positive control)',Validation.check(D,E).every(c=>c.pass));
for(const years of [-1,0]) ok('All scenarios fit the anchor at '+years,E.scenarios(years).every(r=>near(r.value,years===-1?20:30,1e-9)));
ok('Scenarios diverge outside the observed anchors',new Set(E.scenarios(3).map(r=>r.value)).size===3);
ok('Compound scenario exposes a score above the ceiling',E.scenarios(8)[1].value>100);
ok('Saturation scenario stays below its stated ceiling',E.scenarios(100)[2].value<=75);
const metr=D.ROUNDS.find(r=>r.id==='metr');
ok('Non-robust Sol estimate is excluded from plotted points',!E.allPoints(metr).some(p=>p.src==='metr-sol')&&metr.limitations.src==='metr-sol');
ok('METR main series excludes the mismatched GPT-4o appendix row',!E.allPoints(metr).some(p=>p.label==='GPT-4o'));
ok('METR intervals are retained',E.allPoints(metr).every(p=>p.lo!=null&&p.hi!=null));
const price=D.ROUNDS.find(r=>r.id==='price');
ok('Price uses the MMLU threshold and blended token units',price.real.includes('86%')&&price.human.includes('3:1')&&price.yLabel.includes('tokens'));
const gpqa=D.ROUNDS.find(r=>r.id==='gpqa');
ok('GPQA uses the Diamond baseline without mismatched human markers',gpqa.shown[0].value===50.6&&gpqa.markers.length===0);
ok('Every timeline point carries a release source, no capability tier',D.MODELS.every(m=>m.src&&!('tier' in m)));
const arc=D.ROUNDS.find(r=>r.id==='arc');
ok('ARC3 comparison holds high reasoning effort fixed',arc.twist.finale.bars.every(b=>b.note.startsWith('High effort')));
ok('ARC3 RHAE is named separately from puzzles solved',arc.twist.finale.what.includes('Relative Human Action Efficiency'));
const fall=g=>{const out=g.map(row=>row.map(()=>0));for(let c=0;c<g[0].length;c++){const vals=g.map(row=>row[c]).filter(Boolean);vals.forEach((v,i)=>out[g.length-vals.length+i][c]=v);}return out;};
ok('Illustrative ARC puzzle examples and answer obey one rule',arc.example.pairs.every(p=>JSON.stringify(fall(p.in))===JSON.stringify(p.out))&&JSON.stringify(fall(arc.example.test))===JSON.stringify(arc.example.answer));
const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
ok('Different ARC versions are not connected on the chart',!app.includes('app.chart.twist('));
const idx=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
for(const id of ['btn-howto','btn-settings','btn-reset','btn-notes','chk-presenter','btn-details','round-select','scenario-years'])ok('Required control '+id,idx.includes('id="'+id+'"'));
for(const label of ['Open Presenter Notes','Presentation mode','Reset'])ok('Required visible label '+label,idx.includes('>'+label+'<'));
ok('Guide accessible name',idx.includes('aria-label="Guide"'));
const guide=fs.readFileSync(path.join(__dirname,'presenter-guide.html'),'utf8');
const body=guide.slice(guide.indexOf('<div class="guide-scope">'),guide.indexOf('</div><!-- /guide -->'))+'</div>';
ok('Canonical guide body is embedded verbatim',idx.includes(body));
ok('No external subresources',!(idx.match(/<(script|link|img|iframe|source|video|audio)\b[^>]*\b(src|href)\s*=\s*["']?https?:/gi)||[]).length);
for(const api of ['fetch(','XMLHttpRequest','WebSocket','@import','url(http'])ok('No runtime network API '+api,!idx.includes(api));
for(const [state,name,detail]of results)if(state==='FAIL'||process.argv.includes('-v'))console.log(state+' '+name+' '+detail);
console.log('\n'+pass+' passed, '+fail+' failed, '+(pass+fail)+' checks.');process.exit(fail?1:0);
