/* Ion Flight bundle tests.

   Two halves, and the split matters:

   MECHANISM pins (unchanged from the 2026-09-08/09-10 suite, verbatim). These
   guard the physics, the animation clock, the prediction lock and the summed
   detector trace. The 2026-09-15 lesson-shell retrofit was required not to
   touch any of them, and these assertions are how that is checked rather than
   asserted.

   TEMPLATE pins (new, 2026-09-15). These guard the lesson parts A0-A10 the
   shared kit and the fleet template require: the shell stamp, four stage tabs
   with question subtitles, a stage intro with eyebrow/question/refresh, the
   Predict-Try-Takeaway strip, an observation cue, a five-section Details
   drawer per stage, a check card with feedback on every option, the six-word
   provenance vocabulary, and the Takeaways appearing verbatim as the guide's
   learning goals.
*/
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildHtml } = require('./build.js');
const shell = require('../tools/lesson-shell');
const gc = require('../tools/lesson-shell/guide-contract');

const here = __dirname;
const model = fs.readFileSync(path.join(here, 'src', 'model.js'), 'utf8');
const guide = fs.readFileSync(path.join(here, 'src', 'demo-guide.html'), 'utf8');
const index = fs.readFileSync(path.join(here, 'index.html'), 'utf8');

/* --- the bundle is exactly what the sources produce --------------------- */
assert.equal(index, buildHtml().html, 'index.html must exactly match the checked-in source bundle');
assert.ok(index.includes(model), 'the tested production model must be embedded verbatim');
const scripts = index.split('<script>').slice(1).map(chunk => chunk.split('</script>')[0]);
assert.equal(scripts.length, 3, 'the bundle should contain the model, the lesson shell and the app');
scripts.forEach(script => new Function(script));
/* Load order is load-bearing: app.js uses window.lessonShell, so the shell
   script must be the one before it. */
assert.ok(scripts[0].includes('IonFlightModel'), 'script 1 is the model');
assert.ok(scripts[1].includes('window.lessonShell'), 'script 2 is the lesson shell');
assert.ok(scripts[2].includes('IonFlightModel'), 'script 3 is the app, which consumes the model');

/* ======================= MECHANISM PINS ================================= */
assert.match(index, /Arrival values and the trace stay hidden until you run the detector/);
assert.match(index, /CORE_TRACE_DOMAIN_US/);
assert.match(index, /runToken/);
assert.match(index, /cancelAnimationFrame/);
assert.match(index, /peaks\.reduce\(\(total, peakData\)/, 'detector trace must sum packet signals');
assert.match(index, /const summedDensity = \(result, timeUs\)/, 'stage 4 traces must use summed detector signals');
assert.match(index, /Both rows use the same vertical signal scale/);
assert.match(index, /completed \|\| runtime\.phase === 'running'/, 'predictions must lock during a run');
assert.match(index, /scrollIntoView\(\{ behavior: 'instant'/, 'Run must reveal the instrument before timing begins');
assert.match(index, /if \(!runtime\.startMs\) runtime\.startMs = now;/,
  'the run clock must start from the first animation-frame timestamp');
assert.doesNotMatch(index, /runtime\.startMs = performance\.now\(\)/,
  'a click-time performance.now() origin can exceed the first frame timestamp and make the elapsed guard throw');
assert.match(index, /160 milliseconds per physical microsecond/, 'the slow-motion scale must stay stated on screen');
assert.doesNotMatch(index, /mastered|M\.challenges/);
assert.match(index, /teacher-guide\.html/);

/* The two width rules are ASSUMPTIONS. This is the demo's load-bearing
   accuracy claim and the plan names it explicitly as must-not-regress. */
assert.match(index, /timing width is an assumption/i, 'the width rule must be labelled an assumption on screen');
assert.match(index, /assumed Gaussian timing spread/, 'sigma must be described as assumed');
assert.match(index, /declared classroom criterion|stated criterion/, 'the resolution criterion must be declared as this page\'s own');
assert.match(index, /not a universal instrument promise/, 'the longer-tube caveat must stay on screen');
assert.match(index, /Acceleration happens <em>before<\/em> this clock starts|Acceleration happens before this clock starts/,
  'the drift-only clock must stay stated');

/* --- the display title, in every place it appears ----------------------- */
const TITLE = 'Time-of-Flight Mass Spectrometer';
assert.match(index, new RegExp(`<title>${TITLE} · Guided Investigation</title>`), 'document title');
assert.match(index, new RegExp(`<h1>${TITLE}</h1>`), 'header brand title');
assert.match(guide, new RegExp(`<h1>${TITLE}</h1>`), 'guide heading');

/* ======================= CONTRACT.md REQUIRED UX ======================== */
assert.match(index, /<button class="icon-btn guide-open" type="button" id="guide-open" title="Guide" aria-label="Guide">/,
  'the ? button must be named exactly Guide');
assert.match(index, /<h2 id="guide-title">Guide<span class="head-sub">/, 'the Guide overlay heading must read Guide');

const menuStart = index.indexOf('<div class="lesson-dialog-body" id="settings-menu">');
assert.ok(menuStart > 0, 'the Settings menu must be present');
const menu = index.slice(menuStart, index.indexOf('</dialog>', menuStart));
for (const label of ['Open Presenter Notes', 'Presentation mode', 'Reset']) {
  assert.ok(menu.includes(`>${label}</button>`), `Settings must offer a button labelled exactly "${label}"`);
}
/* Order matters: the contract triad comes first, in this order. */
assert.ok(menu.indexOf('Open Presenter Notes') < menu.indexOf('Presentation mode'), 'notes before presentation mode');
assert.ok(menu.indexOf('Presentation mode') < menu.indexOf('>Reset</button>'), 'presentation mode before reset');
assert.doesNotMatch(menu, /Enter presentation mode|Exit presentation mode/,
  'the presentation item keeps one label; state rides on aria-pressed');

/* Reset is IN PLACE as of kit v2 (operator ruling 2026-09-16): the shell
   restores the chrome it owns and dispatches `lessonreset`; this demo restores
   the activity. Three properties are checkable here; the fourth -- that the
   state actually comes back -- is browser-only, which is why the browser pass
   is non-waivable.

   The NEGATIVE assertion is the load-bearing one. "In place" is not visible in
   a passing grep, and the way it regresses is a reload creeping back in, so
   what is asserted is that no navigation primitive survives in the shell's
   script at all. */
const shellJs = scripts[1];
const appJs = scripts[2];
/* Prose is not code: the shell's own comment explains that v1 called
   location.reload(), and the first run of this assertion failed on that
   sentence. Block comments are stripped before the scan -- and, per
   guide-contract.js's rule, stripping is what lets a scan miss things, so the
   scan is proved on bait first. */
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
/* Presentation mode is now preserved by NOT being touched, and the Guide is
   kept shut by not reopening rather than by a hash flag. Assert the old
   mechanism is gone so the two cannot coexist half-wired. */
assert.doesNotMatch(shellJs, /flags\.has\('reset'\)/,
  'the #reset hash flag died with the reload; the Guide simply does not reopen on a reset');

/* The presenter notes ARE the printable guide: same bytes, one source. */
/* Use the kit's own extractor rather than re-deriving the body here: a
   hand-rolled slice differed from it by one newline while this was being
   written, which is exactly the drift the single source exists to prevent. */
const guideBody = gc.extractGuide(guide).html;
assert.ok(guideBody.length > 6000, 'the guide body should be the whole document, not a summary');
assert.ok(index.includes(guideBody), 'the in-app presenter notes must be the guide body, verbatim');
assert.doesNotMatch(index, /class="presenter-notes"/, 'the hand-written notes fork must be gone');
assert.ok(index.includes('.guide-scope .g-foot'), 'the guide stylesheet must be injected too');
const guideCss = guide.slice(guide.indexOf('<style id="guide-css">'), guide.indexOf('\n</style>'));
assert.doesNotMatch(guideCss, /^\s*(body|html)\s*[,{]/m, 'the injected stylesheet must not carry page-level rules');
/* The shared extractor anchors its markers to column zero. A guide that merely
   CONTAINS them, indented, fails the build with a confusing "marker missing" —
   so pin the column here, where the message can say why. */
assert.match(guide, /^<style id="guide-css">$/m, 'the guide-css marker must start its line at column zero');
assert.match(guide, /^<div class="guide-scope">$/m, 'the guide-scope marker must start its line at column zero');

/* --- offline: nothing is fetched to render the page -------------------- */
assert.doesNotMatch(index, /<(script|link|img|iframe|source|video|audio)\b[^>]*\b(src|href)\s*=\s*["']https?:/i,
  'no external resource may be loaded');
assert.doesNotMatch(index.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' '),
  /\bfetch\s*\(|XMLHttpRequest|new WebSocket|@import|url\(\s*['"]?https?:/,
  'no runtime network calls');

/* ======================= TEMPLATE PINS A0-A10 =========================== */

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
assert.match(index, /@media \(orientation: landscape\) and \(max-height: 560px\)/, 'A0: landscape-short breakpoint');
assert.match(index, /@media \(prefers-reduced-motion: reduce\)/, 'A0: reduced-motion block');
assert.match(index, /@media \(prefers-contrast: more\)/, 'A0: increased-contrast block');
assert.match(index, /body\.presenter \{ --u: 1\.2rem; \}/, 'A0: one presenter type unit fleet-wide');

/* A1 — four stage tabs, each with a question subtitle, keyboard and hash. */
const tabs = index.match(/<button class="stage-tab"[\s\S]*?<\/button>/g) || [];
assert.equal(tabs.length, 4, 'A1: four stage tabs');
assert.match(index, /<nav class="stages" role="tablist"/, 'A1: the stage nav is a tablist');
tabs.forEach((tab, i) => {
  const sub = tab.match(/<small>([^<]*)<\/small>/);
  assert.ok(sub, `A1: tab ${i + 1} needs a subtitle`);
  assert.ok(sub[1].trim().endsWith('?'), `A1: tab ${i + 1} subtitle must be a question: "${sub[1]}"`);
});
assert.match(shellJs, /\^stage-\(\\d\+\)\$/, 'A1: a #stage-N fragment selects a stage');
assert.match(shellJs, /ArrowRight|ArrowLeft/, 'A1: tabs are arrow-key navigable');
assert.match(shellJs, /t\.tabIndex = on \? 0 : -1/, 'A1: roving tabindex');

/* A2 — four stage intros: eyebrow, one question, refresh, and the strip. */
const stages = index.match(/<section class="stage[^"]*" id="stage-\d"[\s\S]*?(?=<section class="stage[^"]*" id="stage-\d"|<\/main>)/g) || [];
assert.equal(stages.length, 4, 'A2: four stage panels');
const TAKEAWAYS = [];
stages.forEach((stage, i) => {
  const n = i + 1;
  assert.match(stage, /<span class="eyebrow">Demo 13 of 16 &middot; Part four/, `A2: stage ${n} eyebrow places the demo on the path`);
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
  /* The Predict card must name a specific outcome, not "think about it". */
  const predict = strip[0].match(/<span>Predict<\/span><p>([\s\S]*?)<\/p>/);
  assert.ok(predict && predict[1].includes('?'), `A2: stage ${n} Predict must pose a concrete prediction`);
  /* The Try card must name a control that exists in the built page. */
  const tryCard = strip[0].match(/<span>Try<\/span><p>([\s\S]*?)<\/p>/);
  const control = tryCard[1].match(/<b>([^<]+)<\/b>/);
  assert.ok(control, `A2: stage ${n} Try must name a control in bold`);
  assert.ok(index.includes(control[1]) || index.includes(control[1].replace('&mdash;', '—')),
    `A2: stage ${n} Try names "${control[1]}", which must exist in the page`);
});
/* The operator amendment: no stated objective anywhere a learner reads. */
assert.doesNotMatch(index, /You will be able to/i, 'A2: no objective-shaped line anywhere in the demo');
assert.doesNotMatch(guide, /You will be able to/i, 'A9: no objective-shaped line in the guide either');

/* A3 — the six-word provenance vocabulary, and nothing else. */
const kickersUsed = [...new Set((index.match(/class="k-[a-z-]+"/g) || []).map(s => s.slice(7, -1)))];
kickersUsed.filter(k => k !== shell.QUALIFIER_CLASS).forEach(k => {
  assert.ok(shell.KICKERS.includes(k), `A3: ${k} is not one of the six provenance words`);
});
assert.ok(kickersUsed.includes('k-live'), 'A3: the computed surfaces are labelled Live');
assert.ok(kickersUsed.includes('k-scripted'), 'A3: the fixtures are labelled Scripted');
assert.match(index, /<span class="control-label"|<label class="control-label"/, 'A3: controls carry purpose labels');
assert.match(index, /class="why"/, 'A3: a purpose label says why you would change it');

/* A4 — an observation cue per activity, aria-live, fired on Try. */
assert.ok((index.match(/class="obs-cue"/g) || []).length >= 2, 'A4: an observation cue in each activity');
assert.match(index, /<p class="obs-cue" id="cue-core" role="status" aria-live="polite">/, 'A4: the core cue is a live region');
assert.match(index, /setCue\('Clock started/, 'A4: pressing Run produces a cue');

/* A5 — one Details section per stage, each with the five fixed sections. */
const detailStages = index.match(/<section class="details-stage[^"]*" data-details-stage="\d"[\s\S]*?(?=<section class="details-stage|<\/div>\s*<form method="dialog" class="lesson-dialog-actions")/g) || [];
assert.equal(detailStages.length, 4, 'A5: one Details section per stage');
detailStages.forEach((section, i) => {
  assert.match(section, /<span class="eyebrow">What is live/, `A5: stage ${i + 1} names what is live`);
  assert.match(section, /<h3>How it works<\/h3>/, `A5: stage ${i + 1} explains the mechanism`);
  assert.match(section, /<h3>Assumptions and simplifications<\/h3>/, `A5: stage ${i + 1} lists its assumptions`);
  assert.match(section, /<h3>Sources<\/h3>/, `A5: stage ${i + 1} lists sources`);
  assert.match(section, /class="evidence-card"><b>Boundary:<\/b>/, `A5: stage ${i + 1} states its boundary`);
  /* Detail prose that carries a claim is labelled, not left bare. */
  assert.ok(/class="claim"/.test(section), `A5: stage ${i + 1} must label its claim-bearing prose`);
  (section.match(/<div class="claim">[\s\S]*?<\/div>/g) || []).forEach((claim, j) => {
    assert.ok(shell.KICKERS.some(k => claim.includes(`"${k}"`)),
      `A5: stage ${i + 1} claim ${j} has no provenance kicker`);
  });
});
/* Every Sourced claim must resolve to a Sources entry. This demo's sources are
   hyperlinks, and one of them was found dead (404) on 2026-09-15 and replaced;
   pin the live ones so a future edit cannot quietly reintroduce a broken one. */
assert.match(index, /cif\.iastate\.edu\/mass-spec\/ms-tutorial/, 'A5: the Iowa State source is cited');
assert.match(index, /chem\.libretexts\.org[\s\S]{0,200}Time-of-Flight/, 'A5: the LibreTexts source is cited');
assert.doesNotMatch(index, /shimadzu/i, 'A5: the dead Shimadzu citation must not come back');

/* A6 — a check per stage, feedback on EVERY option, refutation items. */
const checks = index.match(/<section class="check"[\s\S]*?<\/section>/g) || [];
assert.equal(checks.length, 4, 'A6: one check-yourself card per stage');
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
assert.ok(refutations >= 1, 'A6: at least one refutation item per demo');
assert.match(shellJs, /btn\.dataset\.feedback/, 'A6: the feedback is actually shown');
assert.doesNotMatch(index, /score|points/i.source && /checkScore|addPoints/, 'A6: no score is kept');

/* A9 — the guide carries every Takeaway verbatim as a learning goal. */
TAKEAWAYS.forEach((takeaway, i) => {
  assert.ok(guide.includes(takeaway),
    `A9: stage ${i + 1}'s Takeaway must appear verbatim under the guide's Learning goals:\n  ${takeaway}`);
});
assert.ok((guide.match(/class="mis"/g) || []).length >= 4, 'A9: a misconception card per stage');
assert.match(guide, /class="say"/, 'A9: a line for the presenter to say');
assert.match(guide, /<h2 id="g-goals">Learning goals<\/h2>/, 'A9: the guide has a Learning goals section');
assert.match(guide, /<h2 id="g-path">Where this sits on the path<\/h2>/, 'A9: the guide places the demo on the path');
assert.match(guide, /<h2 id="g-question">One question for the session<\/h2>/, 'A9: the guide names the session question');
const guideWords = guideBody.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
assert.ok(guideWords <= 2500, `A9: the guide must stay in the 2-4 page band (<=2500 words); it is ${guideWords}`);
assert.ok(guideWords >= 900, `A9: the guide must be a real session plan; it is only ${guideWords} words`);

/* --- --check is a real drift gate, proved both ways -------------------- */
const clean = spawnSync(process.execPath, ['build.js', '--check'], { cwd: here, encoding: 'utf8' });
assert.equal(clean.status, 0, clean.stderr || clean.stdout);
assert.match(clean.stdout, /build parity OK/);

/* Negative control: a copy of the demo whose guide has been edited without a
   rebuild must FAIL the same check. Without this, a check that always passed
   would look identical to a check that works. The kit is copied too, since
   build.js now reads it — which also proves the check sees the kit. */
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ion-flight-drift-'));
try {
  const demoDir = path.join(sandbox, 'ion-flight');
  fs.mkdirSync(path.join(demoDir, 'src'), { recursive: true });
  fs.cpSync(path.join(here, '..', 'tools', 'lesson-shell'), path.join(sandbox, 'tools', 'lesson-shell'), { recursive: true });
  for (const file of ['build.js', 'index.html', 'teacher-guide.html', 'teacher-guide.pdf']) {
    fs.copyFileSync(path.join(here, file), path.join(demoDir, file));
  }
  for (const file of ['template.html', 'styles.css', 'app.js', 'model.js', 'demo-guide.html']) {
    fs.copyFileSync(path.join(here, 'src', file), path.join(demoDir, 'src', file));
  }
  /* Control 1: the sandbox as copied must PASS, or a later failure proves
     nothing about drift — it would just mean the copy was broken. */
  const sane = spawnSync(process.execPath, ['build.js', '--check'], { cwd: demoDir, encoding: 'utf8' });
  assert.equal(sane.status, 0, 'the untouched sandbox copy must pass --check first: ' + (sane.stderr || sane.stdout));

  /* Control 2: edit the guide without rebuilding. */
  const driftedGuide = path.join(demoDir, 'src', 'demo-guide.html');
  fs.writeFileSync(driftedGuide, fs.readFileSync(driftedGuide, 'utf8')
    .replace('Discussion questions', 'Discussion questions (edited without a rebuild)'));
  const drifted = spawnSync(process.execPath, ['build.js', '--check'], { cwd: demoDir, encoding: 'utf8' });
  assert.equal(drifted.status, 1, 'editing the guide without rebuilding must fail --check');
  assert.match(drifted.stderr, /MISMATCH/);

  /* Control 3: change the SHARED KIT without rebuilding. This is the new
     failure mode the cross-folder dependency introduces, and the stamp is
     what catches it — so prove the stamp catches it. */
  const kitCss = path.join(sandbox, 'tools', 'lesson-shell', 'shell.css');
  fs.writeFileSync(kitCss, fs.readFileSync(kitCss, 'utf8') + '\n.bh-credit { color: red; }\n');
  const kitDrift = spawnSync(process.execPath, ['build.js', '--check'], { cwd: demoDir, encoding: 'utf8' });
  assert.equal(kitDrift.status, 1, 'changing the shared kit without rebuilding must fail --check');
  const kitCheck = spawnSync(process.execPath,
    [path.join(sandbox, 'tools', 'lesson-shell', 'check-shell.js'), 'ion-flight'],
    { cwd: sandbox, encoding: 'utf8' });
  assert.equal(kitCheck.status, 1, 'check-shell must fail a demo built against an older kit');
  assert.match(kitCheck.stderr, /shell CSS has changed since this was built/);
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}

console.log('Ion Flight bundle: mechanism pins (rAF clock origin, prediction lock, summed trace,');
console.log('  cancellation, width-rule assumption labels), CONTRACT Guide/Settings/Reset chrome,');
console.log('  notes-equal-guide injection, offline bundle, template parts A0-A6 and A9, and a drift');
console.log('  gate proved in four directions including a change to the shared kit.');
