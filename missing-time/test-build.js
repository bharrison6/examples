/* Gaps in the Rock Record bundle tests.

   Two halves, and the split matters:

   MECHANISM pins (carried from the pre-kit suite). These guard the model's
   ledger math, case texts and offline invariants. The 2026-09-16 lesson-shell
   retrofit was required not to touch any of them, and these assertions are
   how that is checked rather than asserted.

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
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { buildHtml } = require('./build.js');
const shell = require('../tools/lesson-shell');
const gc = require('../tools/lesson-shell/guide-contract');

const here = __dirname;
const model = fs.readFileSync(path.join(here, 'src', 'model.js'), 'utf8');
const guide = fs.readFileSync(path.join(here, 'src', 'demo-guide.html'), 'utf8');
const index = fs.readFileSync(path.join(here, 'index.html'), 'utf8');

/* --- the bundle is exactly what the sources produce ---------------------- */
assert.equal(index, buildHtml().html, 'index.html must exactly match the checked-in source bundle');
assert.ok(index.includes(model), 'the tested production model must be embedded verbatim');
const scripts = [...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]);
assert.equal(scripts.length, 3, 'the bundle should contain the model, the lesson shell and the app');
scripts.forEach((source, i) => new vm.Script(source, { filename: 'index.html inline script ' + (i + 1) }));
assert.ok(scripts[0].includes('MissingTimeModel'), 'script 1 is the model');
assert.ok(scripts[1].includes('window.lessonShell'), 'script 2 is the lesson shell');
assert.ok(scripts[2].includes('MissingTimeModel'), 'script 3 is the app, which consumes the model');

/* ======================= MECHANISM PINS ================================== */
/* Case texts, preserved verbatim from the pre-kit build (work order: "Preserve
   model.js, case texts"). These live in model.js (embedded verbatim above,
   which already pins them) and in app.js's LABELS map — pin the latter
   directly since it is not part of model.js. */
assert.match(index, /A local last observation in continuous sampled rock cannot establish global extinction\./);
assert.match(index, /Equal rock thickness means equal elapsed time\./);
assert.match(index, /The local gap does not identify its cause or establish an extinction boundary\./);
assert.match(index, /A fossil can be moved to the erosion boundary after its layer is removed\./);
assert.match(index, /The second local section preserves an interval missing at the first\./);
assert.match(index, /Two sections certify global extinction\./);
/* The two load-bearing accuracy claims named in the work order, kept on
   screen (Details Assumptions + the Stage-2 Check-yourself item). */
assert.match(index, /only source of an?\s*exact Myr value anywhere in this activity/i,
  'exact gap/age values must be attributed only to supplied chronology, never derived from thickness');
assert.match(index, /erosion deletes; it does not relocate/i,
  'a removed fossil must not be described as relocating to the boundary');
assert.match(index, /nothing is relocated to the boundary that erosion leaves behind/);
/* The model's own math is untouched: spot-check the ledger's constant-rate
   mapping and the erosion top-down removal are still the mechanism app.js
   drives (these strings live in model.js, embedded verbatim, so this also
   guards against a silent model edit slipping in unnoticed). */
assert.match(index, /originalThicknessM = event\.durationMyr \* event\.rateMPerMyr/);
assert.match(index, /const take = Math\.min\(layer\.survivingThicknessM, remaining\)/);

/* --- presenter notes ARE the printable guide ------------------------------ */
const guideBody = gc.extractGuide(guide).html;
assert.ok(guideBody.length > 3000, 'the guide body should be the whole document, not a summary');
assert.ok(index.includes(guideBody), 'the in-app presenter notes must be the guide body, verbatim');
assert.ok(index.includes('.guide-scope .g-foot'), 'the guide stylesheet must be injected too');
assert.match(guide, /^<style id="guide-css">$/m, 'the guide-css marker must start its line at column zero');
assert.match(guide, /^<div class="guide-scope">$/m, 'the guide-scope marker must start its line at column zero');

/* --- offline at runtime ---------------------------------------------------- */
assert.ok(!/<(?:script|link|img|iframe|source|video|audio|embed|object)\b[^>]+(?:https?:)?\/\//i.test(index),
  'no external runtime assets are referenced');
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon|@import|url\(\s*['"]?https?:/i.test(index),
  'the page performs no network access at runtime');

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

/* --- Reset is IN PLACE as of kit v2 --------------------------------------- */
const shellJs = scripts[1];
const appJs = scripts[2];
const decomment = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ');
assert.match(decomment(shellJs + '\nlocation.reload();'), /location\.reload\(\)/,
  'the navigation scan must see a reload when one is present (positive control)');
assert.doesNotMatch(decomment(shellJs), /location\.reload\(\)|location\.replace\(/,
  'Reset must not reload or navigate: it is in place as of kit v2');
assert.match(shellJs, /document\.dispatchEvent\(new CustomEvent\('lessonreset'/,
  'the shell must hand the activity back to the demo after restoring its own chrome');
assert.match(shellJs, /window\.lessonShell\.onReset\(\) === false\) return false;/,
  'the onReset veto must still be consulted first');
assert.match(appJs, /addEventListener\('lessonreset'/,
  'this demo must implement the reset contract, not merely inherit the shell half');
assert.match(appJs, /window\.lessonShell\.onReset = null;/,
  'this demo has nothing to veto a reset for, and says so rather than leaving the hook unset');

/* ======================= TEMPLATE PINS A0-A10 ============================= */

/* A0 */
const stamp = shell.readStamp(index);
assert.ok(stamp, 'A0: the built file must carry a lesson-shell stamp');
assert.equal(stamp.version, shell.VERSION, 'A0: built against the current kit version');
assert.equal(stamp.cssHash, shell.cssHash(), 'A0: built against the current kit CSS');
for (const token of shell.REQUIRED_TOKENS) {
  assert.ok(new RegExp('\\' + token + '\\s*:').test(index), `A0: required token ${token} must be defined`);
}
assert.match(index, /<div class="bh-credit">Bryant Harrison &middot; Murray State University<\/div>/,
  'A0: the credit pill text is the fleet spec, with no build-provenance suffix');

/* A1 — three stage tabs, each with a question subtitle. */
const tabs = index.match(/<button class="stage-tab"[\s\S]*?<\/button>/g) || [];
assert.equal(tabs.length, 3, 'A1: three stage tabs, one per case');
assert.match(index, /<nav class="stages" role="tablist"/, 'A1: the stage nav is a tablist');
tabs.forEach((tab, i) => {
  const sub = tab.match(/<small>([^<]*)<\/small>/);
  assert.ok(sub, `A1: tab ${i + 1} needs a subtitle`);
  assert.ok(sub[1].trim().endsWith('?'), `A1: tab ${i + 1} subtitle must be a question: "${sub[1]}"`);
});

/* A2 — three stage intros: eyebrow, one question, refresh, and the strip. */
const stages = index.match(/<section class="stage[^"]*" id="stage-\d"[\s\S]*?(?=<section class="stage[^"]*" id="stage-\d"|<\/main>)/g) || [];
assert.equal(stages.length, 3, 'A2: three stage panels, one per case');
const TAKEAWAYS = [];
stages.forEach((stageHtml, i) => {
  const n = i + 1;
  assert.match(stageHtml, /<span class="eyebrow">Demo 15 of 17 &middot; Part four &middot; Geology &middot; Stage \d<\/span>/,
    `A2: stage ${n} eyebrow places the demo on the path`);
  const q = stageHtml.match(/<p class="stage-question">([\s\S]*?)<\/p>/);
  assert.ok(q, `A2: stage ${n} needs a stage question`);
  assert.equal((stageHtml.match(/class="stage-question"/g) || []).length, 1,
    `A2: stage ${n} must show exactly one question`);
  assert.ok(q[1].includes('?'), `A2: stage ${n} question must be a question`);
  assert.match(stageHtml, /<p class="refresh"><b>Before you start\.<\/b>/, `A2: stage ${n} needs a prerequisite refresh`);
  const strip = stageHtml.match(/<div class="lesson-strip"[\s\S]*?<\/div>\s*<\/section>/);
  assert.ok(strip, `A2: stage ${n} needs a lesson strip`);
  const labels = (strip[0].match(/<article><span>([^<]+)<\/span>/g) || []).map(s => s.replace(/.*<span>/, '').replace('</span>', ''));
  assert.deepEqual(labels, ['Predict', 'Try', 'Takeaway'], `A2: stage ${n} strip labels, in order`);
  const takeaway = strip[0].match(/<span>Takeaway<\/span><p>([\s\S]*?)<\/p>/);
  assert.ok(takeaway && takeaway[1].trim().length > 20, `A2: stage ${n} Takeaway must be a real claim`);
  TAKEAWAYS.push(takeaway[1].trim());
  const predict = strip[0].match(/<span>Predict<\/span><p>([\s\S]*?)<\/p>(?:<\/article>)?/);
  assert.ok(predict && predict[1].includes('?'), `A2: stage ${n} Predict must pose a concrete prediction`);
  /* The Predict card captures a guess via a button pair, per A2's "where the
     activity can capture the prediction, it must." */
  assert.match(strip[0], /class="mt-predict-btns"/, `A2: stage ${n} Predict must capture a guess`);
});
assert.doesNotMatch(index, /You will be able to/i, 'A2: no objective-shaped line anywhere in the demo');
/* Scoped to the injected guide BODY, not the raw source file: this file's own
   head comment names the forbidden phrase while explaining the rule (as does
   two-winters' — the rule is about learner/presenter-facing text, not about
   engineering comments describing the rule itself). */
assert.doesNotMatch(guideBody, /You will be able to/i, 'A9: no objective-shaped line in the guide body either');

/* A3 — the six-word provenance vocabulary, and nothing else. */
const kickersUsed = [...new Set((index.match(/class="k-[a-z-]+"/g) || []).map(s => s.slice(7, -1)))];
kickersUsed.filter(k => k !== shell.QUALIFIER_CLASS).forEach(k => {
  assert.ok(shell.KICKERS.includes(k), `A3: ${k} is not one of the six provenance words`);
});
assert.ok(kickersUsed.includes('k-live'), 'A3: the computed evidence panels are labelled Live');
assert.ok(kickersUsed.includes('k-scripted'), 'A3: the case histories are labelled Scripted');
assert.match(index, /<label class="control-label" for="showGapsButton">/, 'A3: the control carries a purpose label');
assert.match(index, /class="why"/, 'A3: a purpose label says why you would change it');

/* A4 — an observation cue, aria-live. */
assert.match(index, /<p class="obs-cue" id="cue-core" role="status" aria-live="polite">/, 'A4: the core cue is a live region');
assert.match(appJs, /byCase\[caseId\]\.cue = /, 'A4: sampling and revealing chronology set the cue');

/* A5 — one Details section per stage, each with the five fixed sections. */
const detailStages = index.match(/<section class="details-stage[^"]*" data-details-stage="\d"[\s\S]*?(?=<section class="details-stage|<\/div>\s*<form method="dialog" class="lesson-dialog-actions")/g) || [];
assert.equal(detailStages.length, 3, 'A5: one Details section per case');
detailStages.forEach((section, i) => {
  assert.match(section, /<span class="eyebrow">What is live/, `A5: stage ${i + 1} names what is live`);
  assert.match(section, /<h3>How it works<\/h3>/, `A5: stage ${i + 1} explains the mechanism`);
  assert.match(section, /<h3>Assumptions and simplifications<\/h3>/, `A5: stage ${i + 1} lists its assumptions`);
  assert.match(section, /<h3>Sources<\/h3>/, `A5: stage ${i + 1} lists sources`);
  assert.match(section, /class="evidence-card"><b>Boundary:<\/b>/, `A5: stage ${i + 1} states its boundary`);
  assert.ok(/class="claim"/.test(section), `A5: stage ${i + 1} must label its claim-bearing prose`);
  (section.match(/<div class="claim">[\s\S]*?<\/div>/g) || []).forEach((claim, j) => {
    assert.ok(shell.KICKERS.some(k => claim.includes(`"${k}"`)),
      `A5: stage ${i + 1} claim ${j} has no provenance kicker`);
  });
});

/* A6 — a check per stage, feedback on EVERY option, refutation items. */
const checks = index.match(/<section class="check"[\s\S]*?<\/section>/g) || [];
assert.equal(checks.length, 3, 'A6: one check-yourself card per stage');
let refutations = 0;
checks.forEach((card, i) => {
  const options = card.match(/<button class="check-option[^"]*"[\s\S]*?<\/button>/g) || [];
  assert.ok(options.length >= 2, `A6: check ${i + 1} needs at least two options`);
  options.forEach(opt => {
    const fb = opt.match(/data-feedback="([^"]*)"/);
    assert.ok(fb && fb[1].trim().length > 20, `A6: every option in check ${i + 1} needs written feedback`);
  });
  assert.equal((card.match(/check-option correct/g) || []).length, 1, `A6: check ${i + 1} has one correct option`);
  if (card.includes('data-refutation="true"')) refutations += 1;
});
assert.equal(refutations, 3, 'A6: every stage carries a refutation item here');

/* A9 — the guide carries every Takeaway verbatim as a learning goal. */
assert.equal(TAKEAWAYS.length, 3);
TAKEAWAYS.forEach((takeaway, i) => {
  assert.ok(guide.includes(takeaway),
    `A9: stage ${i + 1}'s Takeaway must appear verbatim under the guide's Learning goals:\n  ${takeaway}`);
});
assert.ok((guide.match(/class="mis"/g) || []).length >= 3, 'A9: at least one misconception card per stage');
assert.match(guide, /class="say"/, 'A9: a line for the presenter to say');
assert.match(guide, /<h2>Learning goals<\/h2>/, 'A9: the guide has a Learning goals section');
assert.match(guide, /<h2>Where this sits on the path<\/h2>/, 'A9: the guide places the demo on the path');
assert.match(guide, /<h2>One question for the session<\/h2>/, 'A9: the guide names the session question');
const guideWords = guideBody.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
assert.ok(guideWords <= 2500, `A9: the guide must stay in the 2-4 page band (<=2500 words); it is ${guideWords}`);
assert.ok(guideWords >= 900, `A9: the guide must be a real session plan; it is only ${guideWords} words`);

/* --- --check is a real drift gate, proved both ways ----------------------- */
const clean = spawnSync(process.execPath, ['build.js', '--check'], { cwd: here, encoding: 'utf8' });
assert.equal(clean.status, 0, clean.stderr || clean.stdout);
assert.match(clean.stdout, /build parity OK/);

/* Negative control: a copy of the demo whose guide has been edited without a
   rebuild must FAIL the same check, and a change to the shared kit must too. */
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'missing-time-drift-'));
try {
  const demoDir = path.join(sandbox, 'missing-time');
  fs.mkdirSync(path.join(demoDir, 'src'), { recursive: true });
  fs.cpSync(path.join(here, '..', 'tools', 'lesson-shell'), path.join(sandbox, 'tools', 'lesson-shell'), { recursive: true });
  for (const file of ['build.js', 'index.html', 'teacher-guide.html', 'teacher-guide.pdf']) {
    fs.copyFileSync(path.join(here, file), path.join(demoDir, file));
  }
  for (const file of ['template.html', 'styles.css', 'app.js', 'model.js', 'demo-guide.html']) {
    fs.copyFileSync(path.join(here, 'src', file), path.join(demoDir, 'src', file));
  }

  const sane = spawnSync(process.execPath, ['build.js', '--check'], { cwd: demoDir, encoding: 'utf8' });
  assert.equal(sane.status, 0, 'the untouched sandbox copy must pass --check first: ' + (sane.stderr || sane.stdout));

  const driftedGuide = path.join(demoDir, 'src', 'demo-guide.html');
  fs.writeFileSync(driftedGuide, fs.readFileSync(driftedGuide, 'utf8')
    .replace('Discussion questions', 'Discussion questions (edited without a rebuild)'));
  const drifted = spawnSync(process.execPath, ['build.js', '--check'], { cwd: demoDir, encoding: 'utf8' });
  assert.equal(drifted.status, 1, 'editing the guide without rebuilding must fail --check');
  assert.match(drifted.stderr, /MISMATCH/);

  const kitCss = path.join(sandbox, 'tools', 'lesson-shell', 'shell.css');
  fs.writeFileSync(kitCss, fs.readFileSync(kitCss, 'utf8') + '\n.bh-credit { color: red; }\n');
  const kitDrift = spawnSync(process.execPath, ['build.js', '--check'], { cwd: demoDir, encoding: 'utf8' });
  assert.equal(kitDrift.status, 1, 'changing the shared kit without rebuilding must fail --check');
  const kitCheck = spawnSync(process.execPath,
    [path.join(sandbox, 'tools', 'lesson-shell', 'check-shell.js'), 'missing-time'],
    { cwd: sandbox, encoding: 'utf8' });
  assert.equal(kitCheck.status, 1, 'check-shell must fail a demo built against an older kit');
  assert.match(kitCheck.stderr, /shell CSS has changed since this was built/);
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}

console.log('Gaps in the Rock Record bundle: mechanism pins (ledger math, case texts, the two');
console.log('  load-bearing accuracy claims), CONTRACT Guide/Settings/Reset chrome, notes-equal-guide');
console.log('  injection, offline bundle, template parts A0-A6 and A9, and a drift gate proved in');
console.log('  three directions including a change to the shared kit.');
