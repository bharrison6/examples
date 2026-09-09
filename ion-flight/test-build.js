const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildHtml } = require('./build.js');

const here = __dirname;
const model = fs.readFileSync(path.join(here, 'model.js'), 'utf8');
const guide = fs.readFileSync(path.join(here, 'teacher-guide.html'), 'utf8');
const index = fs.readFileSync(path.join(here, 'index.html'), 'utf8');

/* --- the bundle is exactly what the sources produce --------------------- */
assert.equal(index, buildHtml(), 'index.html must exactly match the checked-in source bundle');
assert.ok(index.includes(model), 'the tested production model must be embedded verbatim');
const scripts = index.split('<script>').slice(1).map(chunk => chunk.split('</script>')[0]);
assert.equal(scripts.length, 2, 'the bundle should contain model and app scripts');
scripts.forEach(script => new Function(script));

/* --- the demo's own behaviour ------------------------------------------ */
assert.match(index, /Arrival values and the trace stay hidden until you run the detector/);
assert.match(index, /CORE_TRACE_DOMAIN_US/);
assert.match(index, /runToken/);
assert.match(index, /cancelAnimationFrame/);
assert.match(index, /peaks\.reduce\(\(total, peakData\)/, 'detector trace must sum packet signals');
assert.match(index, /const summedDensity = \(result, timeUs\)/, 'advanced traces must use summed detector signals');
assert.match(index, /Both rows use the same vertical signal scale/);
assert.match(index, /completed \|\| runtime\.phase === 'running'/, 'predictions must lock during a run');
assert.match(index, /scrollIntoView\(\{ behavior: 'instant'/, 'Run must reveal the instrument before timing begins');
assert.match(index, /@media \(max-width: 620px\)[\s\S]*\.instrument-head \{ align-items: flex-start; flex-direction: column; \}/);
assert.doesNotMatch(index, /mastered|M\.challenges/);
assert.match(index, /teacher-guide\.html/);

/* --- the display title, in every place it appears ----------------------- */
const TITLE = 'Time-of-Flight Mass Spectrometer';
assert.match(index, new RegExp(`<title>${TITLE} · Guided Investigation</title>`), 'document title');
assert.match(index, new RegExp(`<strong>${TITLE}</strong></div>`), 'header brand title');
assert.match(guide, new RegExp(`<h1>${TITLE}</h1>`), 'guide heading');

/* --- CONTRACT.md Required UX ------------------------------------------- */
assert.match(index, /<button class="icon-button" id="howButton" aria-label="Guide" title="Guide">\?<\/button>/,
  'the ? button must be named exactly Guide');
assert.match(index, /<h2 id="howTitle">Guide<\/h2>/, 'the Guide overlay heading must read Guide');

const menu = index.slice(index.indexOf('<div class="settings"'), index.indexOf('</header>'));
for (const label of ['Open Presenter Notes', 'Presentation mode', 'Reset']) {
  assert.ok(menu.includes(`>${label}</button>`), `Settings must offer a button labelled exactly "${label}"`);
}
assert.doesNotMatch(menu, /Enter presentation mode|Exit presentation mode/,
  'the presentation item keeps one label; state rides on aria-pressed');

/* Reset means fresh load, and must not reopen the Guide overlay. */
const resetBody = index.slice(index.indexOf('function resetAll()'), index.indexOf('function advancedSpread()'));
assert.match(resetBody, /setPresentationMode\(false\)/, 'Reset must leave presentation mode');
assert.match(resetBody, /setAdvancedMode\('absolute'\)/, 'Reset must restore the default width assumption');
assert.match(resetBody, /querySelectorAll\('details'\)/, 'Reset must close the optional extension');
assert.match(resetBody, /querySelectorAll\('\.overlay'\)/, 'Reset must close every overlay');
assert.doesNotMatch(resetBody, /howOverlay'\)\.hidden = false/, 'Reset must not reopen the Guide overlay');

/* The presenter notes ARE the printable guide: same bytes, one source. */
const guideBody = guide.slice(guide.indexOf('<div class="guide-scope">'), guide.indexOf('</div><!-- /guide -->')) + '</div>';
assert.ok(guideBody.length > 6000, 'the guide body should be the whole document, not a summary');
assert.ok(index.includes(guideBody), 'the in-app presenter notes must be the guide body, verbatim');
assert.doesNotMatch(index, /class="presenter-notes"/, 'the hand-written notes fork must be gone');
const guideCss = guide.slice(guide.indexOf('<style id="guide-css">'), guide.indexOf('</style>'));
assert.ok(index.includes('.guide-scope .g-foot'), 'the guide stylesheet must be injected too');
assert.doesNotMatch(guideCss, /^\s*(body|html)\s*[,{]/m, 'the injected stylesheet must not carry page-level rules');

/* --- offline: nothing is fetched to render the page -------------------- */
assert.doesNotMatch(index, /<(script|link|img|iframe|source|video|audio)\b[^>]*\b(src|href)\s*=\s*["']https?:/i,
  'no external resource may be loaded');
assert.doesNotMatch(index, /\bfetch\(|XMLHttpRequest|WebSocket|@import|url\(http/,
  'no runtime network calls');

/* --- --check is a real drift gate, proved both ways -------------------- */
const clean = spawnSync(process.execPath, ['build.js', '--check'], { cwd: here, encoding: 'utf8' });
assert.equal(clean.status, 0, clean.stderr || clean.stdout);
assert.match(clean.stdout, /read-only check/);

/* Negative control: a copy of the demo whose guide has been edited without a
   rebuild must FAIL the same check. Without this, a check that always passed
   would look identical to a check that works. */
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ion-flight-drift-'));
try {
  for (const file of ['build.js', 'app.template.html', 'model.js', 'teacher-guide.html', 'index.html']) {
    fs.copyFileSync(path.join(here, file), path.join(sandbox, file));
  }
  const drifted = fs.readFileSync(path.join(sandbox, 'teacher-guide.html'), 'utf8')
    .replace('Discussion prompts', 'Discussion prompts (edited without a rebuild)');
  fs.writeFileSync(path.join(sandbox, 'teacher-guide.html'), drifted);
  const check = spawnSync(process.execPath, ['build.js', '--check'], { cwd: sandbox, encoding: 'utf8' });
  assert.equal(check.status, 1, 'editing the guide without rebuilding must fail --check');
  assert.match(check.stderr, /out of date/);
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}

console.log('Ion Flight bundle: production modules, lesson gating, cancellation hooks, inline syntax, Guide/Settings/Reset chrome, notes-equal-guide injection, offline bundle, and a drift check proved in both directions.');
