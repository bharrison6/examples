'use strict';
/* facts.js — every "measured" figure in the prose is computed here, at build.

   WHY. The count-drift pattern hit this demo six times before this file
   existed (126/53/176/28/"nine"/$185k): a number was measured once, typed
   into prose, and the engine or the data moved under it. On 2026-09-16 the
   "eight measured seeds" paragraph wore a same-day Measured stamp while the
   harness gave passive $2,604 (not $185,000), negative on three (not two),
   judgment $114,531 (not $351,000), wins 7 of 8 (not 6). Numbers that come
   from the engine come from the engine at build, or they are not "measured".

   HOW. build.js calls compute() and then render() over each prose surface.
   A surface marks a generated span with a comment pair:

     HTML / Markdown:   <!--@fact KEY-->value<!--/@fact-->
     JavaScript:        /*@fact KEY*_/value/*_/@fact*_/   (without the _)

   render() rewrites the value in place and leaves the markers, so the source
   file stays readable with real figures in it, greps still find the numbers,
   and the markers say which numbers are generated. `build.js --check` fails
   on any span whose value differs from the computed one.

   The measurement is the playtest harness's OWN play() and policies over its
   OWN eight seeds (src/playtest.test.js exports them when required), so the
   figures are exactly what `node src/playtest.test.js` prints. Runs in well
   under a second, so there is no cache to go stale. */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const here = path.join(__dirname, '..');
const H = require(path.join(here, 'src', 'playtest.test.js'));
const D = require(path.join(here, 'src', 'data.js'));
const TO = require(path.join(here, 'src', 'engine.js'));
const U = TO.Util;

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const word = n => (n >= 0 && n < WORDS.length) ? WORDS[n] : String(n);
const money = n => U.money(Math.round(n));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* The inputs the measurement is a pure function of. The date on the
   Measured kicker is the last commit that touched any of them — if the
   working tree has uncommitted changes to one, the measurement is of the
   tree as it stands today, and today is the honest date. Both branches are
   deterministic for a clean checkout, which is what --check needs. */
const INPUTS = ['src/engine.js', 'src/data.js', 'src/playtest.test.js'];
function measuredDate() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const dirty = execFileSync('git', ['status', '--porcelain', '--', ...INPUTS], { cwd: here, encoding: 'utf8' }).trim();
    if (dirty) return today;
    const d = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...INPUTS], { cwd: here, encoding: 'utf8' }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today;
  } catch (e) {
    return today;
  }
}

function sweep() {
  return H.SEEDS.map(seed => {
    const p = H.play(seed, H.POLICY.passive);
    const t = H.play(seed, H.POLICY.thoughtful);
    return {
      seed,
      passive: { profit: p.profit, weeks: p.week, late: p.lateCalendarDays, end: p.finishWorkingDay },
      thoughtful: { profit: t.profit, weeks: t.week, late: t.lateCalendarDays, end: t.finishWorkingDay }
    };
  });
}

/* One line of character per seed, by rule from the two measured rows — the
   caption says so. Rules, not a case list per seed name: a new seed gets a
   line without anyone writing one. */
function character(r, all) {
  const p = r.passive, t = r.thoughtful;
  const spread = t.profit - p.profit;
  const widest = Math.max(...all.map(x => x.thoughtful.profit - x.passive.profit)) === spread;
  let s;
  if (p.profit < 0 && t.profit < 0) s = 'Punishing: even judgment loses money here. Not a first-run seed.';
  else if (p.profit < 0) s = 'The defaults lose real money; judgment recovers it.';
  else if (t.profit < p.profit) s = 'Rewards nerve: the free options clear their thresholds, so the team that spent nothing beats the team that covered. Best debrief seed on the sheet.';
  else if (t.late <= 0) s = 'The one where a well-played job beats the contract date and collects the bonus.';
  else s = 'Middle of the road. Good first run.';
  if (widest) s += ' Widest spread on the sheet.';
  return s;
}

function compute() {
  const rows = sweep();
  const n = rows.length;
  const P = rows.map(r => r.passive), T = rows.map(r => r.thoughtful);
  const avg = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
  const min = xs => Math.min(...xs), max = xs => Math.max(...xs);
  const contract = D.MAIN_NETWORK.contractWorkingDays;
  const bestEnd = min(T.map(t => t.end));
  const wins = rows.filter(r => r.thoughtful.profit > r.passive.profit).length;
  const tutorialWeeks = H.SEEDS.map(s => H.play(s, H.POLICY.passive, 'standard', D.TUTORIAL_NETWORK).week);
  const mainCalls = D.CALLS.filter(c => c.project === 'main').length;
  const tutCalls = D.CALLS.filter(c => c.project === 'tutorial').length;
  if (mainCalls + tutCalls !== D.CALLS.length) throw new Error('facts: a call has a project that is neither main nor tutorial');

  const f = {
    'measured-date': measuredDate(),
    'seeds-n': word(n),
    'seeds-list': H.SEEDS.join(', '),
    'passive-avg': money(avg(P.map(p => p.profit))),
    'passive-neg-n': word(P.filter(p => p.profit < 0).length),
    'passive-late-lo': String(min(P.map(p => p.late))),
    'passive-late-hi': String(max(P.map(p => p.late))),
    'passive-weeks-lo': String(min(P.map(p => p.weeks))),
    'passive-weeks-hi': String(max(P.map(p => p.weeks))),
    'thoughtful-avg': money(avg(T.map(t => t.profit))),
    'thoughtful-wins-n': word(wins),
    'thoughtful-loses-n': word(n - wins),
    'thoughtful-neg-n': word(T.filter(t => t.profit < 0).length),
    'thoughtful-weeks-lo': String(min(T.map(t => t.weeks))),
    'thoughtful-weeks-hi': String(max(T.map(t => t.weeks))),
    'thoughtful-early-n': word(T.filter(t => t.late <= 0).length),
    'thoughtful-best-end-wd': String(bestEnd),
    'thoughtful-best-inside-wd': word(contract - bestEnd),
    'contract-wd': String(contract),
    'calls-main-n': String(mainCalls),
    'calls-main-word': word(mainCalls),
    'calls-tutorial-n': String(tutCalls),
    'calls-tutorial-word': word(tutCalls),
    'calls-total-n': String(D.CALLS.length),
    'tutorial-turns': min(tutorialWeeks) + '–' + max(tutorialWeeks),
    'seed-table-rows': rows.map(r => {
      const late = x => x === 0 ? 'on the date' : (x > 0 ? x + ' days late' : (-x) + ' days early');
      const tr = r.thoughtful.profit < r.passive.profit ? '<tr class="hi">' : '<tr>';
      return '    ' + tr + '<td>' + esc(r.seed) + '</td>' +
        '<td class="n">' + r.passive.weeks + '</td><td class="n">' + late(r.passive.late) + '</td>' +
        '<td class="n">' + money(r.passive.profit).replace(/^-/, '&minus;') + '</td>' +
        '<td class="n">' + r.thoughtful.weeks + '</td><td class="n">' + late(r.thoughtful.late) + '</td>' +
        '<td class="n">' + money(r.thoughtful.profit).replace(/^-/, '&minus;') + '</td>' +
        '<td>' + esc(character(r, rows)) + '</td></tr>';
    }).join('\n')
  };
  /* Sentence-initial uses: every word-valued fact also exists capitalised. */
  for (const k of Object.keys(f)) if (/^[a-z]+$/.test(f[k])) f[k + '-cap'] = f[k][0].toUpperCase() + f[k].slice(1);
  return { facts: f, rows };
}

/* Both comment dialects, one regex each; the value between is replaced.
   An unknown key is a build error rather than a silent pass-through. */
const HTML_RE = /<!--@fact ([a-z0-9-]+)-->([\s\S]*?)<!--\/@fact-->/g;
const JS_RE = /\/\*@fact ([a-z0-9-]+)\*\/([\s\S]*?)\/\*\/@fact\*\//g;

function render(text, facts, file) {
  const sub = (re, wrap) => text.replace(re, (m, key, old) => {
    if (!(key in facts)) throw new Error('facts: ' + (file || 'text') + ' uses unknown fact key "' + key + '"');
    return wrap(key, facts[key]);
  });
  text = sub(HTML_RE, (k, v) => '<!--@fact ' + k + '-->' + v + '<!--/@fact-->');
  text = sub(JS_RE, (k, v) => '/*@fact ' + k + '*/' + v + '/*/@fact*/');
  return text;
}

/* The surfaces the build keeps current. All relative to the demo root. */
const SURFACES = ['src/template.html', 'src/appendix.html', 'src/demo-guide.html', 'src/app.js', 'README.md'];

/* Rewrite every surface in place (write=true) or report drift (write=false).
   Returns the list of files that were (or would be) changed. */
function apply(facts, write) {
  const changed = [];
  for (const rel of SURFACES) {
    const p = path.join(here, rel);
    const src = fs.readFileSync(p, 'utf8');
    const out = render(src, facts, rel);
    if (out !== src) {
      changed.push(rel);
      if (write) fs.writeFileSync(p, out);
    }
  }
  return changed;
}

module.exports = { compute, render, apply, SURFACES, INPUTS };

if (require.main === module) {
  const { facts, rows } = compute();
  console.log(JSON.stringify(facts, null, 2));
  console.table(rows.map(r => ({ seed: r.seed, passive: money(r.passive.profit), pWk: r.passive.weeks, pLate: r.passive.late,
    thoughtful: money(r.thoughtful.profit), tWk: r.thoughtful.weeks, tLate: r.thoughtful.late })));
}
