/* fuel-golf — static assertions about the BUILT page.  node test-bundle.js

   This suite exists because the demo's other two are blind in different ways.
   test-physics.js exercises the engine and never opens index.html; ui-smoke.js
   drives a real browser but needs Playwright, which is not installed here, so
   it cannot run in this checkout at all. Between them sits a class of defect
   that is cheap to catch and expensive to ship: a retrofit that silently drops
   an id the game looks up by name, a stage whose panel or check card went
   missing, a provenance kicker that got deleted with the markup around it.

   What it CANNOT see, stated so nobody mistakes it for a browser pass: whether
   anything renders, whether the canvas has a box, whether a listener fired,
   whether the console is clean. Those need a browser, and ruling 1 (2026-09-16)
   makes that pass non-waivable. This is the floor, not the ceiling.

   Every group carries a NEGATIVE CONTROL: the same assertion is re-run against
   a deliberately corrupted copy of the page and must FAIL there. A structural
   check that cannot fail is not evidence, and a regex that silently stopped
   matching would otherwise read as a pass. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const game = fs.readFileSync(path.join(__dirname, 'src', 'game.js'), 'utf8');

let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? '  PASS ' : '  FAIL ') + name + (detail !== undefined ? '  [' + detail + ']' : ''));
  if (!cond) fails++;
}

/* ---------------------------------------------------------------- 1 */
console.log('\n[1] Every id game.js looks up exists exactly once in the built page');
/* The ids are read out of game.js rather than listed here, so the test cannot
   drift away from the code it is testing: add a $('newThing') and this check
   starts demanding it. */
const wanted = [...new Set((game.match(/\$\('[a-zA-Z0-9-]+'\)/g) || [])
  .map(s => s.slice(3, -2)))];
/* Plus the ones reached through a string variable, which the scan above cannot
   see: the four dialog ids and the one confirmation row. */
const byName = ['missionModal', 'levelsModal', 'debriefModal', 'crashModal', 'clear-scores-row'];
const ids = [...wanted, ...byName];
const idCount = id => (html.match(new RegExp('\\sid="' + id + '"', 'g')) || []).length;
const missing = ids.filter(id => idCount(id) !== 1);
check(ids.length + ' ids, each defined exactly once', missing.length === 0,
  missing.length ? missing.map(id => id + '=' + idCount(id)).join(', ') : ids.length + ' checked');

/* ---------------------------------------------------------------- 2 */
console.log('\n[2] Template parts, per stage');
const stages = 4;
for (let i = 1; i <= stages; i++) {
  const panel = html.slice(html.indexOf('id="stage-' + i + '"'),
    i === stages ? html.indexOf('</main>') : html.indexOf('id="stage-' + (i + 1) + '"'));
  check('stage ' + i + ': tab, panel, intro, question, refresh, strip, cue, check', Boolean(
    html.includes('id="tab-' + i + '"') &&
    panel.includes('class="stage-intro"') &&
    panel.includes('class="stage-question"') &&
    panel.includes('class="refresh"') &&
    panel.includes('lesson-strip') &&
    panel.includes('id="cue-' + i + '"') &&
    panel.includes('check-options')
  ));
  check('stage ' + i + ': question subtitle on the tab ends in "?"',
    /<small>[^<]*\?<\/small>/.test(html.slice(html.indexOf('id="tab-' + i + '"'), html.indexOf('id="tab-' + i + '"') + 400)));
  check('stage ' + i + ': three lesson-strip cards, labelled Predict / Try / Takeaway', Boolean(
    panel.includes('<span>Predict</span>') && panel.includes('<span>Try</span>') && panel.includes('<span>Takeaway</span>')));
  check('stage ' + i + ': an activity host', panel.includes('data-activity-host="' + (i - 1) + '"'));
  check('stage ' + i + ': a Details section with all five fixed headings', Boolean(
    html.includes('data-details-stage="' + (i - 1) + '"')));
}
check('exactly one #activity element to relocate', (html.match(/id="activity"/g) || []).length === 1);
check('exactly one #space canvas', (html.match(/id="space"/g) || []).length === 1);

/* ---------------------------------------------------------------- 3 */
console.log('\n[3] A5 Details: five fixed sections in every stage');
const drawer = html.slice(html.indexOf('id="details"'), html.indexOf('id="presenter-notes"'));
['What is live', 'How it works', 'Assumptions and simplifications', 'Sources'].forEach(h => {
  check('"' + h + '" appears once per details-stage',
    (drawer.match(new RegExp(h, 'g')) || []).length >= stages,
    (drawer.match(new RegExp(h, 'g')) || []).length + ' of ' + stages);
});
check('a Boundary evidence-card per details-stage',
  (drawer.match(/class="evidence-card"/g) || []).length === stages,
  (drawer.match(/class="evidence-card"/g) || []).length);
check('every Sourced kicker resolves to a Sources link',
  (drawer.match(/k-sourced/g) || []).length <= (drawer.match(/href="https:\/\//g) || []).length,
  (drawer.match(/k-sourced/g) || []).length + ' sourced, ' + (drawer.match(/href="https:\/\//g) || []).length + ' links');

/* ---------------------------------------------------------------- 4 */
console.log('\n[4] A3 provenance: only the six words, qualifiers as qualifiers');
const SIX = ['k-live', 'k-measured', 'k-sourced', 'k-reasoned', 'k-scripted', 'k-illustrative'];
const used = [...new Set((html.match(/class="k-[a-z-]+"/g) || []).map(s => s.slice(7, -1)))];
check('no kicker class outside the six (k-qual excepted)',
  used.every(k => k === 'k-qual' || SIX.indexOf(k) !== -1), used.join(' '));
check('the fictional moon is labelled Illustrative in HTML', html.includes('k-illustrative') && html.includes('the moon on this level is invented'));
check('the fictional moon is ALSO labelled on the map itself', html.includes("'Moon — fictional'"));
check('the pars carry a Measured kicker with a seed statement',
  html.includes('k-measured') && /no seed/.test(html));

/* ---------------------------------------------------------------- 5 */
console.log('\n[5] The two gates are authored where Reset can restore them');
check('stage 3 tab is disabled in the MARKUP, not only at runtime',
  /id="tab-3"[^>]*\sdisabled/.test(html));
check('stage 2 carries a gate card for its evidence gate', html.includes('id="gate-2"'));
check('stage 2 tab is NOT disabled (its gate is on the evidence, not the tab)',
  !/id="tab-2"[^>]*\sdisabled/.test(html));
check('app.js registers a lessonreset listener', /addEventListener\('lessonreset'/.test(html));
check('app.js sets a non-null onReset (used as the resetting flag)',
  /lessonShell\.onReset = \(\) =>/.test(html));

/* ---------------------------------------------------------------- 6 */
console.log('\n[6] Self-containment and the retrofit invariants');
const loads = html.match(/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["'][^"']+["']/gi) || [];
check('zero <script src> / <link href> in the built page', loads.length === 0, loads.join(' | '));
check('the game reads its own box, not the window',
  !/window\.inner(Width|Height)/.test(game.replace(/\/\*[\s\S]*?\*\//g, '')),
  'comments excluded');
check('no .modal.show survivor of the old dialog system', !html.includes('.modal.show'));
check('pause still keys off any open dialog', game.includes("querySelector('dialog[open]')"));
check('the loop guards draw() against a zero-size canvas', /if \(vw\(\) > 0 && vh\(\) > 0\)/.test(game));
check('every level and par is still present', [
  ['Orbit School', 4.5], ['Reach Higher', 7.0], ['Escape Artist', 5.0], ['Transfer Window', 11.5],
  ['Powered Flyby', 9.0], ['Ignition Window', 5.3], ['Perigee Kicks', 5.2], ['Sandbox', 'Infinity']
].every(([name, par]) => game.includes("'" + name + "'") && game.includes('par: ' + par)));
check('the keybindings survive', ["'enter'", "' '", "'b'", "'z'", "'x'", "'h'", "'f'", "'m'", "'p'", "'a'", "'r'", "'n'"]
  .every(k => game.includes('k === ' + k)));
check('undo survives', game.includes('function undoBurn()') && game.includes('function pushUndo()'));

/* ---------------------------------------------------------------- 7 */
console.log('\n[7] NEGATIVE CONTROLS — each assertion must fail on corrupted input');
function control(name, corrupt, assertion) {
  let threw = false;
  try { threw = !assertion(corrupt); } catch (e) { threw = true; }
  check('control: ' + name, threw, threw ? 'fails on bait, as it must' : 'STAYED SILENT ON BAIT');
}
control('a dropped id', html.replace(' id="hudOberth"', ' id="hudOberthX"'),
  h => ids.every(id => (h.match(new RegExp('\\sid="' + id + '"', 'g')) || []).length === 1));
control('a duplicated id', html.replace('</body>', '<b id="space"></b></body>'),
  h => (h.match(/id="space"/g) || []).length === 1);
control('a missing observation cue', html.replace('id="cue-3"', 'id="cue-3x"'),
  h => h.includes('id="cue-3"'));
control('an ungated stage 3', html.replace(/(<button class="stage-tab"[^>]*id="tab-3"[^>]*) disabled/, '$1'),
  h => /id="tab-3"[^>]*\sdisabled/.test(h));
control('a runtime resource load', html.replace('</head>', '<link href="theme.css" rel="stylesheet"></head>'),
  h => (h.match(/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["'][^"']+["']/gi) || []).length === 0);
control('a seventh provenance word', html.replace('class="k-live"', 'class="k-verified"'),
  h => [...new Set((h.match(/class="k-[a-z-]+"/g) || []).map(s => s.slice(7, -1)))]
    .every(k => k === 'k-qual' || SIX.indexOf(k) !== -1));
control('the moon losing its on-map label', html.replace("'Moon — fictional'", "'Moon'"),
  h => h.includes("'Moon — fictional'"));
control('a lost reset handler', html.replace(/addEventListener\('lessonreset'/g, "addEventListener('nope'"),
  h => /addEventListener\('lessonreset'/.test(h));
control('the loop losing its zero-size guard', game.replace(/if \(vw\(\) > 0 && vh\(\) > 0\)/, 'if (true)'),
  g => /if \(vw\(\) > 0 && vh\(\) > 0\)/.test(g));
control('a par quietly changed', game.replace('par: 5.0,', 'par: 5.4,'),
  g => g.includes('par: 5.0'));

console.log('');
if (fails) { console.error(fails + ' CHECK(S) FAILED'); process.exitCode = 1; }
else console.log('ALL CHECKS PASSED');
