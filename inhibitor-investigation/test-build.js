/* Inhibitor Investigation bundle tests.

   Two halves, and the split matters:

   MECHANISM pins (carried from the pre-kit suite). These guard the model
   bundling and the offline/self-contained property. The 2026-09-16
   lesson-shell retrofit was required not to touch model.js at all, and these
   assertions are how that is checked rather than asserted.

   TEMPLATE pins (new, 2026-09-16). These guard the lesson parts A0-A10 the
   shared kit and the fleet template require: the shell stamp, three stage
   tabs with question subtitles, a stage intro with eyebrow/question/refresh,
   the Predict-Try-Takeaway strip, an observation cue, a five-section Details
   drawer per stage, a check card with feedback on every option, the six-word
   provenance vocabulary, and the Takeaways appearing verbatim as the guide's
   learning goals.
*/
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildHtml } = require('./build.js');
const shell = require('../tools/lesson-shell');
const gc = require('../tools/lesson-shell/guide-contract');

const here = __dirname;
const model = fs.readFileSync(path.join(here, 'model.js'), 'utf8');
const guide = fs.readFileSync(path.join(here, 'src', 'demo-guide.html'), 'utf8');
const index = fs.readFileSync(path.join(here, 'index.html'), 'utf8');

/* --- the bundle is exactly what the sources produce ---------------------- */
assert.equal(index, buildHtml().html, 'index.html must exactly match the checked-in source bundle');
assert.ok(index.includes(model), 'the tested production model must be embedded verbatim');
const scripts = index.split('<script>').slice(1).map(chunk => chunk.split('</script>')[0]);
assert.equal(scripts.length, 3, 'the bundle should contain the lesson shell, the model and the app');
scripts.forEach(script => new Function(script));
/* Load order is load-bearing: app.js reads window.InhibitorModel and calls
   window.lessonShell.onReset, so both must exist before it runs. */
assert.ok(scripts[0].includes('window.lessonShell'), 'script 1 is the lesson shell');
assert.ok(scripts[1].includes('InhibitorModel'), 'script 2 is the model');
assert.ok(scripts[2].includes('InhibitorModel') && scripts[2].includes('window.lessonShell'), 'script 3 is the app, which consumes both');

/* ======================= MECHANISM PINS ================================== */
assert.match(index, /VMAX \* substrate \/ \(a \* KM \+ b \* substrate\)/, 'the rate formula must be the tested one, verbatim');
assert.match(index, /M\.baselineRate/, 'the chart must call the production calibrated-baseline function');
assert.match(index, /M\.curvePoints/, 'the chart must call the production curve-point generator');
assert.match(index, /new-sample-button/, 'the page must expose a fresh mystery sample control');
assert.match(index, /teacher-guide\.html/);

/* --- the display title, in every place it appears ------------------------ */
const TITLE = 'Inhibitor Investigation';
assert.match(index, new RegExp(`<title>${TITLE}</title>`), 'document title');
assert.match(index, new RegExp(`<h1>${TITLE}</h1>`), 'header brand title');
assert.match(guide, new RegExp(`<h1>${TITLE}</h1>`), 'guide heading');

/* ======================= CONTRACT.md REQUIRED UX ========================= */
assert.match(index, /<button class="icon-btn guide-open" type="button" id="guide-open" title="Guide" aria-label="Guide">/,
  'the ? button must be named exactly Guide');
assert.match(index, /<h2 id="guide-title">Guide<span class="head-sub">/, 'the Guide overlay heading must read Guide');

const menuStart = index.indexOf('<div class="lesson-dialog-body" id="settings-menu">');
assert.ok(menuStart > 0, 'the Settings menu must be present');
const menu = index.slice(menuStart, index.indexOf('</dialog>', menuStart));
for (const label of ['Open Presenter Notes', 'Presentation mode', 'Reset']) {
  assert.ok(menu.includes(`>${label}</button>`), `Settings must offer a button labelled exactly "${label}"`);
}
assert.ok(menu.indexOf('Open Presenter Notes') < menu.indexOf('Presentation mode'), 'notes before presentation mode');
assert.ok(menu.indexOf('Presentation mode') < menu.indexOf('>Reset</button>'), 'presentation mode before reset');

/* Reset is IN PLACE as of kit v2 (operator ruling 2026-09-16): the shell
   restores the chrome it owns and dispatches `lessonreset`; this demo restores
   the activity. The NEGATIVE assertion is the load-bearing one: no navigation
   primitive may survive in the shell's script at all. */
const shellJs = scripts[0];
const appJs = scripts[2];
const decomment = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ');
assert.match(decomment(shellJs + '\nlocation.reload();'), /location\.reload\(\)/,
  'the navigation scan must see a reload when one is present (positive control)');
assert.doesNotMatch(decomment(shellJs), /location\.reload\(\)|location\.replace\(/,
  'Reset must not reload or navigate: it is in place as of kit v2');
assert.match(shellJs, /document\.dispatchEvent\(new CustomEvent\('lessonreset'/,
  'the shell must hand the activity back to the demo after restoring its own chrome');
assert.match(appJs, /addEventListener\('lessonreset'/,
  'this demo must implement the reset contract, not merely inherit the shell half');
assert.match(appJs, /caseNumber = 0;\s*\n\s*state = M\.createCase\(caseNumber\);/,
  'lessonreset must draw a fresh case from the same createCase(0) path the page uses on load');
assert.match(appJs, /el\('bench-status'\)\.textContent = FIRST_LOAD\.bench;/,
  'lessonreset must restore the first-load bench status text, which is not a .obs-cue the shell snapshots');
assert.match(appJs, /el\('explanation-feedback'\)\.textContent = FIRST_LOAD\.explanation;/,
  'lessonreset must restore the first-load explanation text');
assert.match(appJs, /el\('transfer-feedback'\)\.textContent = FIRST_LOAD\.transfer;/,
  'lessonreset must restore the first-load transfer text');

/* The presenter notes ARE the printable guide: same bytes, one source. */
const guideBody = gc.extractGuide(guide).html;
assert.ok(guideBody.length > 3000, 'the guide body should be the whole document, not a summary');
assert.ok(index.includes(guideBody), 'the in-app presenter notes must be the guide body, verbatim');
assert.ok(index.includes('.guide-scope .g-foot'), 'the guide stylesheet must be injected too');
const guideCss = guide.slice(guide.indexOf('<style id="guide-css">'), guide.indexOf('\n</style>'));
assert.doesNotMatch(guideCss, /^\s*(body|html)\s*[,{]/m, 'the injected stylesheet must not carry page-level rules');
assert.match(guide, /^<style id="guide-css">$/m, 'the guide-css marker must start its line at column zero');
assert.match(guide, /^<div class="guide-scope">$/m, 'the guide-scope marker must start its line at column zero');

/* --- offline: nothing is fetched to render the page ----------------------- */
assert.doesNotMatch(index, /<(script|link|img|iframe|source|video|audio)\b[^>]*\b(src|href)\s*=\s*["']https?:/i,
  'no external resource may be loaded');
assert.doesNotMatch(index.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' '),
  /\bfetch\s*\(|XMLHttpRequest|new WebSocket|@import|url\(\s*['"]?https?:/,
  'no runtime network calls');

/* ======================= TEMPLATE PINS A0-A10 ============================= */

/* A0 — the kit is carried, with the CSS hash of the kit on disk. */
const stamp = shell.readStamp(index);
assert.ok(stamp, 'A0: the built file must carry a lesson-shell stamp');
assert.equal(stamp.version, shell.VERSION, 'A0: built against the current kit version');
assert.equal(stamp.cssHash, shell.cssHash(), 'A0: built against the current kit CSS');
for (const token of shell.REQUIRED_TOKENS) {
  assert.ok(new RegExp('\\' + token + '\\s*:').test(index), `A0: required token ${token} must be defined`);
}
assert.match(index, /<div class="bh-credit">Bryant Harrison &middot; Murray State University<\/div>/,
  'A0: the credit pill text is the fleet spec, with no build-provenance suffix');

/* A1 — three stage tabs, each with a question subtitle, keyboard and hash. */
const tabs = index.match(/<button class="stage-tab"[\s\S]*?<\/button>/g) || [];
assert.equal(tabs.length, 3, 'A1: three stage tabs');
assert.match(index, /<nav class="stages" role="tablist"/, 'A1: the stage nav is a tablist');
tabs.forEach((tab, i) => {
  const sub = tab.match(/<small>([^<]*)<\/small>/);
  assert.ok(sub, `A1: tab ${i + 1} needs a subtitle`);
  assert.ok(sub[1].trim().endsWith('?'), `A1: tab ${i + 1} subtitle must be a question: "${sub[1]}"`);
});
assert.match(shellJs, /\^stage-\(\\d\+\)\$/, 'A1: a #stage-N fragment selects a stage');
assert.match(shellJs, /ArrowRight|ArrowLeft/, 'A1: tabs are arrow-key navigable');
assert.match(shellJs, /t\.tabIndex = on \? 0 : -1/, 'A1: roving tabindex');
/* This demo gates nothing at the tab level (see B-inhibitor-investigation
   progress notes on the "explain before reveal" content gate vs. a tab lock),
   so no tab may carry `disabled` in the built markup. */
tabs.forEach((tab, i) => assert.doesNotMatch(tab, /\bdisabled\b/, `A1: tab ${i + 1} must not be disabled — this demo has no tab-level gate`));

/* A2 — three stage intros: eyebrow, one question, refresh, and the strip. */
const stages = index.match(/<section class="stage[^"]*" id="stage-\d"[\s\S]*?(?=<section class="stage[^"]*" id="stage-\d"|<\/main>)/g) || [];
assert.equal(stages.length, 3, 'A2: three stage panels');
const TAKEAWAYS = [];
stages.forEach((stage, i) => {
  const n = i + 1;
  assert.match(stage, /<span class="eyebrow">Demo 14 of 17 &middot; Part four/, `A2: stage ${n} eyebrow places the demo on the path`);
  const q = stage.match(/<p class="stage-question">([\s\S]*?)<\/p>/);
  assert.ok(q, `A2: stage ${n} needs a stage question`);
  assert.equal((stage.match(/class="stage-question"/g) || []).length, 1,
    `A2: stage ${n} must show exactly one question — two is split attention`);
  assert.ok(q[1].includes('?'), `A2: stage ${n} question must be a question`);
  assert.match(stage, /<p class="refresh"><b>Before you start\.<\/b>/, `A2: stage ${n} needs a prerequisite refresh`);
  const strip = stage.match(/<div class="lesson-strip"[\s\S]*?<\/div>\s*<\/section>/);
  assert.ok(strip, `A2: stage ${n} needs a lesson strip`);
  const labels = (strip[0].match(/<article><span>([^<]+)<\/span>/g) || []).map(s => s.replace(/.*<span>/, '').replace('</span>', ''));
  assert.deepEqual(labels, ['Predict', 'Try', 'Takeaway'], `A2: stage ${n} strip labels, in order`);
  const takeaway = strip[0].match(/<span>Takeaway<\/span><p>([\s\S]*?)<\/p>/);
  assert.ok(takeaway && takeaway[1].trim().length > 20, `A2: stage ${n} Takeaway must be a real claim`);
  TAKEAWAYS.push(takeaway[1].trim());
  const predict = strip[0].match(/<span>Predict<\/span><p>([\s\S]*?)<\/p>/);
  assert.ok(predict && predict[1].includes('?'), `A2: stage ${n} Predict must pose a concrete prediction`);
  const tryCard = strip[0].match(/<span>Try<\/span><p>([\s\S]*?)<\/p>/);
  const control = tryCard[1].match(/<b>([^<]+)<\/b>/);
  assert.ok(control, `A2: stage ${n} Try must name a control in bold`);
});
/* The operator amendment: no stated objective anywhere a learner reads. */
assert.doesNotMatch(index, /You will be able to/i, 'A2: no objective-shaped line anywhere in the demo');
assert.doesNotMatch(guide, /You will be able to/i, 'A9: no objective-shaped line in the guide either');
/* And the deliberately-matched-set qualifier stays on screen (accuracy note
   from the batch-builder brief): the tie is real but scoped to this set. */
assert.match(index, /deliberately matched set/, 'A3/A5: the "deliberately matched set" qualifier must stay on screen');
assert.match(guide, /deliberately matched/i, 'A9: the guide must carry the same qualifier');

/* A3 — the six-word provenance vocabulary, and nothing else. */
const kickersUsed = [...new Set((index.match(/class="k-[a-z-]+"/g) || []).map(s => s.slice(7, -1)))];
kickersUsed.filter(k => k !== shell.QUALIFIER_CLASS).forEach(k => {
  assert.ok(shell.KICKERS.includes(k), `A3: ${k} is not one of the six provenance words`);
});
assert.ok(kickersUsed.includes('k-scripted'), 'A3: the synthetic rates must be labelled Scripted, not Measured');
assert.ok(kickersUsed.includes('k-live'), 'A3: the on-page comparisons must be labelled Live');
assert.ok(!kickersUsed.some(k => k === 'k-measured'), 'A3: nothing here is Measured — the rates are Scripted, not real assay readings taken earlier');

/* A4 — an observation cue per stage. */
for (let i = 1; i <= 3; i += 1) {
  assert.match(index, new RegExp(`id="cue-${i}"[^>]*class="obs-cue"|class="obs-cue" id="cue-${i}"`), `A4: stage ${i} needs an obs-cue`);
}

/* A5 — a five-section Details drawer per stage, and the excluded-mechanisms /
   S=Km tie content the accuracy note requires. */
const detailsStages = index.match(/<section class="details-stage[^"]*"[\s\S]*?(?=<section class="details-stage|<\/div>\s*<form method="dialog" class="lesson-dialog-actions">)/g) || [];
assert.equal(detailsStages.length, 3, 'A5: three details-stage sections');
detailsStages.forEach((d, i) => {
  assert.match(d, /<h3>How it works<\/h3>/, `A5: details-stage ${i} needs How it works`);
  assert.match(d, /Assumptions and simplifications/, `A5: details-stage ${i} needs Assumptions and simplifications`);
  assert.match(d, /<h3>Sources<\/h3>/, `A5: details-stage ${i} needs Sources`);
  assert.match(d, /evidence-card/, `A5: details-stage ${i} needs a Boundary card`);
});
assert.match(index, /v = Vmax&middot;S \/ \(a&middot;Km \+ b&middot;S\)/, 'A5: the formula must appear in Details');
assert.match(index, /a=3, b=1/, 'A5: competitive factors must appear');
assert.match(index, /a=1, b=3/, 'A5: uncompetitive factors must appear');
assert.match(index, /mixed, partial, allosteric, tight-binding, time-dependent/, 'A5: the excluded-mechanisms list must appear');
assert.match(index, /www\.ncbi\.nlm\.nih\.gov\/books\/NBK92001/, 'A5: the NIH Assay Guidance Manual source must resolve in Sources');

/* A6 — a check card per stage, at least one refutation item, feedback on every option. */
const checks = index.match(/<section class="check"[\s\S]*?<\/section>/g) || [];
assert.equal(checks.length, 3, 'A6: three check-yourself cards');
checks.forEach((c, i) => {
  assert.match(c, /data-refutation="true"/, `A6: check ${i + 1} must be marked data-refutation`);
  const options = c.match(/<button class="check-option[^"]*"[\s\S]*?<\/button>/g) || [];
  assert.equal(options.length, 2, `A6: check ${i + 1} needs two options`);
  options.forEach(o => assert.match(o, /data-feedback="[^"]{20,}"/, `A6: every check option needs written feedback`));
  assert.ok(options.some(o => o.includes('class="check-option correct"')), `A6: check ${i + 1} needs a correct option`);
  assert.ok(options.some(o => o.includes('class="check-option wrong"')), `A6: check ${i + 1} needs a wrong (refutation) option`);
});

/* A7 — the Guide, <=250 words, no unfilled bold-control reference issues. */
const guideDialogMatch = index.match(/<dialog class="lesson-dialog" id="guide"[\s\S]*?<\/dialog>/);
assert.ok(guideDialogMatch, 'A7: the Guide dialog must exist');
const guideWords = guideDialogMatch[0].replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
assert.ok(guideWords <= 260, `A7: the Guide body should be about 250 words or fewer; got ${guideWords}`);

/* A8 — the contract triad, and Reset is a real control. */
assert.match(index, /id="reset-btn">Reset</, 'A8: Reset must be a labelled control');
assert.match(index, /id="presentation-btn"/, 'A8: Presentation mode control must exist');

/* A9 — the guide's Learning goals carry the stage Takeaways verbatim, and
   there is at least one .mis card per stage. */
TAKEAWAYS.forEach((takeaway, i) => {
  const plain = takeaway.replace(/&mdash;/g, '—').replace(/&middot;/g, '·');
  const guidePlain = guide.replace(/&mdash;/g, '—').replace(/&middot;/g, '·');
  assert.ok(guidePlain.includes(plain), `A9: stage ${i + 1} Takeaway must appear verbatim under Learning goals`);
});
assert.equal((guide.match(/class="mis"/g) || []).length, 3, 'A9: one .mis misconception card per stage');

/* A10 — build parity and self-containment, already proved above by
   buildHtml() equality and the zero-<script src> assertion; check-shell.js
   and build-hub.js --check are run separately (not node-suite concerns). */

console.log('PASS  mechanism pins (model bundling, offline contract) and template pins A0-A10 (three ungated stages, six-word provenance vocabulary, reset contract, Details/Guide/Check content, Takeaways-as-learning-goals)');
