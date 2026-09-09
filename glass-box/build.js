// Build: concatenate src/ into a single self-contained index.html.
// Refuses to emit a file containing any external src= or href= reference,
// so the single-file promise cannot rot. (Same policy as Zero to Unbeatable.)
//
//   node build.js          writes index.html and demo-guide.html
//   node build.js --check  verifies both against the canonical build, writes nothing
//
// ONE SOURCE FOR THE NOTES. src/demo-guide.html is canonical for three
// surfaces: the printable page shipped at the demo root, Glass-Box-Demo-Guide.pdf,
// and the app's Settings -> Open Presenter Notes overlay. Its scoped stylesheet
// and its .guide-scope body are lifted out verbatim and injected into the app,
// so nothing is fetched at runtime and --check fails the moment any surface
// drifts. Before this, the in-app notes were a hand-written near-copy (1,098
// words against the guide's 1,503) with nothing keeping them honest.
'use strict';
const fs = require('fs');
const path = require('path');

const S = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const die = (msg) => { console.error(msg); process.exit(1); };

const css = S('styles.css');
// worker.js is included in BOTH bundles: in the worker it wires itself to the
// message pipe; on the page its guard is inert and it just defines
// createWorkerRuntime, which app.js uses as the no-Worker fallback.
const core = [S('engine.js'), S('text.js'), S('arith.js'), S('agent.js'), S('worker.js')].join('\n;\n');
const workerSrc = [S('engine.js'), S('text.js'), S('arith.js'), S('worker.js')].join('\n;\n');
const app = S('app.js');

// ---- lift the guide -------------------------------------------------------
// Markers are anchored to the start of a line and must occur exactly once, and
// the search runs over a copy with every <!-- --> region blanked to same-length
// spaces. Both halves are load-bearing: a marker named in a head comment that
// explains the mechanism is otherwise the FIRST thing found, and the guide's
// own <style id="guide-css"> is exactly the sort of thing such a comment names.
const guideSrc = S('demo-guide.html');
const masked = guideSrc.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
if (masked.length !== guideSrc.length) die('comment mask changed the file length — offsets would be wrong');

function soleLineIndex(hay, marker, what) {
  const re = new RegExp('^' + marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gm');
  const hits = [];
  let m;
  while ((m = re.exec(hay))) hits.push(m.index);
  if (hits.length === 0) die(`guide marker missing (must start a line): ${marker}`);
  if (hits.length > 1) die(`guide names ${marker} at the start of ${hits.length} lines; it must be unique`);
  return hits[0];
}

const cssOpen = soleLineIndex(masked, '<style id="guide-css">');
const cssClose = masked.indexOf('\n</style>', cssOpen);
if (cssClose < 0) die('the guide-css block is not closed by a line-anchored </style>');
const guideCss = guideSrc.slice(cssOpen + '<style id="guide-css">'.length, cssClose);

const bodyOpen = soleLineIndex(masked, '<div class="guide-scope">');
// The end marker carries a comment, so it cannot be found in the masked copy.
// Requiring it to be line-anchored, unique, and AFTER the opening div is what
// rules out a head comment that quotes it.
const endMark = '\n</div><!-- /guide -->';
const endHits = [];
for (let i = guideSrc.indexOf(endMark); i >= 0; i = guideSrc.indexOf(endMark, i + 1)) endHits.push(i);
if (endHits.length !== 1) die(`guide must contain exactly one line-anchored "</div><!-- /guide -->" (found ${endHits.length})`);
if (endHits[0] < bodyOpen) die('the guide-scope end marker precedes its opening div');
const guideHtml = guideSrc.slice(bodyOpen, endHits[0] + '\n</div>'.length).trim();

// Every selector in the injected block must start with .guide-scope. One
// unscoped rule — `body`, `*`, a bare `h2` — would restyle the whole app from
// inside a hidden overlay, which is a miserable thing to track down. The rules
// here are written one per line but wrap, so a "line ends with {" heuristic
// would inspect nothing and pass vacuously; parse the blocks instead, and
// refuse a stylesheet that parsed to zero rules.
{
  const flat = guideCss.replace(/\/\*[\s\S]*?\*\//g, '');
  if (/@[a-zA-Z-]+/.test(flat)) die('guide-css contains an at-rule; page-level chrome belongs in <style id="guide-page">');
  const leaks = [];
  let rules = 0, m;
  const re = /([^{}]+)\{([^{}]*)\}/g;
  while ((m = re.exec(flat))) {
    rules++;
    m[1].split(',').map((s) => s.trim()).filter(Boolean)
      .forEach((sel) => { if (!/^\.guide-scope\b/.test(sel)) leaks.push(sel); });
  }
  if (rules === 0) die('guide-css parsed to zero rules — the scope check would prove nothing');
  if (leaks.length) die('guide stylesheet leaks unscoped rules into the app:\n  ' + leaks.join('\n  '));
  if (!/[^\s]/.test(guideHtml.replace(/<[^>]*>/g, ''))) die('the guide body extracted to no text');
}

// ---- inject ---------------------------------------------------------------
let html = S('template.html');
// Exactly once, each. String.replace with a string argument substitutes the
// FIRST occurrence, so a placeholder named a second time anywhere in the file —
// in a comment explaining the mechanism, say — silently swallows the injection.
// The replacements are functions, not strings, because $$ / $& / $` / $' in the
// injected text would otherwise be eaten as substitution patterns.
for (const ph of ['/*__CSS__*/', '/*__CORE__*/', '/*__WORKER__*/', '/*__APP__*/', '/*__GUIDE_CSS__*/', '<!--__GUIDE__-->']) {
  const n = html.split(ph).length - 1;
  if (n === 0) die('template placeholder missing: ' + ph);
  if (n > 1) die(`template names ${ph} ${n} times; it must appear exactly once`);
}
html = html.replace('/*__CSS__*/', () => css);
html = html.replace('/*__GUIDE_CSS__*/', () => guideCss);
html = html.replace('<!--__GUIDE__-->', () => guideHtml);
html = html.replace('/*__CORE__*/', () => core);
html = html.replace('/*__WORKER__*/', () => 'const WORKER_SRC = ' + JSON.stringify(workerSrc) + ';');
html = html.replace('/*__APP__*/', () => app);

// ---- single-file guard ----
// The one permitted reference is the link to the printable guide sitting beside
// index.html; everything else must be inline.
const external = html.match(/(?:src|href)\s*=\s*["'](?!#|demo-guide\.html)[^"']*["']/g) || [];
const offenders = external.filter(m => /https?:|\/\//.test(m));
if (offenders.length) die('BUILD REFUSED — external references found: ' + offenders.join(', '));

// Nothing may be fetched at runtime either. Prose is not code: HTML and block
// comments are stripped before the scan, or a source comment that merely
// mentions <iframe> refuses the build (it did, while this was being written).
// Stripping is what makes the scan able to miss things, so the scan is proved
// on a synthetic positive before its silence is believed.
const RUNTIME_LOADS = /<iframe|new\s+XMLHttpRequest|\bfetch\s*\(|new\s+WebSocket|@import|url\(\s*['"]?https?:/i;
const decommented = (s) => s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
for (const bait of ['<iframe src="x.html">', 'fetch("x.json")', '@import "x.css"']) {
  if (!RUNTIME_LOADS.test(decommented(html + '\n' + bait))) die('the runtime-load scan failed its own positive control: ' + bait);
}
if (RUNTIME_LOADS.test(decommented(html))) die('BUILD REFUSED — the page would load something at runtime');

const indexOut = path.join(__dirname, 'index.html');
const srcGuide = path.join(__dirname, 'src', 'demo-guide.html');
const guideOut = path.join(__dirname, 'demo-guide.html');
const pdfOut = path.join(__dirname, 'Glass-Box-Demo-Guide.pdf');
const checkOnly = process.argv.includes('--check');

if (checkOnly) {
  const same = (file, want) => fs.existsSync(file) && fs.readFileSync(file, 'utf8') === want;
  if (!same(indexOut, html)) die('build parity MISMATCH — index.html differs from the canonical build. Run: node build.js');
  if (!same(guideOut, guideSrc)) die('build parity MISMATCH — demo-guide.html differs from src/demo-guide.html. Run: node build.js');
  // Index parity already implies this, the notes being a substring of the build
  // output. Assert it directly anyway: it is the property the contract names,
  // and a template edit that dropped the placeholder would otherwise pass
  // silently with the notes simply absent from the app.
  if (!fs.readFileSync(indexOut, 'utf8').includes(guideHtml)) {
    die('build parity MISMATCH — the in-app presenter notes are not the guide body. Run: node build.js');
  }
  // The PDF is a render, not a copy, so it cannot be compared byte for byte.
  // Freshness is the pin that is available: it must not predate the guide it is
  // a picture of. Two seconds of slack absorbs a fresh checkout, which stamps
  // every file at about the same instant.
  if (!fs.existsSync(pdfOut)) die('build parity MISMATCH — Glass-Box-Demo-Guide.pdf is missing. Run: node tools/pdf.mjs');
  const lag = fs.statSync(srcGuide).mtimeMs - fs.statSync(pdfOut).mtimeMs;
  if (lag > 2000) {
    die('build parity MISMATCH — Glass-Box-Demo-Guide.pdf is older than src/demo-guide.html by ' +
        (lag / 1000).toFixed(0) + 's. Run: node tools/pdf.mjs');
  }
  console.log('build parity OK — index.html, demo-guide.html and the in-app presenter notes all derive');
  console.log('build parity OK — from src/demo-guide.html, and the PDF is no older than it; no files written');
} else {
  fs.writeFileSync(indexOut, html);
  fs.copyFileSync(srcGuide, guideOut);
  console.log('built index.html (' + Math.round(html.length / 1024) + ' KB) and demo-guide.html');
  console.log('  presenter notes injected from src/demo-guide.html: ' +
              guideHtml.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length + ' words');
  console.log('NOTE: if the guide changed, re-render the PDF: node tools/pdf.mjs');
}
